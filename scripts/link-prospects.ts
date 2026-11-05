import "dotenv/config";
import { eq, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../src/server/db/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool, { schema, casing: "snake_case" });

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function main() {
  console.log("Retroactive prospect-to-lead linking\n");

  const leads = await db
    .select({ id: schema.lead.id, prospectName: schema.lead.prospectName, producerId: schema.lead.producerId, prospectClientId: schema.lead.prospectClientId })
    .from(schema.lead);

  const prospects = await db
    .select({ id: schema.prospectClient.id, clientName: schema.prospectClient.clientName, producerId: schema.prospectClient.producerId, status: schema.prospectClient.status })
    .from(schema.prospectClient);

  const prospectsByProducer = new Map<number, typeof prospects>();
  for (const p of prospects) {
    const list = prospectsByProducer.get(p.producerId) ?? [];
    list.push(p);
    prospectsByProducer.set(p.producerId, list);
  }

  let linked = 0;
  let skipped = 0;
  let alreadyLinked = 0;

  for (const lead of leads) {
    if (lead.prospectClientId) {
      alreadyLinked++;
      continue;
    }

    const producerProspects = prospectsByProducer.get(lead.producerId);
    if (!producerProspects) {
      skipped++;
      continue;
    }

    const normLead = normalize(lead.prospectName);
    const match = producerProspects.find((p) => normalize(p.clientName) === normLead);

    if (match) {
      await db.update(schema.lead).set({ prospectClientId: match.id, updatedAt: new Date() }).where(eq(schema.lead.id, lead.id));
      await db.update(schema.prospectClient).set({ status: "converted", updatedAt: new Date() }).where(eq(schema.prospectClient.id, match.id));
      linked++;
      console.log(`  Linked: "${lead.prospectName}" -> prospect #${match.id}`);
    } else {
      skipped++;
    }
  }

  console.log(`\nResults:`);
  console.log(`  Already linked: ${alreadyLinked}`);
  console.log(`  Newly linked:   ${linked}`);
  console.log(`  No match:       ${skipped}`);
  console.log(`  Total leads:    ${leads.length}`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
