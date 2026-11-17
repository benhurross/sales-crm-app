import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { hasRole } from "@/lib/permissions";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getSession } from "@/server/session";
import { apiError } from "@/server/api-error";

export async function PUT(request: NextRequest, ctx: RouteContext<"/api/settings/insurers/[id]">) {
  const session = await getSession(request);
  if (!session) return apiError(request, "unauthorized", 401);
  if (!hasRole(session.user.role, "admin"))
    return apiError(request, "forbidden", 403);

  const { id } = await ctx.params;
  const { name } = await request.json();

  if (!name?.trim()) return apiError(request, "nameRequired", 400);

  const [row] = await db
    .update(schema.insuranceCompany)
    .set({ name: name.trim() })
    .where(eq(schema.insuranceCompany.id, Number(id)))
    .returning();

  if (!row) return apiError(request, "notFound", 404);
  return Response.json(row);
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/settings/insurers/[id]">) {
  const session = await getSession(request);
  if (!session) return apiError(request, "unauthorized", 401);
  if (!hasRole(session.user.role, "admin"))
    return apiError(request, "forbidden", 403);

  const { id } = await ctx.params;

  const refs = await db
    .select({ id: schema.lead.id })
    .from(schema.lead)
    .where(eq(schema.lead.currentInsurerId, Number(id)))
    .limit(1);
  if (refs.length)
    return apiError(request, "insurerInUse", 409);

  const [row] = await db
    .delete(schema.insuranceCompany)
    .where(eq(schema.insuranceCompany.id, Number(id)))
    .returning();

  if (!row) return apiError(request, "notFound", 404);
  return Response.json({ ok: true });
}
