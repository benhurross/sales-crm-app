import pg from "pg";

export default async function globalTeardown() {
  const client = new pg.Client("postgres://sales:sales@localhost:5435/sales_crm_test");
  await client.connect();
  await client.query('TRUNCATE lead, prospect_client, producer, insurance_company, session, account, verification, "user" CASCADE');
  await client.end();
}
