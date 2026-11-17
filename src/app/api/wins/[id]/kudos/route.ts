import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getSession } from "@/server/session";

/** Congratulate a colleague on a win, with an optional short note. Body: { message?: string } */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/wins/[id]/kudos">) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const leadId = Number((await ctx.params).id);

  const [win] = await db
    .select({ ownerId: schema.producer.userId })
    .from(schema.lead)
    .innerJoin(schema.producer, eq(schema.lead.producerId, schema.producer.id))
    .where(and(eq(schema.lead.id, leadId), eq(schema.lead.status, "Secured")))
    .limit(1);
  if (!win) return Response.json({ error: "Win not found" }, { status: 404 });
  if (win.ownerId === session.user.id) return Response.json({ error: "You cannot congratulate yourself" }, { status: 400 });

  const { message } = (await request.json().catch(() => ({}))) as { message?: string };
  const note = message?.trim().slice(0, 200) || null;
  await db
    .insert(schema.winKudos)
    .values({ leadId, userId: session.user.id, message: note })
    .onConflictDoUpdate({ target: [schema.winKudos.leadId, schema.winKudos.userId], set: { message: note, seenAt: null } });

  return Response.json({ ok: true }, { status: 201 });
}
