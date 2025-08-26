CREATE TABLE IF NOT EXISTS "bar_features_master" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icon" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bar_features_master_name_unique" UNIQUE("name"),
	CONSTRAINT "bar_features_master_icon_unique" UNIQUE("icon")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bar_specific_features" (
	"id" serial PRIMARY KEY NOT NULL,
	"bar_id" integer NOT NULL,
	"name" text NOT NULL,
	"icon" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "icons" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kava_bar_features" (
	"id" serial PRIMARY KEY NOT NULL,
	"bar_id" integer NOT NULL,
	"feature_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "user_bar_roles";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bar_specific_features" ADD CONSTRAINT "bar_specific_features_bar_id_kava_bars_id_fk" FOREIGN KEY ("bar_id") REFERENCES "public"."kava_bars"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kava_bar_features" ADD CONSTRAINT "kava_bar_features_bar_id_kava_bars_id_fk" FOREIGN KEY ("bar_id") REFERENCES "public"."kava_bars"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kava_bar_features" ADD CONSTRAINT "kava_bar_features_feature_id_bar_features_master_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."bar_features_master"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
