import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { hasRole } from "@/lib/permissions";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getSession } from "@/server/session";
import { apiError } from "@/server/api-error";

export async function PUT(request: NextRequest, ctx: RouteContext<"/api/targets/[id]">) {
  const session = await getSession(request);
  if (!session) return apiError(request, "unauthorized", 401);
  if (!hasRole(session.user.role, "manager"))
    return apiError(request, "forbidden", 403);

  const { id } = await ctx.params;
  const { annualTarget } = await request.json();

  const [row] = await db
    .update(schema.producer)
    .set({
      annualTarget: annualTarget ?? "0",
      updatedAt: new Date(),
    })
    .where(eq(schema.producer.id, Number(id)))
    .returning();

  if (!row) return apiError(request, "notFound", 404);
  return Response.json(row);
}
