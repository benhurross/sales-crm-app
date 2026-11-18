import { count, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import type { DashboardLead } from "@/lib/dashboard";

export interface DashboardData {
  leads: DashboardLead[];
  producers: { id: number; code: string; name: string; annualTarget: string; employmentStatus: string }[];
  prospects: { producerId: number; total: number; converted: number; premiums: number }[];
}

/** Leads, producers and prospect counts a user may see: everything for managers, their own for salesmen. */
export async function loadDashboardData(user: { id: string; role?: string | null }): Promise<DashboardData> {
  let producerFilter: number | undefined;
  if (user.role === "salesman") {
    const [myProducer] = await db
      .select({ id: schema.producer.id })
      .from(schema.producer)
      .where(eq(schema.producer.userId, user.id))
      .limit(1);
    if (!myProducer) return { leads: [], producers: [], prospects: [] };
    producerFilter = myProducer.id;
  }

  const leadsQuery = db
    .select({
      id: schema.lead.id,
      producerId: schema.lead.producerId,
      prospectName: schema.lead.prospectName,
      startWorkingDate: schema.lead.startWorkingDate,
      rfqType: schema.lead.rfqType,
      cob: schema.lead.cob,
      status: schema.lead.status,
      estimatedPremium: schema.lead.estimatedPremium,
      city: schema.lead.city,
      bor: schema.lead.bor,
      quoted: schema.lead.quoted,
      commission: schema.lead.commission,
      quoteTimestamp: schema.lead.quoteTimestamp,
      producerName: schema.producer.name,
      producerCode: schema.producer.code,
    })
    .from(schema.lead)
    .leftJoin(schema.producer, eq(schema.lead.producerId, schema.producer.id));

  const producersQuery = db
    .select({
      id: schema.producer.id,
      code: schema.producer.code,
      name: schema.producer.name,
      annualTarget: schema.producer.annualTarget,
      employmentStatus: schema.producer.employmentStatus,
    })
    .from(schema.producer)
    .orderBy(schema.producer.name);

  const prospectsQuery = db
    .select({
      producerId: schema.prospectClient.producerId,
      total: count(),
      converted: count(sql`CASE WHEN ${schema.prospectClient.status} = 'converted' THEN 1 END`),
      premiums: sql<number>`coalesce(sum(${schema.prospectClient.premiums}), 0)::float`,
    })
    .from(schema.prospectClient)
    .groupBy(schema.prospectClient.producerId);

  const [leads, producers, prospects] = await Promise.all([
    producerFilter ? leadsQuery.where(eq(schema.lead.producerId, producerFilter)) : leadsQuery,
    producerFilter ? producersQuery.where(eq(schema.producer.id, producerFilter)) : producersQuery,
    producerFilter ? prospectsQuery.where(eq(schema.prospectClient.producerId, producerFilter)) : prospectsQuery,
  ]);

  return { leads, producers, prospects };
}
