import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { ac, authRoles } from "@/lib/permissions";
import { db } from "./db";
import * as schema from "./db/schema";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg", schema, usePlural: false }),
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 8 },
  plugins: [admin({ ac, roles: authRoles, defaultRole: "salesman", adminRoles: ["admin"] })],
});

export type SessionUser = typeof auth.$Infer.Session.user;
