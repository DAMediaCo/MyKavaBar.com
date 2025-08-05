ALTER TABLE "users" ALTER COLUMN "referral_earnings" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "referral_earnings" SET DEFAULT '0.00';