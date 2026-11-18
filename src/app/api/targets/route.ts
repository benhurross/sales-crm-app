import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getSession } from "@/server/session";
import { apiError } from "@/server/api-error";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return apiError(request, "unauthorized", 401);

  const secured = db
    .select({
      producerId: schema.lead.producerId,
      securedPremium: sql<string>`coalesce(sum(case when ${schema.lead.status} = 'Secured' then ${schema.lead.estimatedPremium} else 0 end), 0)`.as("secured_premium"),
      securedCount: sql<number>`count(case when ${schema.lead.status} = 'Secured' then 1 end)::int`.as("secured_count"),
      totalLeads: sql<number>`count(*)::int`.as("total_leads"),
    })
    .from(schema.lead)
    .groupBy(schema.lead.producerId)
    .as("secured");

  const rows = await db
    .select({
      id: schema.producer.id,
      code: schema.producer.code,
      name: schema.producer.name,
      region: schema.producer.region,
      employmentStatus: schema.producer.employmentStatus,
      leavingDate: schema.producer.leavingDate,
      annualTarget: schema.producer.annualTarget,
      monthlyTarget: schema.producer.monthlyTarget,
      securedPremium: sql<string>`coalesce(${secured.securedPremium}, '0')`,
      securedCount: sql<number>`coalesce(${secured.securedCount}, 0)`,
      totalLeads: sql<number>`coalesce(${secured.totalLeads}, 0)`,
    })
    .from(schema.producer)
    .leftJoin(secured, eq(schema.producer.id, secured.producerId))
    .orderBy(schema.producer.name);

  if (session.user.role === "salesman") {
    const [myProducer] = await db
      .select({ id: schema.producer.id })
      .from(schema.producer)
      .where(eq(schema.producer.userId, session.user.id))
      .limit(1);
    if (!myProducer) return Response.json([]);
    return Response.json(rows.filter((r) => r.id === myProducer.id));
  }

  return Response.json(rows);
}
