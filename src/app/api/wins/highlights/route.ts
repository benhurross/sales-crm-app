import { eq } from "drizzle-orm";
import { producerBadges, winOfTheWeek } from "@/lib/badges";
import { hasRole } from "@/lib/permissions";
import { apiError } from "@/server/api-error";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getSession } from "@/server/session";

/**
 * Badges for every producer, the signed-in user's own badges, and the Win of the Week.
 * Salesmen see who won which client, but not the amount.
 */
export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return apiError(request, "unauthorized", 401);

  const [wins, producers] = await Promise.all([
    db
      .select({
        id: schema.lead.id,
        producerId: schema.lead.producerId,
        premium: schema.lead.estimatedPremium,
        securedAt: schema.lead.securedAt,
        client: schema.lead.prospectName,
        producer: schema.producer.name,
      })
      .from(schema.lead)
      .innerJoin(schema.producer, eq(schema.lead.producerId, schema.producer.id))
      .where(eq(schema.lead.status, "Secured")),
    db.select({ id: schema.producer.id, userId: schema.producer.userId, annualTarget: schema.producer.annualTarget }).from(schema.producer),
  ]);

  const secured = wins.map((w) => ({ ...w, premium: Number(w.premium) }));
  const badges = producerBadges(secured, new Map(producers.map((p) => [p.id, Number(p.annualTarget)])));
  const mine = producers.find((p) => p.userId === session.user.id);
  const top = winOfTheWeek(secured, new Date());

  const kudos = top
    ? await db
        .select({ id: schema.winKudos.id })
        .from(schema.winKudos)
        .where(eq(schema.winKudos.leadId, top.win.id))
    : [];

  return Response.json({
    badges: Object.fromEntries(badges),
    mine: mine ? (badges.get(mine.id) ?? []) : [],
    winOfTheWeek: top && {
      week: top.week,
      id: top.win.id,
      client: top.win.client,
      producer: top.win.producer,
      producerId: top.win.producerId,
      premium: hasRole(session.user.role, "manager") ? top.win.premium : null,
      securedAt: top.win.securedAt,
      isOwn: top.win.producerId === mine?.id,
      kudos: kudos.length,
    },
  });
}
