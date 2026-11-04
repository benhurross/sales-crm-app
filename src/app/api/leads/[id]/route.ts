import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { hasRole } from "@/lib/permissions";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getSession } from "@/server/session";

async function canAccessLead(userId: string, role: string | null | undefined, leadId: number) {
  if (hasRole(role, "manager")) return true;
  const [myProducer] = await db
    .select({ id: schema.producer.id })
    .from(schema.producer)
    .where(eq(schema.producer.userId, userId))
    .limit(1);
  if (!myProducer) return false;
  const [lead] = await db
    .select({ producerId: schema.lead.producerId })
    .from(schema.lead)
    .where(eq(schema.lead.id, leadId))
    .limit(1);
  return lead?.producerId === myProducer.id;
}

export async function GET(request: NextRequest, ctx: RouteContext<"/api/leads/[id]">) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const numId = Number(id);

  if (!(await canAccessLead(session.user.id, session.user.role, numId)))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const [row] = await db.select().from(schema.lead).where(eq(schema.lead.id, numId)).limit(1);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json(row);
}

export async function PUT(request: NextRequest, ctx: RouteContext<"/api/leads/[id]">) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const numId = Number(id);

  if (!(await canAccessLead(session.user.id, session.user.role, numId)))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const { commission, currentInsurerId, borTimestamp, quoteTimestamp, comments, ...rest } = await request.json();
  const [row] = await db
    .update(schema.lead)
    .set({
      ...rest,
      commission: commission || null,
      currentInsurerId: currentInsurerId || null,
      borTimestamp: borTimestamp || null,
      quoteTimestamp: quoteTimestamp || null,
      comments: comments || null,
      updatedAt: new Date(),
    })
    .where(eq(schema.lead.id, numId))
    .returning();

  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(row);
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/leads/[id]">) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(session.user.role, "manager"))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const [row] = await db.delete(schema.lead).where(eq(schema.lead.id, Number(id))).returning();

  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
