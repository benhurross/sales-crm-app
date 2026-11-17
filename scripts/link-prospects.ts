/**
 * Links leads to the prospect they came from, matching the client name for the same salesman.
 * Safe to run again: links whose names do not match are removed (earlier versions matched every
 * Arabic name to the same prospect), and each prospect is marked converted only while a lead links to it.
 *
 *   npm run db:link
 */
import { eq, inArray } from "drizzle-orm";
import { nameKey } from "../src/lib/sheet-import";
import { db } from "../src/server/db";
import * as schema from "../src/server/db/schema";

const [leads, prospects] = await Promise.all([
  db.select({ id: schema.lead.id, prospectName: schema.lead.prospectName, producerId: schema.lead.producerId, prospectClientId: schema.lead.prospectClientId }).from(schema.lead),
  db.select({ id: schema.prospectClient.id, clientName: schema.prospectClient.clientName, producerId: schema.prospectClient.producerId, status: schema.prospectClient.status }).from(schema.prospectClient),
]);

const prospectById = new Map(prospects.map((p) => [p.id, p]));
const key = (producerId: number, name: string) => `${producerId}|${nameKey(name)}`;
// first prospect per salesman and client name (the prospect list repeats some clients)
const prospectByName = new Map<string, (typeof prospects)[number]>();
for (const p of prospects) if (nameKey(p.clientName) && !prospectByName.has(key(p.producerId, p.clientName))) prospectByName.set(key(p.producerId, p.clientName), p);

let kept = 0;
let unlinked = 0;
let linked = 0;
const links = new Map<number, number | null>(); // lead id -> prospect id

for (const lead of leads) {
  const current = lead.prospectClientId ? prospectById.get(lead.prospectClientId) : undefined;
  if (current && current.producerId === lead.producerId && nameKey(current.clientName) === nameKey(lead.prospectName) && nameKey(lead.prospectName)) {
    kept++;
    continue;
  }
  const match = nameKey(lead.prospectName) ? prospectByName.get(key(lead.producerId, lead.prospectName)) : undefined;
  if (lead.prospectClientId && !match) unlinked++;
  if (match) linked++;
  if ((match?.id ?? null) !== lead.prospectClientId) links.set(lead.id, match?.id ?? null);
}

await db.transaction(async (tx) => {
  for (const [leadId, prospectId] of links) await tx.update(schema.lead).set({ prospectClientId: prospectId }).where(eq(schema.lead.id, leadId));

  // converted = some lead links to it; inactive prospects stay inactive
  const linkedIds = new Set(
    (await tx.select({ id: schema.lead.prospectClientId }).from(schema.lead)).map((r) => r.id).filter((id): id is number => id !== null),
  );
  const toConvert = prospects.filter((p) => linkedIds.has(p.id) && p.status === "prospect").map((p) => p.id);
  const toReopen = prospects.filter((p) => !linkedIds.has(p.id) && p.status === "converted").map((p) => p.id);
  if (toConvert.length) await tx.update(schema.prospectClient).set({ status: "converted", updatedAt: new Date() }).where(inArray(schema.prospectClient.id, toConvert));
  if (toReopen.length) await tx.update(schema.prospectClient).set({ status: "prospect", updatedAt: new Date() }).where(inArray(schema.prospectClient.id, toReopen));
  console.log(`Prospects marked converted: ${toConvert.length}, set back to prospect: ${toReopen.length}`);
});

console.log(`Leads: ${kept} correct links kept, ${linked} linked, ${unlinked} wrong links removed, ${leads.length} in total`);
await db.$client.end();
