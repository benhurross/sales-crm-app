import { count, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { hasRole } from "@/lib/permissions";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getSession } from "@/server/session";
import { apiError } from "@/server/api-error";

export async function PUT(request: NextRequest, ctx: RouteContext<"/api/producers/[id]">) {
  const session = await getSession(request);
  if (!session) return apiError(request, "unauthorized", 401);
  if (!hasRole(session.user.role, "manager"))
    return apiError(request, "forbidden", 403);

  const { id } = await ctx.params;
  const { email, title, joinDate, leavingDate, userId, ...rest } = await request.json();

  const [row] = await db
    .update(schema.producer)
    .set({
      ...rest,
      email: email || null,
      title: title || null,
      joinDate: joinDate || null,
      leavingDate: leavingDate || null,
      userId: userId || null,
      updatedAt: new Date(),
    })
    .where(eq(schema.producer.id, Number(id)))
    .returning();

  if (!row) return apiError(request, "notFound", 404);
  return Response.json(row);
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/producers/[id]">) {
  const session = await getSession(request);
  if (!session) return apiError(request, "unauthorized", 401);
  if (!hasRole(session.user.role, "admin"))
    return apiError(request, "forbidden", 403);

  const { id } = await ctx.params;
  const producerId = Number(id);

  const [[{ leads }], [{ prospects }]] = await Promise.all([
    db.select({ leads: count() }).from(schema.lead).where(eq(schema.lead.producerId, producerId)),
    db.select({ prospects: count() }).from(schema.prospectClient).where(eq(schema.prospectClient.producerId, producerId)),
  ]);
  if (leads || prospects)
    return apiError(request, "producerHasRecords", 409, { leads, prospects });

  const [row] = await db.delete(schema.producer).where(eq(schema.producer.id, producerId)).returning();

  if (!row) return apiError(request, "notFound", 404);
  return Response.json({ ok: true });
}
