CREATE TYPE "public"."auth_provider" AS ENUM('local', 'google', 'apple');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_auth_providers" (
	"id" integer PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" "auth_provider" NOT NULL,
	"provider_account_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "kava_bars" ADD COLUMN "coming_soon" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "kava_bars" ADD COLUMN "grand_opening_date" date;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_auth_providers" ADD CONSTRAINT "user_auth_providers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_provider" ON "user_auth_providers" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_provider_account" ON "user_auth_providers" USING btree ("provider","provider_account_id");