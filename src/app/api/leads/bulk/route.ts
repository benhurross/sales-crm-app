import { eq, inArray } from "drizzle-orm";
import { hasRole } from "@/lib/permissions";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getSession } from "@/server/session";

export async function PATCH(request: Request) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { ids, status } = (await request.json()) as { ids: number[]; status: string };
  if (!ids?.length || !status) return Response.json({ error: "ids and status are required" }, { status: 400 });
  if (!["Secured", "Pending", "Lost"].includes(status))
    return Response.json({ error: "Invalid status" }, { status: 400 });

  if (session.user.role === "salesman") {
    const [myProducer] = await db
      .select({ id: schema.producer.id })
      .from(schema.producer)
      .where(eq(schema.producer.userId, session.user.id))
      .limit(1);
    if (!myProducer) return Response.json({ error: "No producer profile" }, { status: 400 });
    const owned = await db
      .select({ id: schema.lead.id })
      .from(schema.lead)
      .where(eq(schema.lead.producerId, myProducer.id));
    const ownedIds = new Set(owned.map((r) => r.id));
    if (ids.some((id) => !ownedIds.has(id)))
      return Response.json({ error: "Forbidden" }, { status: 403 });
  } else if (!hasRole(session.user.role, "manager")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await db
    .update(schema.lead)
    .set({ status: status as "Secured" | "Pending" | "Lost", updatedAt: new Date() })
    .where(inArray(schema.lead.id, ids))
    .returning({ id: schema.lead.id });

  return Response.json({ updated: updated.length });
}
