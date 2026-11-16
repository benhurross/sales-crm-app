import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { generateExcel } from "@/server/exports/excel";
import { generatePdf } from "@/server/exports/pdf";
import { buildProducerReport, summarizeReport, type ReportLead } from "@/lib/reports";
import { getSession } from "@/server/session";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "excel";
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const producerParam = url.searchParams.get("producer") ?? undefined;
  const statusParam = url.searchParams.get("status") ?? undefined;

  let producerFilter: number | undefined;
  if (session.user.role === "salesman") {
    const [myProducer] = await db
      .select({ id: schema.producer.id })
      .from(schema.producer)
      .where(eq(schema.producer.userId, session.user.id))
      .limit(1);
    if (!myProducer)
      return new Response("No data", { status: 404 });
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

  let leads = producerFilter
    ? await leadsQuery.where(eq(schema.lead.producerId, producerFilter))
    : await leadsQuery;

  if (from) leads = leads.filter((l) => l.startWorkingDate && l.startWorkingDate >= from);
  if (to) leads = leads.filter((l) => l.startWorkingDate && l.startWorkingDate <= to);
  if (producerParam) leads = leads.filter((l) => l.producerId === Number(producerParam));
  if (statusParam) leads = leads.filter((l) => l.status === statusParam);

  const producers = await db
    .select({
      id: schema.producer.id,
      code: schema.producer.code,
      name: schema.producer.name,
      annualTarget: schema.producer.annualTarget,
    })
    .from(schema.producer)
    .orderBy(schema.producer.name);

  const rows = buildProducerReport(leads as ReportLead[], producers);
  const summary = summarizeReport(rows);

  const producerName = producerParam
    ? producers.find((p) => p.id === Number(producerParam))?.name
    : undefined;

  const filters = { from, to, producer: producerName, status: statusParam };

  if (type === "pdf") {
    let pdf: Buffer;
    try {
      pdf = await generatePdf(rows, summary, filters);
    } catch (err) {
      console.error(err);
      return Response.json({ error: `PDF export failed: ${(err as Error).message.split("\n")[0]}` }, { status: 500 });
    }
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="sales-report.pdf"',
      },
    });
  }

  const excel = await generateExcel(rows, summary, filters);
  return new Response(new Uint8Array(excel), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="sales-report.xlsx"',
    },
  });
}
