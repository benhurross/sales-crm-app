/**
 * Ties every salesman (producer) to their login account and merges duplicates.
 *
 *   npm run db:repair            # show what would change
 *   npm run db:repair -- --apply # make the changes, in one transaction
 *
 * 1. Duplicate producers for one person are merged into the one with a registered email;
 *    their leads and prospects move with them.
 * 2. Duplicate accounts for one person are merged into the one whose email is registered
 *    on the producer (else a company email); the other accounts are deleted.
 * 3. Producers without an account are linked to the account with the same email or name.
 */
import { count, eq, inArray } from "drizzle-orm";
import { matchUser, planProducerMerges, planUserMerges, type ProducerRecord, type UserRecord } from "../src/lib/identity";
import { db } from "../src/server/db";
import * as schema from "../src/server/db/schema";

const apply = process.argv.includes("--apply");
const changes: string[] = [];

async function loadProducers(): Promise<ProducerRecord[]> {
  const [producers, leads, prospects] = await Promise.all([
    db.select().from(schema.producer).orderBy(schema.producer.id),
    db.select({ id: schema.lead.producerId, n: count() }).from(schema.lead).groupBy(schema.lead.producerId),
    db.select({ id: schema.prospectClient.producerId, n: count() }).from(schema.prospectClient).groupBy(schema.prospectClient.producerId),
  ]);
  const records = (id: number) => (leads.find((l) => l.id === id)?.n ?? 0) + (prospects.find((p) => p.id === id)?.n ?? 0);
  return producers.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    email: p.email,
    userId: p.userId,
    annualTarget: p.annualTarget,
    monthlyTarget: p.monthlyTarget,
    records: records(p.id),
  }));
}

const loadUsers = (): Promise<UserRecord[]> =>
  db.select({ id: schema.user.id, name: schema.user.name, email: schema.user.email, role: schema.user.role }).from(schema.user);

await db.transaction(async (tx) => {
  // 1. Merge duplicate producers
  for (const { keep, remove } of planProducerMerges(await loadProducers())) {
    const ids = remove.map((p) => p.id);
    changes.push(`Merge producer ${remove.map((p) => `${p.code} "${p.name}" (${p.records} records)`).join(", ")} into ${keep.code} "${keep.name}"`);
    await tx.update(schema.lead).set({ producerId: keep.id }).where(inArray(schema.lead.producerId, ids));
    await tx.update(schema.prospectClient).set({ producerId: keep.id }).where(inArray(schema.prospectClient.producerId, ids));
    const donor = remove.find((p) => p.userId) ?? remove[0];
    const target = remove.find((p) => Number(p.annualTarget) > 0);
    await tx
      .update(schema.producer)
      .set({
        userId: keep.userId ?? donor.userId,
        email: keep.email ?? remove.find((p) => p.email)?.email ?? null,
        ...(Number(keep.annualTarget) === 0 && target ? { annualTarget: target.annualTarget, monthlyTarget: target.monthlyTarget } : {}),
      })
      .where(eq(schema.producer.id, keep.id));
    await tx.delete(schema.producer).where(inArray(schema.producer.id, ids));
  }

  // 2. Merge duplicate accounts
  const producers = await tx.select({ id: schema.producer.id, email: schema.producer.email }).from(schema.producer);
  const producerEmails = producers.map((p) => p.email).filter((e): e is string => !!e);
  for (const { keep, remove, role } of planUserMerges(await loadUsers(), producerEmails)) {
    const ids = remove.map((u) => u.id);
    changes.push(`Merge account ${remove.map((u) => `${u.email} (${u.role})`).join(", ")} into ${keep.email} as ${role}`);
    await tx.update(schema.producer).set({ userId: keep.id }).where(inArray(schema.producer.userId, ids));
    if (role !== keep.role) await tx.update(schema.user).set({ role: role as "admin" | "manager" | "salesman" }).where(eq(schema.user.id, keep.id));
    await tx.delete(schema.user).where(inArray(schema.user.id, ids)); // sessions and passwords cascade
  }

  // 3. Link producers to accounts
  const users = await tx.select({ id: schema.user.id, name: schema.user.name, email: schema.user.email, role: schema.user.role }).from(schema.user);
  for (const p of await tx.select().from(schema.producer).orderBy(schema.producer.name)) {
    const match = matchUser(p, users);
    const linked = users.find((u) => u.id === p.userId);
    if (match && match.id !== p.userId && (!linked || (p.email && match.email.toLowerCase() === p.email.toLowerCase()))) {
      changes.push(`Link producer ${p.code} "${p.name}" to ${match.email}${linked ? ` (was ${linked.email})` : ""}`);
      await tx.update(schema.producer).set({ userId: match.id }).where(eq(schema.producer.id, p.id));
    }
  }

  if (!apply) tx.rollback();
}).catch((err) => {
  if (apply || !String(err).includes("Rollback")) throw err;
});

// Report what each account will see
const [users, producers, leadCounts, prospectCounts] = await Promise.all([
  loadUsers(),
  db.select().from(schema.producer),
  db.select({ id: schema.lead.producerId, n: count() }).from(schema.lead).groupBy(schema.lead.producerId),
  db.select({ id: schema.prospectClient.producerId, n: count() }).from(schema.prospectClient).groupBy(schema.prospectClient.producerId),
]);

console.log(changes.length ? `${apply ? "Changed" : "Would change"}:\n  ${changes.join("\n  ")}\n` : "Nothing to change.\n");
if (apply || !changes.length) {
  console.log("Salesmen and what they see:");
  for (const u of users.filter((u) => u.role === "salesman").sort((a, b) => a.name.localeCompare(b.name))) {
    const p = producers.find((x) => x.userId === u.id);
    const leads = leadCounts.find((l) => l.id === p?.id)?.n ?? 0;
    const prospects = prospectCounts.find((l) => l.id === p?.id)?.n ?? 0;
    console.log(`  ${u.name.padEnd(22)} ${u.email.padEnd(30)} ${p ? `${p.code}: ${leads} leads, ${prospects} prospects` : "NO PRODUCER: sees no data"}`);
  }
  const unlinked = producers.filter((p) => !p.userId && p.employmentStatus === "Active");
  if (unlinked.length) console.log(`\nActive producers without an account: ${unlinked.map((p) => `${p.code} ${p.name}`).join(", ")}`);
} else {
  console.log("Run with --apply to make these changes.");
}
await db.$client.end();
