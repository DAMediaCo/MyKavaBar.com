ALTER TABLE "user_favorites" RENAME TO "favourite_bars";--> statement-breakpoint
ALTER TABLE "favourite_bars" DROP CONSTRAINT "user_favorites_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "favourite_bars" DROP CONSTRAINT "user_favorites_bar_id_kava_bars_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "favourite_bars" ADD CONSTRAINT "favourite_bars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "favourite_bars" ADD CONSTRAINT "favourite_bars_bar_id_kava_bars_id_fk" FOREIGN KEY ("bar_id") REFERENCES "public"."kava_bars"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
