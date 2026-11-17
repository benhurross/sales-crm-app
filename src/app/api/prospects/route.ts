import { asc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getSession } from "@/server/session";
import { apiError } from "@/server/api-error";

/** All prospects the user may see (a salesman sees their own), for one client-side table. */
export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return apiError(request, "unauthorized", 401);

  let producerFilter: number | undefined;
  if (session.user.role === "salesman") {
    const [myProducer] = await db
      .select({ id: schema.producer.id })
      .from(schema.producer)
      .where(eq(schema.producer.userId, session.user.id))
      .limit(1);
    if (!myProducer) return Response.json([]);
    producerFilter = myProducer.id;
  }

  const query = db
    .select({
      id: schema.prospectClient.id,
      producerId: schema.prospectClient.producerId,
      clientName: schema.prospectClient.clientName,
      premiums: schema.prospectClient.premiums,
      month: schema.prospectClient.month,
      currentInsurerId: schema.prospectClient.currentInsurerId,
      lob: schema.prospectClient.lob,
      status: schema.prospectClient.status,
      producerName: schema.producer.name,
      insurerName: schema.insuranceCompany.name,
    })
    .from(schema.prospectClient)
    .leftJoin(schema.producer, eq(schema.prospectClient.producerId, schema.producer.id))
    .leftJoin(schema.insuranceCompany, eq(schema.prospectClient.currentInsurerId, schema.insuranceCompany.id))
    .orderBy(asc(schema.prospectClient.clientName));

  return Response.json(producerFilter ? await query.where(eq(schema.prospectClient.producerId, producerFilter)) : await query);
}

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session) return apiError(request, "unauthorized", 401);

  const body = await request.json();
  const { producerId, clientName, premiums, month, currentInsurerId, lob } = body;

  if (!clientName)
    return apiError(request, "clientNameRequired", 400);

  let resolvedProducerId = producerId;
  if (session.user.role === "salesman") {
    const [myProducer] = await db
      .select({ id: schema.producer.id })
      .from(schema.producer)
      .where(eq(schema.producer.userId, session.user.id))
      .limit(1);
    if (!myProducer) return apiError(request, "noProducerProfile", 400);
    resolvedProducerId = myProducer.id;
  }

  if (!resolvedProducerId) return apiError(request, "producerRequired", 400);

  const [row] = await db
    .insert(schema.prospectClient)
    .values({
      producerId: Number(resolvedProducerId),
      clientName,
      premiums: premiums || null,
      month: month || null,
      currentInsurerId: currentInsurerId ? Number(currentInsurerId) : null,
      lob: lob || null,
    })
    .returning();

  return Response.json(row, { status: 201 });
}
