import { eq } from "drizzle-orm";
import { hasRole } from "@/lib/permissions";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getSession } from "@/server/session";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(schema.insuranceCompany)
    .orderBy(schema.insuranceCompany.name);

  return Response.json(rows);
}

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(session.user.role, "admin"))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const { name } = await request.json();
  if (!name?.trim()) return Response.json({ error: "Name is required" }, { status: 400 });

  const existing = await db
    .select({ id: schema.insuranceCompany.id })
    .from(schema.insuranceCompany)
    .where(eq(schema.insuranceCompany.name, name.trim()))
    .limit(1);
  if (existing.length)
    return Response.json({ error: "Insurance company already exists" }, { status: 409 });

  const [row] = await db
    .insert(schema.insuranceCompany)
    .values({ name: name.trim() })
    .returning();

  return Response.json(row, { status: 201 });
}
