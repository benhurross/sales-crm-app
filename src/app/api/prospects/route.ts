import { eq, getTableColumns } from "drizzle-orm";
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
    if (!myProducer) return Response.json([]);
    producerFilter = myProducer.id;
  }

  const query = db
    .select({
      ...getTableColumns(schema.prospectClient),
      producerName: schema.producer.name,
      producerCode: schema.producer.code,
      insurerName: schema.insuranceCompany.name,
    })
    .from(schema.prospectClient)
    .leftJoin(schema.producer, eq(schema.prospectClient.producerId, schema.producer.id))
    .leftJoin(schema.insuranceCompany, eq(schema.prospectClient.currentInsurerId, schema.insuranceCompany.id));

  const rows = producerFilter
    ? await query.where(eq(schema.prospectClient.producerId, producerFilter))
    : await query;

  return Response.json(rows);
}

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { producerId, clientName, premiums, month, currentInsurerId, lob } = body;

  if (!clientName)
    return Response.json({ error: "Client name is required" }, { status: 400 });

  let resolvedProducerId = producerId;
  if (session.user.role === "salesman") {
    const [myProducer] = await db
      .select({ id: schema.producer.id })
      .from(schema.producer)
      .where(eq(schema.producer.userId, session.user.id))
      .limit(1);
    if (!myProducer) return Response.json({ error: "No producer profile linked" }, { status: 400 });
    resolvedProducerId = myProducer.id;
  }

  if (!resolvedProducerId) return Response.json({ error: "Producer is required" }, { status: 400 });

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
