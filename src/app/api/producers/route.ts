import { eq } from "drizzle-orm";
import { hasRole } from "@/lib/permissions";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getSession } from "@/server/session";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.select().from(schema.producer).orderBy(schema.producer.name);
  return Response.json(rows);
}

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(session.user.role, "manager"))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { code, name, email, region, title, employmentStatus, joinDate, userId } = body;

  if (!code || !name) return Response.json({ error: "Code and name are required" }, { status: 400 });

  const existing = await db.select({ id: schema.producer.id }).from(schema.producer).where(eq(schema.producer.code, code)).limit(1);
  if (existing.length) return Response.json({ error: "Producer code already exists" }, { status: 409 });

  const [row] = await db
    .insert(schema.producer)
    .values({
      code, name,
      email: email || null,
      region: region || "Jeddah",
      title: title || null,
      employmentStatus: employmentStatus || "Active",
      joinDate: joinDate || null,
      userId: userId || null,
    })
    .returning();

  return Response.json(row, { status: 201 });
}
