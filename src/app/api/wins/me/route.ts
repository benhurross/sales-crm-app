import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { celebrationFor } from "@/lib/celebration";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getSession } from "@/server/session";

async function myProducer(userId: string) {
  const [p] = await db
    .select({ id: schema.producer.id, annualTarget: schema.producer.annualTarget })
    .from(schema.producer)
    .where(eq(schema.producer.userId, userId))
    .limit(1);
  return p;
}

/** The signed-in salesman's wins they have not celebrated yet, and congratulations they have not seen. */
export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const producer = await myProducer(session.user.id);
  if (!producer) return Response.json({ celebrations: [], kudos: [] });

  const [wins, kudos] = await Promise.all([
    db
      .select({
        id: schema.lead.id,
        client: schema.lead.prospectName,
        premium: schema.lead.estimatedPremium,
        securedAt: schema.lead.securedAt,
        celebratedAt: schema.lead.celebratedAt,
      })
      .from(schema.lead)
      .where(and(eq(schema.lead.producerId, producer.id), eq(schema.lead.status, "Secured")))
      .orderBy(asc(schema.lead.securedAt)),
    db
      .select({ id: schema.winKudos.id, from: schema.user.name, message: schema.winKudos.message, client: schema.lead.prospectName })
      .from(schema.winKudos)
      .innerJoin(schema.lead, eq(schema.winKudos.leadId, schema.lead.id))
      .innerJoin(schema.user, eq(schema.winKudos.userId, schema.user.id))
      .where(and(eq(schema.lead.producerId, producer.id), isNull(schema.winKudos.seenAt))),
  ]);

  const all = wins.map((w) => ({ id: w.id, premium: Number(w.premium), securedAt: w.securedAt }));
  const celebrations = wins
    .filter((w) => w.securedAt && !w.celebratedAt)
    .map((w) => ({
      id: w.id,
      client: w.client,
      premium: Number(w.premium),
      ...celebrationFor(
        { premium: Number(w.premium), securedAt: w.securedAt! },
        all.filter((o) => o.id !== w.id),
        Number(producer.annualTarget),
      ),
    }));

  return Response.json({ celebrations, kudos });
}

/** Marks celebrations and congratulations as seen. Body: { celebrated?: number[], kudosSeen?: number[] } */
export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const producer = await myProducer(session.user.id);
  if (!producer) return Response.json({ ok: true });

  const { celebrated = [], kudosSeen = [] } = (await request.json()) as { celebrated?: number[]; kudosSeen?: number[] };
  const now = new Date();
  if (celebrated.length)
    await db
      .update(schema.lead)
      .set({ celebratedAt: now })
      .where(and(inArray(schema.lead.id, celebrated), eq(schema.lead.producerId, producer.id), isNotNull(schema.lead.securedAt)));
  if (kudosSeen.length) {
    const mine = db.select({ id: schema.lead.id }).from(schema.lead).where(eq(schema.lead.producerId, producer.id));
    await db
      .update(schema.winKudos)
      .set({ seenAt: now })
      .where(and(inArray(schema.winKudos.id, kudosSeen), inArray(schema.winKudos.leadId, mine)));
  }
  return Response.json({ ok: true });
}
