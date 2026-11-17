import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { hasRole } from "@/lib/permissions";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getSession } from "@/server/session";
import { apiError } from "@/server/api-error";

export async function PUT(request: NextRequest, ctx: RouteContext<"/api/settings/users/[id]">) {
  const session = await getSession(request);
  if (!session) return apiError(request, "unauthorized", 401);
  if (!hasRole(session.user.role, "admin"))
    return apiError(request, "forbidden", 403);

  const { id } = await ctx.params;
  const { name, email, role, banned, banReason, password } = await request.json();

  const [existing] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.id, id))
    .limit(1);
  if (!existing) return apiError(request, "userNotFound", 404);

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (role !== undefined) updates.role = role;
  if (banned !== undefined) updates.banned = banned;
  if (banReason !== undefined) updates.banReason = banReason || null;

  const [row] = await db.update(schema.user).set(updates).where(eq(schema.user.id, id)).returning({
    id: schema.user.id,
    name: schema.user.name,
    email: schema.user.email,
    role: schema.user.role,
    banned: schema.user.banned,
    banReason: schema.user.banReason,
  });

  if (password) {
    const ctx = await auth.$context;
    const hash = await ctx.password.hash(password);
    await db
      .update(schema.account)
      .set({ password: hash, updatedAt: new Date() })
      .where(eq(schema.account.userId, id));
  }

  return Response.json(row);
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/settings/users/[id]">) {
  const session = await getSession(request);
  if (!session) return apiError(request, "unauthorized", 401);
  if (!hasRole(session.user.role, "admin"))
    return apiError(request, "forbidden", 403);

  const { id } = await ctx.params;

  if (id === session.user.id)
    return apiError(request, "cannotDeleteSelf", 400);

  // The producer and its leads stay; only the login is removed.
  const row = await db.transaction(async (tx) => {
    await tx.update(schema.producer).set({ userId: null }).where(eq(schema.producer.userId, id));
    const [deleted] = await tx.delete(schema.user).where(eq(schema.user.id, id)).returning({ id: schema.user.id });
    return deleted;
  });

  if (!row) return apiError(request, "notFound", 404);
  return Response.json({ ok: true });
}
