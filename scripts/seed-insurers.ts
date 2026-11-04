import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

const names = [
  "Tawuniya", "Bupa Arabia", "GIG", "Medgulf", "Liva", "Wataniya",
  "Walaa", "ACIG", "Salama", "Al Rajhi Takaful", "AXA Cooperative",
  "Gulf Union", "Malath", "Solidarity Saudi Takaful", "Tokio Marine",
];

for (const name of names) {
  await db.insert(schema.insuranceCompany).values({ name }).onConflictDoNothing();
}

console.log(`Seeded ${names.length} insurance companies`);
await db.$client.end();
