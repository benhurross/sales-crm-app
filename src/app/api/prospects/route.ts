import { type AnyColumn, and, asc, count, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
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
    if (!myProducer) return Response.json({ rows: [], total: 0 });
    producerFilter = myProducer.id;
  }

  const params = new URL(request.url).searchParams;
  const page = Math.max(0, Number(params.get("page")) || 0);
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize")) || 25));
  const q = params.get("q")?.trim();
  const lob = params.get("lob");
  const status = params.get("status");
  const sortColumn = SORT_COLUMNS[params.get("sort") ?? ""] ?? schema.prospectClient.clientName;
  const order = params.get("dir") === "desc" ? sql`${sortColumn} desc nulls last` : sql`${sortColumn} asc nulls last`;

  const where = and(
    producerFilter ? eq(schema.prospectClient.producerId, producerFilter) : undefined,
    lob ? eq(schema.prospectClient.lob, lob as "General" | "Medical" | "Motor") : undefined,
    status ? eq(schema.prospectClient.status, status as "prospect" | "converted" | "inactive") : undefined,
    q
      ? or(
          ilike(schema.prospectClient.clientName, `%${q}%`),
          ilike(schema.producer.name, `%${q}%`),
          ilike(schema.insuranceCompany.name, `%${q}%`),
        )
      : undefined,
  );

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        ...getTableColumns(schema.prospectClient),
        producerName: schema.producer.name,
        insurerName: schema.insuranceCompany.name,
      })
      .from(schema.prospectClient)
      .leftJoin(schema.producer, eq(schema.prospectClient.producerId, schema.producer.id))
      .leftJoin(schema.insuranceCompany, eq(schema.prospectClient.currentInsurerId, schema.insuranceCompany.id))
      .where(where)
      .orderBy(order, asc(schema.prospectClient.id))
      .limit(pageSize)
      .offset(page * pageSize),
    db
      .select({ total: count() })
      .from(schema.prospectClient)
      .leftJoin(schema.producer, eq(schema.prospectClient.producerId, schema.producer.id))
      .leftJoin(schema.insuranceCompany, eq(schema.prospectClient.currentInsurerId, schema.insuranceCompany.id))
      .where(where),
  ]);

  return Response.json({ rows, total });
}

const SORT_COLUMNS: Record<string, AnyColumn> = {
  clientName: schema.prospectClient.clientName,
  producer: schema.producer.name,
  premiums: schema.prospectClient.premiums,
  month: schema.prospectClient.month,
  lob: schema.prospectClient.lob,
  insurerName: schema.insuranceCompany.name,
  status: schema.prospectClient.status,
};

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
