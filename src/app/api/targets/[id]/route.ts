import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { hasRole } from "@/lib/permissions";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getSession } from "@/server/session";

export async function PUT(request: NextRequest, ctx: RouteContext<"/api/targets/[id]">) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(session.user.role, "manager"))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const { annualTarget, monthlyTarget } = await request.json();

  const [row] = await db
    .update(schema.producer)
    .set({
      annualTarget: annualTarget ?? "0",
      monthlyTarget: monthlyTarget ?? "0",
      updatedAt: new Date(),
    })
    .where(eq(schema.producer.id, Number(id)))
    .returning();

  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(row);
}
