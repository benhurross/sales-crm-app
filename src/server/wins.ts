import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import { formatAmount } from "@/lib/format";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { sendMail } from "@/server/mailer";

type Status = "Secured" | "Pending" | "Lost";

/**
 * Columns to set alongside a status change. The secured time is stamped only when a lead becomes
 * Secured (not when an already secured lead is edited) and cleared when it stops being Secured.
 */
export function securedColumns(status: Status | undefined) {
  if (status === undefined) return {};
  if (status !== "Secured") return { securedAt: null, celebratedAt: null };
  return {
    securedAt: sql`case when ${schema.lead.status} = 'Secured' then ${schema.lead.securedAt} else now() end`,
    celebratedAt: sql`case when ${schema.lead.status} = 'Secured' then ${schema.lead.celebratedAt} else null end`,
  };
}

/** Of `ids`, the leads that are not Secured yet, so would become new wins. */
export async function notYetSecured(ids: number[]): Promise<number[]> {
  if (!ids.length) return [];
  const rows = await db
    .select({ id: schema.lead.id })
    .from(schema.lead)
    .where(and(inArray(schema.lead.id, ids), ne(schema.lead.status, "Secured")));
  return rows.map((r) => r.id);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function winEmail(win: { producer: string; client: string; premium: number; cob: string; rfqType: string }, appUrl?: string) {
  const amount = formatAmount(Math.round(win.premium)).replace("\u{20C1}", "SAR");
  const link = appUrl ? `${appUrl.replace(/\/$/, "")}/leads` : undefined;
  return {
    subject: `Deal secured: ${win.producer} won ${win.client}`,
    text: `${win.producer} has just secured ${win.client} (${win.cob}, ${win.rfqType}) worth ${amount}.\n\nTake a moment to congratulate them.${link ? `\n\n${link}` : ""}`,
    html: `<div style="font-family:Arial,sans-serif;color:#1e2022;max-width:520px">
  <p style="font-size:13px;color:#0047ba;font-weight:bold;margin:0 0 8px">AP Plus Sales CRM</p>
  <h2 style="margin:0 0 12px;font-size:20px">${esc(win.producer)} secured a deal</h2>
  <table style="border-collapse:collapse;font-size:14px">
    <tr><td style="padding:4px 16px 4px 0;color:#6b7280">Client</td><td><b>${esc(win.client)}</b></td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#6b7280">Premium</td><td><b>${esc(amount)}</b></td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#6b7280">Class</td><td>${esc(win.cob)}, ${esc(win.rfqType)}</td></tr>
  </table>
  <p style="font-size:14px;margin:16px 0">Take a moment to congratulate them${link ? ` in the <a href="${esc(link)}" style="color:#0047ba">Sales CRM</a>` : ""}.</p>
</div>`,
  };
}

/** Emails every active manager about new wins. Runs in the background; failures are logged, never thrown. */
export function notifyManagers(leadIds: number[]) {
  if (!leadIds.length) return;
  void (async () => {
    const [wins, managers] = await Promise.all([
      db
        .select({
          client: schema.lead.prospectName,
          premium: schema.lead.estimatedPremium,
          cob: schema.lead.cob,
          rfqType: schema.lead.rfqType,
          producer: schema.producer.name,
        })
        .from(schema.lead)
        .innerJoin(schema.producer, eq(schema.lead.producerId, schema.producer.id))
        .where(and(inArray(schema.lead.id, leadIds), eq(schema.lead.status, "Secured"))),
      db
        .select({ email: schema.user.email })
        .from(schema.user)
        .where(and(eq(schema.user.role, "manager"), or(eq(schema.user.banned, false), sql`${schema.user.banned} is null`))),
    ]);
    const to = managers.map((m) => m.email);
    for (const w of wins) await sendMail({ to, ...winEmail({ ...w, premium: Number(w.premium) }, process.env.APP_URL) });
  })().catch((err) => console.error("Win email failed:", err));
}
