CREATE TYPE "public"."cob_type" AS ENUM('General', 'Medical', 'Motor');--> statement-breakpoint
CREATE TYPE "public"."employment_status" AS ENUM('Active', 'Resigned', 'Transferred');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('Secured', 'Pending', 'Lost');--> statement-breakpoint
CREATE TYPE "public"."rfq_type" AS ENUM('New', 'Renewal');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'manager', 'salesman');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insurance_company" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "insurance_company_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "lead" (
	"id" serial PRIMARY KEY NOT NULL,
	"producer_id" integer NOT NULL,
	"prospect_name" text NOT NULL,
	"start_working_date" date NOT NULL,
	"rfq_type" "rfq_type" NOT NULL,
	"cob" "cob_type" NOT NULL,
	"bor" boolean DEFAULT false NOT NULL,
	"quoted" boolean DEFAULT false NOT NULL,
	"status" "lead_status" DEFAULT 'Pending' NOT NULL,
	"estimated_premium" numeric(15, 2) DEFAULT '0' NOT NULL,
	"commission" numeric(15, 2),
	"current_insurer_id" integer,
	"city" text DEFAULT 'Jeddah' NOT NULL,
	"bor_timestamp" date,
	"quote_timestamp" date,
	"comments" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "producer" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(10) NOT NULL,
	"name" text NOT NULL,
	"employment_status" "employment_status" DEFAULT 'Active' NOT NULL,
	"region" text DEFAULT 'Jeddah' NOT NULL,
	"title" text,
	"annual_target" numeric(15, 2) DEFAULT '0' NOT NULL,
	"monthly_target" numeric(15, 2) DEFAULT '0' NOT NULL,
	"join_date" date,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "producer_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "prospect_client" (
	"id" serial PRIMARY KEY NOT NULL,
	"producer_id" integer NOT NULL,
	"client_name" text NOT NULL,
	"premiums" numeric(15, 2),
	"month" text,
	"current_insurer_id" integer,
	"lob" "cob_type",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'salesman' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_producer_id_producer_id_fk" FOREIGN KEY ("producer_id") REFERENCES "public"."producer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_current_insurer_id_insurance_company_id_fk" FOREIGN KEY ("current_insurer_id") REFERENCES "public"."insurance_company"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producer" ADD CONSTRAINT "producer_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_client" ADD CONSTRAINT "prospect_client_producer_id_producer_id_fk" FOREIGN KEY ("producer_id") REFERENCES "public"."producer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_client" ADD CONSTRAINT "prospect_client_current_insurer_id_insurance_company_id_fk" FOREIGN KEY ("current_insurer_id") REFERENCES "public"."insurance_company"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;