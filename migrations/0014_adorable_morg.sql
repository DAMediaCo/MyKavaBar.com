CREATE TABLE IF NOT EXISTS "kavabar_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"bar_id" integer NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kavabar_subscriptions" ADD CONSTRAINT "kavabar_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kavabar_subscriptions" ADD CONSTRAINT "kavabar_subscriptions_bar_id_kava_bars_id_fk" FOREIGN KEY ("bar_id") REFERENCES "public"."kava_bars"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
