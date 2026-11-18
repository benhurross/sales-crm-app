import { eq } from "drizzle-orm";
import { hasRole } from "@/lib/permissions";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getSession } from "@/server/session";
import { apiError } from "@/server/api-error";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return apiError(request, "unauthorized", 401);

  const rows = await db.select().from(schema.producer).orderBy(schema.producer.name);
  return Response.json(rows);
}

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session) return apiError(request, "unauthorized", 401);
  if (!hasRole(session.user.role, "manager"))
    return apiError(request, "forbidden", 403);

  const body = await request.json();
  const { code, name, email, region, title, employmentStatus, joinDate, leavingDate, userId } = body;

  if (!code || !name) return apiError(request, "codeAndNameRequired", 400);

  const existing = await db.select({ id: schema.producer.id }).from(schema.producer).where(eq(schema.producer.code, code)).limit(1);
  if (existing.length) return apiError(request, "producerCodeExists", 409);

  const [row] = await db
    .insert(schema.producer)
    .values({
      code, name,
      email: email || null,
      region: region || "Jeddah",
      title: title || null,
      employmentStatus: employmentStatus || "Active",
      joinDate: joinDate || null,
      leavingDate: leavingDate || null,
      userId: userId || null,
    })
    .returning();

  return Response.json(row, { status: 201 });
}
