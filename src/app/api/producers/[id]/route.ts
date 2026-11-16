import { count, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { hasRole } from "@/lib/permissions";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getSession } from "@/server/session";

export async function PUT(request: NextRequest, ctx: RouteContext<"/api/producers/[id]">) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(session.user.role, "manager"))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const { email, title, joinDate, userId, ...rest } = await request.json();

  const [row] = await db
    .update(schema.producer)
    .set({
      ...rest,
      email: email || null,
      title: title || null,
      joinDate: joinDate || null,
      userId: userId || null,
      updatedAt: new Date(),
    })
    .where(eq(schema.producer.id, Number(id)))
    .returning();

  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(row);
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/producers/[id]">) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(session.user.role, "admin"))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const producerId = Number(id);

  const [[{ leads }], [{ prospects }]] = await Promise.all([
    db.select({ leads: count() }).from(schema.lead).where(eq(schema.lead.producerId, producerId)),
    db.select({ prospects: count() }).from(schema.prospectClient).where(eq(schema.prospectClient.producerId, producerId)),
  ]);
  if (leads || prospects)
    return Response.json(
      { error: `Cannot delete: this salesman still has ${leads} leads and ${prospects} prospects. Reassign them first.` },
      { status: 409 },
    );

  const [row] = await db.delete(schema.producer).where(eq(schema.producer.id, producerId)).returning();

  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
