CREATE TYPE "public"."prospect_status" AS ENUM('prospect', 'converted', 'inactive');--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "prospect_client_id" integer;--> statement-breakpoint
ALTER TABLE "prospect_client" ADD COLUMN "status" "prospect_status" DEFAULT 'prospect' NOT NULL;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_prospect_client_id_prospect_client_id_fk" FOREIGN KEY ("prospect_client_id") REFERENCES "public"."prospect_client"("id") ON DELETE no action ON UPDATE no action;