import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";

const MAIN_URL = "postgres://sales:sales@localhost:5435/sales_crm";
const TEST_DB = "sales_crm_test";
const TEST_URL = `postgres://sales:sales@localhost:5435/${TEST_DB}`;

export default async function globalSetup() {
  const client = new pg.Client(MAIN_URL);
  await client.connect();
  const { rows } = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [TEST_DB],
  );
  if (rows.length === 0) {
    await client.query(`CREATE DATABASE ${TEST_DB}`);
  }
  await client.end();

  const db = drizzle(TEST_URL);
  await migrate(db, { migrationsFolder: "./drizzle" });

  // Clean all rows for a fresh state
  await db.execute(sql`TRUNCATE lead, prospect_client, producer, insurance_company, session, account, verification, "user" CASCADE`);

  // Seed test insurance companies
  await db.execute(sql`
    INSERT INTO insurance_company (name) VALUES
    ('Tawuniya'), ('Bupa Arabia'), ('Medgulf'), ('GIG'), ('Liva')
    ON CONFLICT (name) DO NOTHING
  `);

  // Seed test users via direct SQL + bcrypt-compatible hash for "Password1"
  // better-auth uses scrypt by default; we hash with the same algorithm
  // We'll use the auth API via HTTP after the server starts instead.
  // For now, store placeholder users — the auth.setup.ts will use the API.

  // Import auth to hash passwords and create users properly
  process.env.DATABASE_URL = TEST_URL;
  process.env.BETTER_AUTH_URL = "http://localhost:3500";
  const { auth } = await import("../src/server/auth.js");

  const users_to_create = [
    { email: "admin@test.com", name: "Test Admin", password: "Password1", role: "admin" },
    { email: "manager@test.com", name: "Test Manager", password: "Password1", role: "manager" },
    { email: "salesman1@test.com", name: "Test Salesman 1", password: "Password1", role: "salesman" },
    { email: "salesman2@test.com", name: "Test Salesman 2", password: "Password1", role: "salesman" },
  ] as const;

  for (const u of users_to_create) {
    const result = await auth.api.createUser({ body: { ...u } });
    if (!result?.user?.id) {
      console.error(`Failed to create user: ${u.email}`, result);
      throw new Error(`Failed to create user: ${u.email}`);
    }
    console.log(`Created user: ${u.email} (${u.role})`);
  }

  // Get user IDs to link producers
  const users = await db.execute(sql`SELECT id, email FROM "user"`);
  const userMap = Object.fromEntries(users.rows.map((u: Record<string, unknown>) => [u.email, u.id]));

  // Seed producers linked to users
  await db.execute(sql`
    INSERT INTO producer (code, name, employment_status, region, annual_target, user_id) VALUES
    ('J-1', 'Test Salesman 1', 'Active', 'Jeddah', '1000000', ${userMap["salesman1@test.com"]}),
    ('R-1', 'Test Salesman 2', 'Active', 'Riyadh', '800000', ${userMap["salesman2@test.com"]}),
    ('J-2', 'Team Lead', 'Active', 'Jeddah', '500000', NULL)
  `);

  // Get producer IDs
  const producers = await db.execute(sql`SELECT id, code FROM producer`);
  const producerMap = Object.fromEntries(producers.rows.map((p: Record<string, unknown>) => [p.code, p.id]));

  // Seed test leads
  await db.execute(sql`
    INSERT INTO lead (producer_id, prospect_name, start_working_date, rfq_type, cob, status, estimated_premium, city, bor, quoted) VALUES
    (${producerMap["J-1"]}, 'Acme Corp', '2025-01-15', 'New', 'General', 'Secured', '500000', 'Jeddah', true, true),
    (${producerMap["J-1"]}, 'Beta Industries', '2025-02-10', 'Renewal', 'Medical', 'Pending', '300000', 'Jeddah', false, true),
    (${producerMap["J-1"]}, 'Gamma LLC', '2025-03-05', 'New', 'Motor', 'Lost', '150000', 'Riyadh', false, false),
    (${producerMap["R-1"]}, 'Delta Corp', '2025-01-20', 'New', 'General', 'Secured', '400000', 'Riyadh', true, true),
    (${producerMap["R-1"]}, 'Epsilon Ltd', '2025-04-01', 'Renewal', 'Medical', 'Pending', '250000', 'Riyadh', false, false),
    (${producerMap["J-2"]}, 'Zeta Holdings', '2025-02-28', 'New', 'General', 'Secured', '600000', 'Jeddah', true, true)
  `);

  // Seed prospect clients
  await db.execute(sql`
    INSERT INTO prospect_client (producer_id, client_name, premiums, month, lob) VALUES
    (${producerMap["J-1"]}, 'Prospect Alpha', '100000', 'January', 'General'),
    (${producerMap["R-1"]}, 'Prospect Beta', '200000', 'February', 'Medical')
  `);

  await db.$client.end();
}
