import { eq, getTableColumns } from "drizzle-orm";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getSession } from "@/server/session";
import { notifyManagers } from "@/server/wins";
import { apiError } from "@/server/api-error";

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
      ...getTableColumns(schema.lead),
      producerName: schema.producer.name,
      producerCode: schema.producer.code,
      insurerName: schema.insuranceCompany.name,
    })
    .from(schema.lead)
    .leftJoin(schema.producer, eq(schema.lead.producerId, schema.producer.id))
    .leftJoin(schema.insuranceCompany, eq(schema.lead.currentInsurerId, schema.insuranceCompany.id));

  const rows = producerFilter
    ? await query.where(eq(schema.lead.producerId, producerFilter))
    : await query;

  return Response.json(rows);
}

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session) return apiError(request, "unauthorized", 401);

  const body = await request.json();
  const {
    producerId, prospectName, startWorkingDate, rfqType, cob,
    bor, quoted, status, estimatedPremium, commission,
    currentInsurerId, city, borTimestamp, quoteTimestamp, comments,
    prospectClientId,
  } = body;

  if (!prospectName || !startWorkingDate || !rfqType || !cob)
    return apiError(request, "missingFields", 400);

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
    .insert(schema.lead)
    .values({
      producerId: resolvedProducerId,
      prospectName,
      startWorkingDate,
      rfqType,
      cob,
      bor: bor ?? false,
      quoted: quoted ?? false,
      status: status ?? "Pending",
      estimatedPremium: estimatedPremium || "0",
      commission: commission || null,
      currentInsurerId: currentInsurerId || null,
      city: city ?? "Jeddah",
      borTimestamp: borTimestamp || null,
      quoteTimestamp: quoteTimestamp || null,
      comments: comments || null,
      prospectClientId: prospectClientId ? Number(prospectClientId) : null,
      securedAt: status === "Secured" ? new Date() : null,
    })
    .returning();

  if (row.status === "Secured") notifyManagers([row.id]);

  if (prospectClientId) {
    await db
      .update(schema.prospectClient)
      .set({ status: "converted", updatedAt: new Date() })
      .where(eq(schema.prospectClient.id, Number(prospectClientId)));
  }

  return Response.json(row, { status: 201 });
}
