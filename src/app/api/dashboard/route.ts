import { eq, count, sql } from "drizzle-orm";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getSession } from "@/server/session";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let producerFilter: number | undefined;
  if (session.user.role === "salesman") {
    const [myProducer] = await db
      .select({ id: schema.producer.id })
      .from(schema.producer)
      .where(eq(schema.producer.userId, session.user.id))
      .limit(1);
    if (!myProducer) return Response.json({ leads: [], producers: [] });
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
      producerName: schema.producer.name,
      producerCode: schema.producer.code,
    })
    .from(schema.lead)
    .leftJoin(schema.producer, eq(schema.lead.producerId, schema.producer.id));

  const leads = producerFilter
    ? await leadsQuery.where(eq(schema.lead.producerId, producerFilter))
    : await leadsQuery;

  const producers = await db
    .select({
      id: schema.producer.id,
      code: schema.producer.code,
      name: schema.producer.name,
      annualTarget: schema.producer.annualTarget,
    })
    .from(schema.producer)
    .orderBy(schema.producer.name);

  const prospectStatsQuery = db
    .select({
      total: count(),
      converted: count(sql`CASE WHEN ${schema.prospectClient.status} = 'converted' THEN 1 END`),
    })
    .from(schema.prospectClient);

  const [prospectStats] = producerFilter
    ? await prospectStatsQuery.where(eq(schema.prospectClient.producerId, producerFilter))
    : await prospectStatsQuery;

  return Response.json({
    leads,
    producers,
    prospects: {
      total: prospectStats?.total ?? 0,
      converted: prospectStats?.converted ?? 0,
    },
  });
}
