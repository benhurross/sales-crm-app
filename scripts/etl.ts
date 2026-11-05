/**
 * ETL: Import from Sales Lead Mastersheet.xlsx + SupportingFiles/
 *
 * Usage: npm run etl
 *
 * Sources:
 *   - SupportingFiles/AP Sales - *.xlsx → individual lead files (primary)
 *   - Sales Lead Mastersheet.xlsx → Main Data (supplementary), Targets, Salesman Target, Prospect Clients
 *   - SupportingFiles/SalesmenList.xlsx → user emails
 *
 * Clears existing data before importing (idempotent).
 */

import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { sql } from "drizzle-orm";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

const ROOT = process.cwd();
const MASTERSHEET = join(ROOT, "Sales Lead Mastersheet.xlsx");
const SALESMEN_LIST = join(ROOT, "SupportingFiles/SalesmenList.xlsx");
const SUPPORTING = join(ROOT, "SupportingFiles");

// ── Helpers ──────────────────────────────────────────────────────────

function str(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object" && "result" in v) return str((v as { result: ExcelJS.CellValue }).result);
  if (typeof v === "object" && "richText" in v) {
    return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("").trim();
  }
  return String(v).trim();
}

function num(v: ExcelJS.CellValue): number {
  const s = str(v).replace(/,/g, "").replace(/\./g, (m, i, full) => {
    // Handle "4.500.000" style (European thousands separator)
    const dots = (full.match(/\./g) || []).length;
    return dots > 1 ? "" : m;
  });
  if (!s || s === "-" || s === "#NAME?" || s === "N/A") return 0;
  const n = Number(s);
  return Number.isNaN(n) ? 0 : n;
}

function dateStr(v: ExcelJS.CellValue): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object" && "result" in v) return dateStr((v as { result: ExcelJS.CellValue }).result);
  const s = String(v).trim();
  if (!s || s === "#NAME?" || s === "#VALUE!") return null;
  const n = Number(s);
  if (!Number.isNaN(n) && n > 30000 && n < 60000) {
    const d = new Date((n - 25569) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function toBool(v: ExcelJS.CellValue): boolean {
  if (v === true) return true;
  const s = str(v).toLowerCase();
  return s === "true" || s === "✅" || s === "yes" || s === "1";
}

type EmploymentStatus = "Active" | "Resigned" | "Transferred";
function normalizeEmployment(v: string): EmploymentStatus {
  const s = v.trim().toLowerCase();
  if (s === "active") return "Active";
  if (s === "transferred" || s === "transfered") return "Transferred";
  return "Resigned";
}

type LeadStatus = "Secured" | "Pending" | "Lost";
function normalizeStatus(v: string): LeadStatus {
  const s = v.trim().toLowerCase();
  if (s === "secured") return "Secured";
  if (s === "lost") return "Lost";
  return "Pending";
}

function normalizeInsurer(name: string): string {
  const map: Record<string, string> = {
    "bupa": "Bupa Arabia",
    "bupa arabia": "Bupa Arabia",
    "cigna": "CIGNA",
    "watanyah": "Wataniya",
    "wataniya": "Wataniya",
    "mutakamilah": "Mutakamelah",
    "mutakamelah": "Mutakamelah",
    "al rajihi": "Al Rajhi Takaful",
    "takaful al rajhi": "Al Rajhi Takaful",
    "gig": "GIG",
    "acig": "ACIG",
    "al sagr": "Al Sagr",
    "medgulf": "Medgulf",
    "tawuniya": "Tawuniya",
    "saudi enaya": "Saudi Enaya",
    "liva": "Liva",
    "walaa": "Walaa",
    "gulf union": "Gulf Union",
    "uca": "UCA",
    "chubb": "CHUBB",
    "salama": "Salama",
    "sanad": "Sanad",
    "trade union": "Trade Union",
    "arabian shield": "Arabian Shield",
    "broker": "Broker",
    "oriant - exellence": "Orient Excellence",
    "amana": "Amana",
  };
  const key = name.trim().toLowerCase();
  return map[key] ?? name.trim();
}

function regionFromCode(code: string): string {
  return code.startsWith("R") ? "Riyadh" : "Jeddah";
}

// Cell value extractor — ExcelJS getCell returns Cell objects, not CellValue
function cv(row: ExcelJS.Row, col: number): ExcelJS.CellValue {
  return row.getCell(col).value;
}

// ── Read Excel ───────────────────────────────────────────────────────

async function readSheet(path: string, sheetName: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.getWorksheet(sheetName);
  if (!ws) throw new Error(`Sheet "${sheetName}" not found in ${path}`);
  return ws;
}

// ── Main ─────────────────────────────────────────────────────────────

console.log("ETL: Starting import...\n");

// 1. Read SalesmenList
console.log("Reading SalesmenList.xlsx...");
const salesmenSheet = await readSheet(SALESMEN_LIST, "Sheet1");
const salesmenEmails = new Map<string, string>();
salesmenSheet.eachRow((row, idx) => {
  if (idx === 1) return;
  const name = str(cv(row, 1));
  const email = str(cv(row, 2));
  if (name && email) salesmenEmails.set(name, email);
});
console.log(`  ${salesmenEmails.size} salesmen with emails\n`);

// 2. Read Targets sheet (producer metadata)
console.log("Reading Targets sheet...");
const targetsSheet = await readSheet(MASTERSHEET, "Targets");
interface TargetInfo {
  name: string;
  employment: EmploymentStatus;
  region: string;
  title: string;
  target: number;
}
const targetsByName = new Map<string, TargetInfo>();
targetsSheet.eachRow((row, idx) => {
  if (idx <= 2) return;
  const sno = str(cv(row, 1));
  if (!sno || sno === "Rank") return;
  const name = str(cv(row, 2));
  if (!name || targetsByName.has(name)) return;
  targetsByName.set(name, {
    name,
    employment: normalizeEmployment(str(cv(row, 3))),
    region: str(cv(row, 4)) || "Jeddah",
    title: str(cv(row, 5)),
    target: num(cv(row, 7)),
  });
});
console.log(`  ${targetsByName.size} producers from Targets\n`);

// 3. Read Salesman Target (codes, annual targets, join dates)
console.log("Reading Salesman Target sheet...");
const salesmanTargetSheet = await readSheet(MASTERSHEET, "Salesman Target");
interface SalesmanTarget {
  code: string;
  name: string;
  annualTarget: number;
  monthlyTarget: number;
  joinDate: string | null;
}
const salesmanTargets: SalesmanTarget[] = [];
salesmanTargetSheet.eachRow((row, idx) => {
  if (idx === 1) return;
  const code = str(cv(row, 1));
  const name = str(cv(row, 2));
  if (!code || !name) return;
  salesmanTargets.push({
    code,
    name,
    annualTarget: num(cv(row, 3)),
    monthlyTarget: num(cv(row, 4)),
    joinDate: dateStr(cv(row, 5)),
  });
});
console.log(`  ${salesmanTargets.length} coded salesmen\n`);

// 4. Collect producer names from all sources
const codeByName = new Map(salesmanTargets.map((s) => [s.name, s.code]));
const stByName = new Map(salesmanTargets.map((s) => [s.name, s]));
const allProducerNames = new Set<string>();

// From Targets sheet
for (const name of targetsByName.keys()) allProducerNames.add(name);

// From SalesmenList
for (const name of salesmenEmails.keys()) allProducerNames.add(name);

// From individual AP Sales files
const apSalesFiles = readdirSync(SUPPORTING).filter((f) => f.startsWith("AP Sales"));
for (const f of apSalesFiles) {
  const match = f.match(/AP Sales - (.+)\.xlsx$/);
  if (match) allProducerNames.add(match[1]);
}

// From Main Data (mastersheet, formula cached values)
console.log("Reading Main Data for producers...");
const mainSheet = await readSheet(MASTERSHEET, "Main Data");
mainSheet.eachRow((row, idx) => {
  if (idx === 1) return;
  const name = str(cv(row, 1));
  if (name) allProducerNames.add(name);
});

// From Prospect Clients (may contain producers not in the other sheets)
const prospectSheet = await readSheet(MASTERSHEET, "Prospect Clients");
prospectSheet.eachRow((row, idx) => {
  if (idx === 1) return;
  const name = str(cv(row, 1));
  if (name) allProducerNames.add(name);
});

// Build producer list with codes
let jSeq = 10, rSeq = 10;
const producerList: {
  code: string;
  name: string;
  email: string;
  employment: EmploymentStatus;
  region: string;
  title: string;
  annualTarget: number;
  monthlyTarget: number;
  joinDate: string | null;
}[] = [];

for (const name of allProducerNames) {
  let code = codeByName.get(name);
  const info = targetsByName.get(name);
  const st = stByName.get(name);
  const region = info?.region || (code ? regionFromCode(code) : "Jeddah");

  if (!code) {
    const prefix = region === "Riyadh" ? "R" : "J";
    const seq = prefix === "R" ? rSeq++ : jSeq++;
    code = `${prefix}-${seq}`;
  }

  producerList.push({
    code,
    name,
    email: salesmenEmails.get(name) ?? "",
    employment: info?.employment ?? "Active",
    region,
    title: info?.title ?? "",
    annualTarget: st?.annualTarget ?? info?.target ?? 0,
    monthlyTarget: st?.monthlyTarget ?? 0,
    joinDate: st?.joinDate ?? null,
  });
}
producerList.sort((a, b) => a.code.localeCompare(b.code));
console.log(`  ${producerList.length} total producers\n`);

// 5. Collect all insurance company names from all sources
console.log("Collecting insurance companies...");
const insurerNames = new Set<string>();

function collectInsurer(v: string) {
  if (v && v !== "-" && v !== "N/A" && v !== "#NAME?" && v !== "#VALUE!") {
    insurerNames.add(normalizeInsurer(v));
  }
}

// From mastersheet Main Data
mainSheet.eachRow((row, idx) => {
  if (idx === 1) return;
  collectInsurer(str(cv(row, 11)));
});

// From individual AP Sales files
for (const f of apSalesFiles) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(join(SUPPORTING, f));
  const ws = wb.worksheets[0];
  ws.eachRow((row, idx) => {
    if (idx === 1) return;
    collectInsurer(str(cv(row, 11)));
  });
}

// From Prospect Clients
prospectSheet.eachRow((row, idx) => {
  if (idx === 1) return;
  collectInsurer(str(cv(row, 5)));
});
console.log(`  ${insurerNames.size} unique insurance companies\n`);

// ── Database writes ──────────────────────────────────────────────────

console.log("Clearing existing data...");
await db.delete(schema.prospectClient);
await db.delete(schema.lead);
await db.delete(schema.producer);
await db.delete(schema.insuranceCompany);
await db.delete(schema.session);
await db.delete(schema.account);
await db.delete(schema.verification);
await db.delete(schema.user);
await db.execute(sql`ALTER SEQUENCE insurance_company_id_seq RESTART WITH 1`);
await db.execute(sql`ALTER SEQUENCE producer_id_seq RESTART WITH 1`);
await db.execute(sql`ALTER SEQUENCE lead_id_seq RESTART WITH 1`);
await db.execute(sql`ALTER SEQUENCE prospect_client_id_seq RESTART WITH 1`);
console.log("  Done\n");

// 6. Seed insurance companies
console.log("Seeding insurance companies...");
const insurerIdByName = new Map<string, number>();
for (const name of [...insurerNames].sort()) {
  const [row] = await db
    .insert(schema.insuranceCompany)
    .values({ name })
    .onConflictDoNothing()
    .returning({ id: schema.insuranceCompany.id });
  if (row) insurerIdByName.set(name, row.id);
}
console.log(`  ${insurerIdByName.size} companies inserted\n`);

// 7. Create user accounts and seed producers
console.log("Creating user accounts and producers...");
const ctx = await auth.$context;
const producerIdByName = new Map<string, number>();

for (const p of producerList) {
  let userId: string | null = null;

  if (p.email) {
    const password = "ApPlus2026!";
    const hash = await ctx.password.hash(password);
    userId = randomUUID();
    await db.insert(schema.user).values({
      id: userId,
      name: p.name,
      email: p.email.toLowerCase(),
      emailVerified: false,
      role: "salesman",
    });
    await db.insert(schema.account).values({
      id: randomUUID(),
      userId,
      providerId: "credential",
      accountId: userId,
      password: hash,
    });
  }

  const [prod] = await db
    .insert(schema.producer)
    .values({
      code: p.code,
      name: p.name,
      email: p.email || null,
      employmentStatus: p.employment,
      region: p.region,
      title: p.title || null,
      annualTarget: String(p.annualTarget),
      monthlyTarget: String(p.monthlyTarget),
      joinDate: p.joinDate,
      userId,
    })
    .returning({ id: schema.producer.id });

  producerIdByName.set(p.name, prod.id);
}

// Create admin user (the project owner)
const adminEmail = "rossbenhur27@gmail.com";
const adminName = "Joseph Benhur Rosas";
const adminPassword = "Admin2026!";
const adminHash = await ctx.password.hash(adminPassword);
const adminUid = randomUUID();
await db.insert(schema.user).values({
  id: adminUid, name: adminName, email: adminEmail, emailVerified: false, role: "admin",
});
await db.insert(schema.account).values({
  id: randomUUID(), userId: adminUid, providerId: "credential", accountId: adminUid, password: adminHash,
});

console.log(`  ${producerIdByName.size} producers + 1 admin created\n`);

// 8. Import leads — individual AP Sales files first, then mastersheet Main Data
interface RawLead {
  producerName: string;
  prospectName: string;
  startWorkingDate: string;
  rfqType: "New" | "Renewal";
  cob: "General" | "Medical" | "Motor";
  bor: boolean;
  quoted: boolean;
  status: LeadStatus;
  estimatedPremium: number;
  commission: string | null;
  insurerRaw: string;
  city: string;
  borTimestamp: string | null;
  quoteTimestamp: string | null;
  comments: string | null;
}

function parseLeadRow(row: ExcelJS.Row, producerName: string, commentCol: number): RawLead | null {
  const prospectName = str(cv(row, 2));
  if (!prospectName) return null;

  const startDate = dateStr(cv(row, 3));
  if (!startDate) return null;

  const statusRaw = str(cv(row, 8));

  const rfqRaw = str(cv(row, 4)).toLowerCase();
  const cobRaw = str(cv(row, 5)).toLowerCase();
  const commissionRaw = str(cv(row, 10));

  return {
    producerName,
    prospectName,
    startWorkingDate: startDate,
    rfqType: rfqRaw === "renewal" ? "Renewal" : "New",
    cob: cobRaw === "medical" ? "Medical" : cobRaw === "motor" ? "Motor" : "General",
    bor: toBool(cv(row, 6)),
    quoted: toBool(cv(row, 7)),
    status: normalizeStatus(statusRaw),
    estimatedPremium: num(cv(row, 9)),
    commission: commissionRaw === "-" || !commissionRaw ? null : String(num(cv(row, 10))),
    insurerRaw: str(cv(row, 11)),
    city: str(cv(row, 12)) || "Jeddah",
    borTimestamp: dateStr(cv(row, 13)),
    quoteTimestamp: dateStr(cv(row, 14)),
    comments: str(cv(row, commentCol)) || null,
  };
}

const dedupSet = new Set<string>();
const allLeads: RawLead[] = [];

function dedupKey(l: RawLead): string {
  return `${l.producerName}|${l.prospectName}|${l.startWorkingDate}`;
}

// 8a. Read individual AP Sales files (primary source — plain values)
console.log("Reading individual AP Sales files...");
for (const f of apSalesFiles) {
  const match = f.match(/AP Sales - (.+)\.xlsx$/);
  if (!match) continue;
  const producerName = match[1];

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(join(SUPPORTING, f));
  const ws = wb.worksheets[0];

  let fileCount = 0;
  ws.eachRow((row, idx) => {
    if (idx === 1) return;
    const lead = parseLeadRow(row, producerName, 15);
    if (!lead) return;
    const key = dedupKey(lead);
    if (dedupSet.has(key)) return;
    dedupSet.add(key);
    allLeads.push(lead);
    fileCount++;
  });
  console.log(`  ${producerName}: ${fileCount} leads`);
}
console.log(`  Subtotal from files: ${allLeads.length}\n`);

// 8b. Supplement from mastersheet Main Data (formula cached values)
console.log("Reading mastersheet Main Data (supplementary)...");
let msSupp = 0;
mainSheet.eachRow((row, idx) => {
  if (idx === 1) return;
  const producerName = str(cv(row, 1));
  if (!producerName) return;
  const lead = parseLeadRow(row, producerName, 32);
  if (!lead) return;
  const key = dedupKey(lead);
  if (dedupSet.has(key)) return;
  dedupSet.add(key);
  allLeads.push(lead);
  msSupp++;
});
console.log(`  ${msSupp} additional leads from mastersheet\n`);

// 8c. Insert all leads
console.log(`Inserting ${allLeads.length} total leads...`);
let leadInserted = 0;
let leadSkipped = 0;
const leadBatch: (typeof schema.lead.$inferInsert)[] = [];

for (const l of allLeads) {
  const producerId = producerIdByName.get(l.producerName);
  if (!producerId) {
    leadSkipped++;
    continue;
  }

  let currentInsurerId: number | null = null;
  if (l.insurerRaw && l.insurerRaw !== "-") {
    currentInsurerId = insurerIdByName.get(normalizeInsurer(l.insurerRaw)) ?? null;
  }

  leadBatch.push({
    producerId,
    prospectName: l.prospectName,
    startWorkingDate: l.startWorkingDate,
    rfqType: l.rfqType,
    cob: l.cob,
    bor: l.bor,
    quoted: l.quoted,
    status: l.status,
    estimatedPremium: String(l.estimatedPremium),
    commission: l.commission,
    currentInsurerId,
    city: l.city,
    borTimestamp: l.borTimestamp,
    quoteTimestamp: l.quoteTimestamp,
    comments: l.comments,
  });
  leadInserted++;
}

for (let i = 0; i < leadBatch.length; i += 200) {
  await db.insert(schema.lead).values(leadBatch.slice(i, i + 200));
}
console.log(`  ${leadInserted} leads imported, ${leadSkipped} skipped (no producer match)\n`);

// 9. Import prospect clients
console.log("Importing Prospect Clients...");
let prospectCount = 0;
let prospectSkipped = 0;
const prospectBatch: (typeof schema.prospectClient.$inferInsert)[] = [];

prospectSheet.eachRow((row, idx) => {
  if (idx === 1) return;
  const producerName = str(cv(row, 1));
  const clientName = str(cv(row, 2));
  if (!producerName || !clientName) return;

  let producerId = producerIdByName.get(producerName);
  if (!producerId) {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
    const consonants = (s: string) => norm(s).replace(/[aeiou]/g, "");
    const pNorm = norm(producerName);
    const pCons = consonants(producerName);
    for (const [name, id] of producerIdByName) {
      if (norm(name) === pNorm || consonants(name) === pCons) {
        producerId = id;
        break;
      }
    }
  }
  if (!producerId) {
    prospectSkipped++;
    return;
  }

  const premRaw = str(cv(row, 3));
  const premiums = premRaw === "-" || !premRaw ? null : String(num(cv(row, 3)));

  const insurerRaw = str(cv(row, 5));
  let currentInsurerId: number | null = null;
  if (insurerRaw && insurerRaw !== "-" && insurerRaw !== "N/A") {
    currentInsurerId = insurerIdByName.get(normalizeInsurer(insurerRaw)) ?? null;
  }

  const lobRaw = str(cv(row, 6)).toLowerCase();
  const lob = lobRaw === "medical" ? "Medical" : lobRaw === "motor" ? "Motor" : lobRaw ? "General" : null;

  prospectBatch.push({
    producerId,
    clientName,
    premiums,
    month: str(cv(row, 4)) || null,
    currentInsurerId,
    lob,
    status: "prospect",
  });
  prospectCount++;
});

for (let i = 0; i < prospectBatch.length; i += 200) {
  await db.insert(schema.prospectClient).values(prospectBatch.slice(i, i + 200));
}
console.log(`  ${prospectCount} prospects imported, ${prospectSkipped} skipped\n`);

// ── Validation ───────────────────────────────────────────────────────

console.log("=== Validation ===");
const [{ count: dbLeadCount }] = await db.select({ count: sql<number>`count(*)` }).from(schema.lead);
const [{ count: dbProspectCount }] = await db.select({ count: sql<number>`count(*)` }).from(schema.prospectClient);
const [{ count: dbProducerCount }] = await db.select({ count: sql<number>`count(*)` }).from(schema.producer);
const [{ count: dbInsurerCount }] = await db.select({ count: sql<number>`count(*)` }).from(schema.insuranceCompany);
const [{ count: dbUserCount }] = await db.select({ count: sql<number>`count(*)` }).from(schema.user);

console.log(`  Leads:      ${dbLeadCount}`);
console.log(`  Prospects:  ${dbProspectCount}`);
console.log(`  Producers:  ${dbProducerCount}`);
console.log(`  Insurers:   ${dbInsurerCount}`);
console.log(`  Users:      ${dbUserCount}`);

const statusBreakdown = await db
  .select({ status: schema.lead.status, count: sql<number>`count(*)` })
  .from(schema.lead)
  .groupBy(schema.lead.status);
console.log("\n  Lead status breakdown:");
for (const { status, count } of statusBreakdown) {
  console.log(`    ${status}: ${count}`);
}

const [{ total }] = await db
  .select({ total: sql<string>`coalesce(sum(estimated_premium), 0)` })
  .from(schema.lead);
console.log(`\n  Total estimated premium: ${Number(total).toLocaleString()}`);

console.log("\nETL complete.");
console.log(`\nDefault salesman password: ApPlus2026!`);
console.log(`Admin: ${adminEmail} / Admin2026!`);

await db.$client.end();
