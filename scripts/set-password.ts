import { randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { user, account, session } from "@/server/db/schema";

const [email, given] = process.argv.slice(2);
if (!email) {
  console.error('Usage: npm run user:password -- <email> ["<new password>"]');
  process.exit(1);
}

const [found] = await db.select({ id: user.id }).from(user).where(eq(user.email, email.trim().toLowerCase()));
if (!found) {
  console.error(`No account has the email ${email}.`);
  await db.$client.end();
  process.exit(1);
}

const password = given ?? randomBytes(12).toString("base64url");
const hash = await (await auth.$context).password.hash(password);
const [credential] = await db
  .select({ id: account.id })
  .from(account)
  .where(and(eq(account.userId, found.id), eq(account.providerId, "credential")));

if (credential) await db.update(account).set({ password: hash }).where(eq(account.id, credential.id));
else
  await db.insert(account).values({
    id: randomUUID(),
    userId: found.id,
    providerId: "credential",
    accountId: found.id,
    password: hash,
  });

await db.delete(session).where(eq(session.userId, found.id));
await db.$client.end();

console.log(`New password for ${email}: ${password}`);
