import { eq } from "drizzle-orm";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getSession } from "@/server/session";

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { currentPassword, newPassword } = await request.json();

  if (!currentPassword || !newPassword)
    return Response.json({ error: "Both current and new password are required" }, { status: 400 });

  if (newPassword.length < 8)
    return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });

  const [acc] = await db
    .select({ password: schema.account.password })
    .from(schema.account)
    .where(eq(schema.account.userId, session.user.id))
    .limit(1);

  if (!acc?.password) return Response.json({ error: "Account not found" }, { status: 404 });

  const ctx = await auth.$context;
  const valid = await ctx.password.verify({ hash: acc.password, password: currentPassword });
  if (!valid) return Response.json({ error: "Current password is incorrect" }, { status: 400 });

  const hash = await ctx.password.hash(newPassword);
  await db
    .update(schema.account)
    .set({ password: hash, updatedAt: new Date() })
    .where(eq(schema.account.userId, session.user.id));

  return Response.json({ ok: true });
}
