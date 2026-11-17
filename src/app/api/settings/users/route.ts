import { eq } from "drizzle-orm";
import { hasRole } from "@/lib/permissions";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getSession } from "@/server/session";
import { apiError } from "@/server/api-error";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return apiError(request, "unauthorized", 401);
  if (!hasRole(session.user.role, "admin"))
    return apiError(request, "forbidden", 403);

  const users = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      role: schema.user.role,
      banned: schema.user.banned,
      banReason: schema.user.banReason,
      createdAt: schema.user.createdAt,
    })
    .from(schema.user)
    .orderBy(schema.user.name);

  return Response.json(users);
}

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session) return apiError(request, "unauthorized", 401);
  if (!hasRole(session.user.role, "admin"))
    return apiError(request, "forbidden", 403);

  const { name, email, password, role } = await request.json();

  if (!name || !email || !password)
    return apiError(request, "nameEmailPasswordRequired", 400);

  const existing = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1);
  if (existing.length)
    return apiError(request, "emailExists", 409);

  const created = await auth.api.createUser({
    body: { name, email, password, role: role || "salesman" },
  });

  return Response.json(
    { id: created.user.id, name: created.user.name, email: created.user.email, role: created.user.role },
    { status: 201 },
  );
}
