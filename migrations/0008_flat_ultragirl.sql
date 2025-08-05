CREATE TABLE IF NOT EXISTS "referral_amount" (
	"id" serial PRIMARY KEY NOT NULL,
	"reward" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "referral_amount" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_referral_reward_updated" ON "referral_amount" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_paid" ON "payouts" USING btree ("user_id","paid_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_referrer" ON "referrals" USING btree ("referrer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_referee" ON "referrals" USING btree ("referee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_referral_created_at" ON "referrals" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_referral_code" ON "users" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_status" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_created_at" ON "users" USING btree ("created_at");