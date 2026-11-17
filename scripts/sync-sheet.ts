/**
 * Brings the app up to date with the Sales Lead Mastersheet without wiping anything.
 *
 *   npm run db:sync -- "Sales Lead Mastersheet Updated.xlsx"           # show what would change
 *   npm run db:sync -- "Sales Lead Mastersheet Updated.xlsx" --apply   # make the changes
 *   add --details to list every change before applying
 *
 * Leads come from the IMPORTRANGE sheet, where every salesman's own sheet is consolidated.
 * A lead is matched by salesman, client name and start date (or by salesman and client name when
 * only the date changed). Matched leads take the sheet's values, new ones are added, and leads
 * that exist only in the app are kept and listed. Prospects from "Prospect Clients" that the app
 * does not have yet are added. Users, passwords and congratulations are never touched.
 */
import ExcelJS from "exceljs";
import { eq } from "drizzle-orm";
import { sameName } from "../src/lib/identity";
import { amount, type Cell, insurerName, isoDate, leadStatus, nameKey, text, yes } from "../src/lib/sheet-import";
import { db } from "../src/server/db";
import * as schema from "../src/server/db/schema";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const file = args.find((a) => !a.startsWith("--")) ?? "Sales Lead Mastersheet.xlsx";

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const sheet = (name: string) => {
  const ws = wb.getWorksheet(name);
  if (!ws) throw new Error(`Sheet "${name}" not found in ${file}`);
  return ws;
};
const cell = (row: ExcelJS.Row, col: number) => row.getCell(col).value as Cell;

// ── Reference data ───────────────────────────────────────────────────
const producers = await db.select({ id: schema.producer.id, name: schema.producer.name }).from(schema.producer);
const insurers = await db.select({ id: schema.insuranceCompany.id, name: schema.insuranceCompany.name }).from(schema.insuranceCompany);
const insurerId = new Map(insurers.map((i) => [i.name.toLowerCase(), i.id]));
const unknownInsurers = new Set<string>();
const unknownProducers = new Map<string, number>();

function producerId(name: string): number | undefined {
  const exact = producers.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());
  const match = exact ?? producers.find((p) => sameName(p.name, name));
  if (!match) unknownProducers.set(name, (unknownProducers.get(name) ?? 0) + 1);
  return match?.id;
}
function findInsurer(raw: string): number | null {
  if (!raw || raw === "-" || raw.toUpperCase() === "N/A") return null;
  const id = insurerId.get(insurerName(raw).toLowerCase());
  if (!id) unknownInsurers.add(raw);
  return id ?? null;
}

// ── Leads from IMPORTRANGE ───────────────────────────────────────────
type LeadValues = Omit<typeof schema.lead.$inferInsert, "id" | "createdAt" | "updatedAt" | "securedAt" | "celebratedAt" | "prospectClientId">;
const sheetLeads = new Map<string, LeadValues>();
let duplicateRows = 0;
let skippedRows = 0;

sheet("IMPORTRANGE").eachRow((row, idx) => {
  if (idx === 1) return;
  const producer = text(cell(row, 1));
  const prospectName = text(cell(row, 2));
  const startWorkingDate = isoDate(cell(row, 3));
  if (!producer || !prospectName) return;
  const pid = producerId(producer);
  if (!pid || !startWorkingDate) return void skippedRows++;
  const rfq = text(cell(row, 4)).toLowerCase();
  const cob = text(cell(row, 5)).toLowerCase();
  const commission = amount(cell(row, 10));
  const lead: LeadValues = {
    producerId: pid,
    prospectName,
    startWorkingDate,
    rfqType: rfq === "renewal" ? "Renewal" : "New",
    cob: cob === "medical" ? "Medical" : cob === "motor" ? "Motor" : "General",
    bor: yes(cell(row, 6)),
    quoted: yes(cell(row, 7)),
    status: leadStatus(cell(row, 8)),
    estimatedPremium: String(amount(cell(row, 9)) ?? 0),
    commission: commission === null ? null : String(commission),
    currentInsurerId: findInsurer(text(cell(row, 11))),
    city: text(cell(row, 12)) || "Jeddah",
    borTimestamp: isoDate(cell(row, 13)),
    quoteTimestamp: isoDate(cell(row, 14)),
    comments: text(cell(row, 15)) || null,
  };
  const key = `${pid}|${nameKey(prospectName)}|${startWorkingDate}`;
  // a lead listed twice keeps its first row, as the original import did
  if (sheetLeads.has(key)) return void duplicateRows++;
  sheetLeads.set(key, lead);
});

const dbLeads = await db.select().from(schema.lead);
const exactKey = (l: { producerId: number; prospectName: string; startWorkingDate: string }) => `${l.producerId}|${nameKey(l.prospectName)}|${l.startWorkingDate}`;
const looseKey = (l: { producerId: number; prospectName: string }) => `${l.producerId}|${nameKey(l.prospectName)}`;
const dbByExact = new Map(dbLeads.map((l) => [exactKey(l), l]));
const countBy = <T>(items: T[], key: (t: T) => string) => items.reduce((m, t) => m.set(key(t), (m.get(key(t)) ?? 0) + 1), new Map<string, number>());
const dbLooseCount = countBy(dbLeads, looseKey);
const sheetLooseCount = countBy([...sheetLeads.values()], (l) => looseKey(l as { producerId: number; prospectName: string }));

const COMPARED = ["startWorkingDate", "rfqType", "cob", "bor", "quoted", "status", "estimatedPremium", "commission", "currentInsurerId", "city", "borTimestamp", "quoteTimestamp", "comments"] as const;
// amounts are stored to 2 decimals, and a blank commission is the same as 0
const cents = (v: unknown) => Math.round(Number(v ?? 0) * 100);
const same = (field: string, a: unknown, b: unknown) =>
  field === "estimatedPremium" || field === "commission" ? cents(a) === cents(b) : (a ?? null) === (b ?? null);

const toInsert: LeadValues[] = [];
const toUpdate: { id: number; changes: Partial<LeadValues> }[] = [];
const fieldChanges = new Map<string, number>();
const matchedIds = new Set<number>();

for (const lead of sheetLeads.values()) {
  const l = lead as Required<LeadValues>;
  let existing = dbByExact.get(exactKey(l));
  // Same client for the same salesman, only once on each side: the start date was corrected.
  if (!existing && dbLooseCount.get(looseKey(l)) === 1 && sheetLooseCount.get(looseKey(l)) === 1)
    existing = dbLeads.find((d) => looseKey(d) === looseKey(l) && !matchedIds.has(d.id));
  if (!existing || matchedIds.has(existing.id)) {
    toInsert.push(lead);
    continue;
  }
  matchedIds.add(existing.id);
  const changes: Partial<LeadValues> = {};
  for (const f of COMPARED) {
    if (!same(f, existing[f], l[f])) {
      (changes as Record<string, unknown>)[f] = l[f];
      fieldChanges.set(f, (fieldChanges.get(f) ?? 0) + 1);
    }
  }
  if (Object.keys(changes).length) toUpdate.push({ id: existing.id, changes });
}
const appOnly = dbLeads.filter((l) => !matchedIds.has(l.id));

// ── Prospects from "Prospect Clients" ────────────────────────────────
const dbProspects = await db.select().from(schema.prospectClient);
const prospectKey = (p: { producerId: number; clientName: string; month: string | null }) => `${p.producerId}|${nameKey(p.clientName)}|${(p.month ?? "").trim().toLowerCase()}`;
const dbProspectByKey = new Map(dbProspects.map((p) => [prospectKey(p), p]));
const newProspects: (typeof schema.prospectClient.$inferInsert)[] = [];
const seenProspects = new Set<string>();

sheet("Prospect Clients").eachRow((row, idx) => {
  if (idx === 1) return;
  const producer = text(cell(row, 1));
  const clientName = text(cell(row, 2));
  if (!producer || !clientName) return;
  const pid = producerId(producer);
  if (!pid) return;
  const premiums = amount(cell(row, 3));
  const lobRaw = text(cell(row, 6)).toLowerCase();
  const values = {
    producerId: pid,
    clientName,
    month: text(cell(row, 4)) || null,
    premiums: premiums === null ? null : String(premiums),
    currentInsurerId: findInsurer(text(cell(row, 5))),
    lob: (lobRaw === "medical" ? "Medical" : lobRaw === "motor" ? "Motor" : lobRaw ? "General" : null) as "General" | "Medical" | "Motor" | null,
  };
  const key = prospectKey(values);
  if (seenProspects.has(key)) return;
  seenProspects.add(key);
  if (!dbProspectByKey.has(key)) newProspects.push({ ...values, status: "prospect" });
});

// ── Report ───────────────────────────────────────────────────────────
const nameOf = (id: number) => producers.find((p) => p.id === id)?.name ?? `#${id}`;
const perProducer = (items: { producerId: number }[]) =>
  [...countBy(items, (i) => nameOf(i.producerId))].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} ${c}`).join(", ") || "none";

console.log(`Sheet: ${file}`);
console.log(`\nLeads (IMPORTRANGE: ${sheetLeads.size} unique rows${duplicateRows ? `, ${duplicateRows} repeated rows ignored` : ""}${skippedRows ? `, ${skippedRows} without a date or known salesman skipped` : ""})`);
console.log(`  New:        ${toInsert.length}  (${perProducer(toInsert as { producerId: number }[])})`);
console.log(`  Updated:    ${toUpdate.length}  (${[...fieldChanges].map(([f, n]) => `${f} ${n}`).join(", ") || "no changes"})`);
console.log(`  Unchanged:  ${matchedIds.size - toUpdate.length}`);
console.log(`  Only in the app (kept): ${appOnly.length}  (${perProducer(appOnly)})`);
console.log(`\nProspects (Prospect Clients)`);
console.log(`  New: ${newProspects.length}  (${perProducer(newProspects as { producerId: number }[])})`);
if (args.includes("--details")) {
  const byId = new Map(dbLeads.map((l) => [l.id, l]));
  console.log("\nLead changes (app -> sheet):");
  for (const u of toUpdate) {
    const l = byId.get(u.id)!;
    const diff = Object.entries(u.changes).map(([f, v]) => `${f}: ${String(l[f as keyof typeof l])} -> ${String(v)}`);
    console.log(`  ${nameOf(l.producerId)} | ${l.prospectName} | ${diff.join("; ")}`);
  }
  console.log("\nNew leads:");
  for (const l of toInsert) console.log(`  ${nameOf(l.producerId)} | ${l.prospectName} | ${l.startWorkingDate} | ${l.status}`);
  console.log("\nOnly in the app:");
  for (const l of appOnly) console.log(`  ${nameOf(l.producerId)} | ${l.prospectName} | ${l.startWorkingDate} | ${l.status}`);
  console.log("\nNew prospects:");
  for (const p of newProspects) console.log(`  ${nameOf(p.producerId)} | ${p.clientName} | ${p.month ?? ""}`);
}
if (unknownProducers.size) console.log(`\nSalesmen in the sheet with no producer record (rows skipped): ${[...unknownProducers].map(([n, c]) => `${n} (${c})`).join(", ")}`);
if (unknownInsurers.size) console.log(`Insurers not in the app's list (left blank): ${[...unknownInsurers].join(", ")}`);

if (apply) {
  await db.transaction(async (tx) => {
    for (let i = 0; i < toInsert.length; i += 200) await tx.insert(schema.lead).values(toInsert.slice(i, i + 200));
    for (const u of toUpdate) {
      // a lead the sheet no longer has as Secured stops counting as a recorded win
      const secured = u.changes.status && u.changes.status !== "Secured" ? { securedAt: null, celebratedAt: null } : {};
      await tx.update(schema.lead).set({ ...u.changes, ...secured, updatedAt: new Date() }).where(eq(schema.lead.id, u.id));
    }
    for (let i = 0; i < newProspects.length; i += 200) await tx.insert(schema.prospectClient).values(newProspects.slice(i, i + 200));
  });
  console.log("\nApplied.");
} else {
  console.log("\nNothing changed. Run again with --apply to make these changes.");
}
await db.$client.end();
