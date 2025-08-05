CREATE TABLE IF NOT EXISTS "kavatender_referral_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"referral_code" text NOT NULL,
	"total_earnings" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "kavatender_referral_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "kavatender_referral_profiles_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
ALTER TABLE "kavatender_referral_profiles" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_referral_code_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_referral_code";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kavatender_referral_profiles" ADD CONSTRAINT "kavatender_referral_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_kavatender_ref_user" ON "kavatender_referral_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_kavatender_ref_code" ON "kavatender_referral_profiles" USING btree ("referral_code");--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "referral_code";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "referral_earnings";