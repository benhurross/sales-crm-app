import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { hasRole } from "@/lib/permissions";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getSession } from "@/server/session";
import { apiError } from "@/server/api-error";

async function canAccessProspect(userId: string, role: string | null | undefined, prospectId: number) {
  if (hasRole(role, "manager")) return true;
  const [myProducer] = await db
    .select({ id: schema.producer.id })
    .from(schema.producer)
    .where(eq(schema.producer.userId, userId))
    .limit(1);
  if (!myProducer) return false;
  const [prospect] = await db
    .select({ producerId: schema.prospectClient.producerId })
    .from(schema.prospectClient)
    .where(eq(schema.prospectClient.id, prospectId))
    .limit(1);
  return prospect?.producerId === myProducer.id;
}

export async function GET(request: NextRequest, ctx: RouteContext<"/api/prospects/[id]">) {
  const session = await getSession(request);
  if (!session) return apiError(request, "unauthorized", 401);

  const { id } = await ctx.params;
  const numId = Number(id);

  if (!(await canAccessProspect(session.user.id, session.user.role, numId)))
    return apiError(request, "forbidden", 403);

  const [row] = await db.select().from(schema.prospectClient).where(eq(schema.prospectClient.id, numId)).limit(1);
  if (!row) return apiError(request, "notFound", 404);

  return Response.json(row);
}

export async function PUT(request: NextRequest, ctx: RouteContext<"/api/prospects/[id]">) {
  const session = await getSession(request);
  if (!session) return apiError(request, "unauthorized", 401);

  const { id } = await ctx.params;
  const numId = Number(id);

  if (!(await canAccessProspect(session.user.id, session.user.role, numId)))
    return apiError(request, "forbidden", 403);

  const { premiums, currentInsurerId, ...rest } = await request.json();
  const [row] = await db
    .update(schema.prospectClient)
    .set({
      ...rest,
      premiums: premiums || null,
      currentInsurerId: currentInsurerId ? Number(currentInsurerId) : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.prospectClient.id, numId))
    .returning();

  if (!row) return apiError(request, "notFound", 404);
  return Response.json(row);
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/prospects/[id]">) {
  const session = await getSession(request);
  if (!session) return apiError(request, "unauthorized", 401);

  const { id } = await ctx.params;
  const numId = Number(id);

  if (!(await canAccessProspect(session.user.id, session.user.role, numId)))
    return apiError(request, "forbidden", 403);

  const [row] = await db.delete(schema.prospectClient).where(eq(schema.prospectClient.id, numId)).returning();

  if (!row) return apiError(request, "notFound", 404);
  return Response.json({ ok: true });
}
