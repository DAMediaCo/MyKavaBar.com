ALTER TABLE "users" ADD COLUMN "provider" "auth_provider" DEFAULT 'local' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_id" ON "users" USING btree ("id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_username" ON "users" USING btree ("username");