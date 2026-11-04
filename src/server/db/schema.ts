import { boolean, date, integer, numeric, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

const uuid = () => text().$defaultFn(() => crypto.randomUUID());

export const userRoleEnum = pgEnum("user_role", ["admin", "manager", "salesman"]);
export const leadStatusEnum = pgEnum("lead_status", ["Secured", "Pending", "Lost"]);
export const rfqTypeEnum = pgEnum("rfq_type", ["New", "Renewal"]);
export const cobTypeEnum = pgEnum("cob_type", ["General", "Medical", "Motor"]);
export const employmentStatusEnum = pgEnum("employment_status", ["Active", "Resigned", "Transferred"]);

export const user = pgTable("user", {
  id: uuid().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  role: userRoleEnum().notNull().default("salesman"),
  banned: boolean().default(false),
  banReason: text(),
  banExpires: timestamp(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: uuid().primaryKey(),
  expiresAt: timestamp().notNull(),
  token: text().notNull().unique(),
  ipAddress: text(),
  userAgent: text(),
  userId: text().notNull().references(() => user.id, { onDelete: "cascade" }),
  impersonatedBy: text(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: uuid().primaryKey(),
  accountId: text().notNull(),
  providerId: text().notNull(),
  userId: text().notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text(),
  refreshToken: text(),
  idToken: text(),
  accessTokenExpiresAt: timestamp(),
  refreshTokenExpiresAt: timestamp(),
  scope: text(),
  password: text(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: uuid().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp().notNull(),
  createdAt: timestamp(),
  updatedAt: timestamp(),
});

export const producer = pgTable("producer", {
  id: serial().primaryKey(),
  code: varchar({ length: 10 }).notNull().unique(),
  name: text().notNull(),
  employmentStatus: employmentStatusEnum().notNull().default("Active"),
  region: text().notNull().default("Jeddah"),
  title: text(),
  annualTarget: numeric({ precision: 15, scale: 2 }).notNull().default("0"),
  monthlyTarget: numeric({ precision: 15, scale: 2 }).notNull().default("0"),
  joinDate: date(),
  userId: text().references(() => user.id),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

export const insuranceCompany = pgTable("insurance_company", {
  id: serial().primaryKey(),
  name: text().notNull().unique(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const lead = pgTable("lead", {
  id: serial().primaryKey(),
  producerId: integer().notNull().references(() => producer.id),
  prospectName: text().notNull(),
  startWorkingDate: date().notNull(),
  rfqType: rfqTypeEnum().notNull(),
  cob: cobTypeEnum().notNull(),
  bor: boolean().notNull().default(false),
  quoted: boolean().notNull().default(false),
  status: leadStatusEnum().notNull().default("Pending"),
  estimatedPremium: numeric({ precision: 15, scale: 2 }).notNull().default("0"),
  commission: numeric({ precision: 15, scale: 2 }),
  currentInsurerId: integer().references(() => insuranceCompany.id),
  city: text().notNull().default("Jeddah"),
  borTimestamp: date(),
  quoteTimestamp: date(),
  comments: text(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

export const prospectClient = pgTable("prospect_client", {
  id: serial().primaryKey(),
  producerId: integer().notNull().references(() => producer.id),
  clientName: text().notNull(),
  premiums: numeric({ precision: 15, scale: 2 }),
  month: text(),
  currentInsurerId: integer().references(() => insuranceCompany.id),
  lob: cobTypeEnum(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});
