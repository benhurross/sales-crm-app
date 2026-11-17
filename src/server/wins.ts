import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import { direction, type Locale } from "@/i18n/config";
import { translator } from "@/i18n/server";
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

const numberFmt = new Intl.NumberFormat("en-US");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

type WinDetails = { producer: string; client: string; premium: number; cob: string; rfqType: string };

/** One language's part of the email, in that language's direction. */
function emailSection(win: WinDetails, locale: Locale, link?: string) {
  const t = translator(locale);
  const amount = t("email.amount", { amount: numberFmt.format(Math.round(win.premium)) });
  const kind = `${t(`cob.${win.cob}`)}, ${t(`rfq.${win.rfqType}`)}`;
  const label = `padding:4px 0;padding-inline-end:16px;color:#6b7280`;
  return {
    subject: t("email.subject", { producer: win.producer, client: win.client }),
    text: `${t("email.body", { producer: win.producer, client: win.client, kind, amount })}\n${t("email.congratulate")}${link ? `\n${link}` : ""}`,
    html: `<div dir="${direction(locale)}" lang="${locale}" style="text-align:start">
  <h2 style="margin:0 0 12px;font-size:20px">${esc(t("email.heading", { producer: win.producer }))}</h2>
  <table style="border-collapse:collapse;font-size:14px">
    <tr><td style="${label}">${esc(t("email.client"))}</td><td><b>${esc(win.client)}</b></td></tr>
    <tr><td style="${label}">${esc(t("email.premium"))}</td><td><b>${esc(amount)}</b></td></tr>
    <tr><td style="${label}">${esc(t("email.class"))}</td><td>${esc(kind)}</td></tr>
  </table>
  <p style="font-size:14px;margin:16px 0">${esc(t("email.congratulate"))}${link ? ` <a href="${esc(link)}" style="color:#0047ba">${esc(t("email.open"))}</a>` : ""}</p>
</div>`,
  };
}

/**
 * The win email, in English then Arabic: managers choose their language in their own browser,
 * so the server cannot know which one each reader prefers.
 */
export function winEmail(win: WinDetails, appUrl?: string) {
  const link = appUrl ? `${appUrl.replace(/\/$/, "")}/leads` : undefined;
  const en = emailSection(win, "en", link);
  const ar = emailSection(win, "ar", link);
  return {
    subject: `${en.subject} | ${ar.subject}`,
    text: `${en.text}\n\n----\n\n${ar.text}`,
    html: `<div style="font-family:Arial,Tahoma,sans-serif;color:#1e2022;max-width:520px">
  <p style="font-size:13px;color:#0047ba;font-weight:bold;margin:0 0 8px">AP Plus Sales CRM</p>
  ${en.html}
  <hr style="border:none;border-top:1px solid #e5e9f0;margin:20px 0">
  ${ar.html}
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
