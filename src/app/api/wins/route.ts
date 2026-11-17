import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { hasRole } from "@/lib/permissions";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getSession } from "@/server/session";
import { apiError } from "@/server/api-error";

/** Recent wins for the whole team. Salesmen see who won which client, but not the amount. */
export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return apiError(request, "unauthorized", 401);
  const showAmounts = hasRole(session.user.role, "manager");

  const wins = await db
    .select({
      id: schema.lead.id,
      client: schema.lead.prospectName,
      premium: schema.lead.estimatedPremium,
      cob: schema.lead.cob,
      securedAt: schema.lead.securedAt,
      producer: schema.producer.name,
      ownerId: schema.producer.userId,
    })
    .from(schema.lead)
    .innerJoin(schema.producer, eq(schema.lead.producerId, schema.producer.id))
    .where(and(eq(schema.lead.status, "Secured"), isNotNull(schema.lead.securedAt)))
    .orderBy(desc(schema.lead.securedAt))
    .limit(12);

  const kudos = wins.length
    ? await db
        .select({ leadId: schema.winKudos.leadId, userId: schema.winKudos.userId, name: schema.user.name, message: schema.winKudos.message })
        .from(schema.winKudos)
        .innerJoin(schema.user, eq(schema.winKudos.userId, schema.user.id))
        .where(inArray(schema.winKudos.leadId, wins.map((w) => w.id)))
    : [];

  return Response.json(
    wins.map(({ ownerId, premium, ...w }) => {
      const mine = kudos.filter((k) => k.leadId === w.id);
      return {
        ...w,
        premium: showAmounts ? Number(premium) : null,
        isOwn: ownerId === session.user.id,
        congratulated: mine.some((k) => k.userId === session.user.id),
        kudos: mine.map((k) => ({ name: k.name, message: k.message })),
      };
    }),
  );
}
