import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { hasRole } from "@/lib/permissions";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getSession } from "@/server/session";

export async function PUT(request: NextRequest, ctx: RouteContext<"/api/settings/insurers/[id]">) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(session.user.role, "admin"))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const { name } = await request.json();

  if (!name?.trim()) return Response.json({ error: "Name is required" }, { status: 400 });

  const [row] = await db
    .update(schema.insuranceCompany)
    .set({ name: name.trim() })
    .where(eq(schema.insuranceCompany.id, Number(id)))
    .returning();

  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(row);
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/settings/insurers/[id]">) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(session.user.role, "admin"))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;

  const refs = await db
    .select({ id: schema.lead.id })
    .from(schema.lead)
    .where(eq(schema.lead.currentInsurerId, Number(id)))
    .limit(1);
  if (refs.length)
    return Response.json({ error: "Cannot delete: insurer is referenced by leads" }, { status: 409 });

  const [row] = await db
    .delete(schema.insuranceCompany)
    .where(eq(schema.insuranceCompany.id, Number(id)))
    .returning();

  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
