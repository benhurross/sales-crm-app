CREATE TABLE "win_kudos" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"message" text,
	"seen_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "win_kudos_leadId_userId_unique" UNIQUE("lead_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "secured_at" timestamp;--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "celebrated_at" timestamp;--> statement-breakpoint
ALTER TABLE "win_kudos" ADD CONSTRAINT "win_kudos_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "win_kudos" ADD CONSTRAINT "win_kudos_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;