import { eq } from "drizzle-orm";
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
      producerId: schema.lead.producerId,
      producerCode: schema.producer.code,
      producerName: schema.producer.name,
      status: schema.lead.status,
      estimatedPremium: schema.lead.estimatedPremium,
      bor: schema.lead.bor,
      startWorkingDate: schema.lead.startWorkingDate,
    })
    .from(schema.lead)
    .leftJoin(schema.producer, eq(schema.lead.producerId, schema.producer.id));

  const leads = producerFilter
    ? await leadsQuery.where(eq(schema.lead.producerId, producerFilter))
    : await leadsQuery;

  const producersQuery = db
    .select({
      id: schema.producer.id,
      code: schema.producer.code,
      name: schema.producer.name,
      annualTarget: schema.producer.annualTarget,
    })
    .from(schema.producer)
    .orderBy(schema.producer.name);
  const producers = producerFilter
    ? await producersQuery.where(eq(schema.producer.id, producerFilter))
    : await producersQuery;

  return Response.json({ leads, producers });
}
