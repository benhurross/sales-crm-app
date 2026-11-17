import { eq, ilike, and } from "drizzle-orm";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getSession } from "@/server/session";
import { apiError } from "@/server/api-error";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return apiError(request, "unauthorized", 401);

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return Response.json([]);

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

  const conditions = [ilike(schema.prospectClient.clientName, `%${q}%`)];
  if (producerFilter) conditions.push(eq(schema.prospectClient.producerId, producerFilter));

  const rows = await db
    .select({
      id: schema.prospectClient.id,
      clientName: schema.prospectClient.clientName,
      producerId: schema.prospectClient.producerId,
      premiums: schema.prospectClient.premiums,
      currentInsurerId: schema.prospectClient.currentInsurerId,
      lob: schema.prospectClient.lob,
      status: schema.prospectClient.status,
      producerName: schema.producer.name,
    })
    .from(schema.prospectClient)
    .leftJoin(schema.producer, eq(schema.prospectClient.producerId, schema.producer.id))
    .where(and(...conditions))
    .limit(20);

  return Response.json(rows);
}
