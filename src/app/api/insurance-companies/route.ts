import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getSession } from "@/server/session";
import { hasRole } from "@/lib/permissions";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.select().from(schema.insuranceCompany).orderBy(schema.insuranceCompany.name);
  return Response.json(rows);
}

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(session.user.role, "manager"))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const { name } = await request.json();
  if (!name) return Response.json({ error: "Name is required" }, { status: 400 });

  const [row] = await db.insert(schema.insuranceCompany).values({ name }).returning();
  return Response.json(row, { status: 201 });
}
