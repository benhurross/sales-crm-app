import { eq } from "drizzle-orm";
import { hasRole } from "@/lib/permissions";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getSession } from "@/server/session";
import { apiError } from "@/server/api-error";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return apiError(request, "unauthorized", 401);

  const rows = await db
    .select()
    .from(schema.insuranceCompany)
    .orderBy(schema.insuranceCompany.name);

  return Response.json(rows);
}

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session) return apiError(request, "unauthorized", 401);
  if (!hasRole(session.user.role, "admin"))
    return apiError(request, "forbidden", 403);

  const { name } = await request.json();
  if (!name?.trim()) return apiError(request, "nameRequired", 400);

  const existing = await db
    .select({ id: schema.insuranceCompany.id })
    .from(schema.insuranceCompany)
    .where(eq(schema.insuranceCompany.name, name.trim()))
    .limit(1);
  if (existing.length)
    return apiError(request, "insurerExists", 409);

  const [row] = await db
    .insert(schema.insuranceCompany)
    .values({ name: name.trim() })
    .returning();

  return Response.json(row, { status: 201 });
}
