CREATE TABLE IF NOT EXISTS "bar_features" (
	"id" serial PRIMARY KEY NOT NULL,
	"bar_id" integer NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer NOT NULL,
	"updated_at" timestamp,
	CONSTRAINT "bar_features_bar_id_name_unique" UNIQUE("bar_id","name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bar_features_from_master" (
	"id" serial PRIMARY KEY NOT NULL,
	"bar_id" integer NOT NULL,
	"feature_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bar_features_from_master_bar_id_feature_id_unique" UNIQUE("bar_id","feature_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "master_features" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer NOT NULL,
	"updated_at" timestamp,
	CONSTRAINT "master_features_category_id_name_unique" UNIQUE("category_id","name")
);
--> statement-breakpoint
DROP TABLE "bar_features_master" CASCADE;--> statement-breakpoint
DROP TABLE "bar_specific_features" CASCADE;--> statement-breakpoint
DROP TABLE "icons" CASCADE;--> statement-breakpoint
DROP TABLE "kava_bar_features" CASCADE;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bar_features" ADD CONSTRAINT "bar_features_bar_id_kava_bars_id_fk" FOREIGN KEY ("bar_id") REFERENCES "public"."kava_bars"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bar_features" ADD CONSTRAINT "bar_features_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bar_features_from_master" ADD CONSTRAINT "bar_features_from_master_bar_id_kava_bars_id_fk" FOREIGN KEY ("bar_id") REFERENCES "public"."kava_bars"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bar_features_from_master" ADD CONSTRAINT "bar_features_from_master_feature_id_master_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."master_features"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_features" ADD CONSTRAINT "master_features_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bar" ON "bar_features" USING btree ("bar_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bar_feature" ON "bar_features_from_master" USING btree ("bar_id","feature_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_feature" ON "bar_features_from_master" USING btree ("feature_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_category" ON "master_features" USING btree ("category_id");