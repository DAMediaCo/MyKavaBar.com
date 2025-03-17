CREATE TYPE "public"."crowd_density_level" AS ENUM('low', 'medium', 'high', 'very_high');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('review', 'photo');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('regular_user', 'kavatender', 'bar_owner', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'banned');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "banned_phone_numbers" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone_number" text NOT NULL,
	"reason" text,
	"banned_by" integer NOT NULL,
	"banned_at" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	CONSTRAINT "banned_phone_numbers_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bar_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"bar_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"day_of_week" integer NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"is_recurring" boolean DEFAULT true NOT NULL,
	"start_date" date,
	"end_date" date,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bar_owner_notification_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"review_notifications" boolean DEFAULT true NOT NULL,
	"photo_notifications" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bar_owner_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer NOT NULL,
	"bar_id" integer NOT NULL,
	"type" "notification_type" NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bar_staff" (
	"id" serial PRIMARY KEY NOT NULL,
	"bar_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"hire_date" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"position" text DEFAULT 'kavatender' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "check_ins" (
	"id" serial PRIMARY KEY NOT NULL,
	"bar_staff_id" integer NOT NULL,
	"start_time" timestamp DEFAULT now() NOT NULL,
	"end_time" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crowd_density" (
	"id" serial PRIMARY KEY NOT NULL,
	"bar_id" integer NOT NULL,
	"level" "crowd_density_level" NOT NULL,
	"count" integer,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"reported_by" integer,
	"note" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "favourite_bars" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"bar_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kava_bar_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"bar_id" integer NOT NULL,
	"url" text NOT NULL,
	"caption" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"uploaded_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kava_bars" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"phone" text,
	"hours" jsonb,
	"place_id" text,
	"rating" numeric(3, 2) DEFAULT '0.00' NOT NULL,
	"location" jsonb,
	"owner_id" integer,
	"is_sponsored" boolean DEFAULT false,
	"virtual_tour_url" text,
	"google_photos" jsonb DEFAULT '[]',
	"last_verified" timestamp,
	"verification_status" text,
	"business_status" text,
	"data_completeness_score" numeric(3, 2) DEFAULT '0.00',
	"is_verified_kava_bar" boolean DEFAULT false,
	"verification_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "kava_bars_place_id_unique" UNIQUE("place_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kavatenders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"bar_id" integer,
	"phone_number" text NOT NULL,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"status" text DEFAULT 'pending'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"bar_id" integer NOT NULL,
	"type" "notification_type" NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"related_item_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"phone_verification_id" integer,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "phone_verification_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"phone_number" text NOT NULL,
	"verification_id" text NOT NULL,
	"type" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"is_used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"bar_id" integer,
	"rating" integer NOT NULL,
	"content" text NOT NULL,
	"upvotes" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sponsored_listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"bar_id" integer,
	"square_payment_id" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "upvotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"review_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"activity_type" text NOT NULL,
	"details" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"phone_number" text,
	"is_phone_verified" boolean DEFAULT false NOT NULL,
	"profile_photo_url" text,
	"role" "user_role" DEFAULT 'regular_user' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"square_customer_id" text,
	"last_login_at" timestamp,
	"status_changed_at" timestamp,
	"status_changed_by" integer,
	"reset_password_token" text,
	"reset_password_expires" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"bar_id" integer NOT NULL,
	"code" text NOT NULL,
	"is_used" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"bar_id" integer NOT NULL,
	"requester_id" integer,
	"requester_name" text NOT NULL,
	"bar_name" text NOT NULL,
	"phone_number" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "banned_phone_numbers" ADD CONSTRAINT "banned_phone_numbers_banned_by_users_id_fk" FOREIGN KEY ("banned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bar_events" ADD CONSTRAINT "bar_events_bar_id_kava_bars_id_fk" FOREIGN KEY ("bar_id") REFERENCES "public"."kava_bars"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bar_events" ADD CONSTRAINT "bar_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bar_owner_notification_preferences" ADD CONSTRAINT "bar_owner_notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bar_owner_notifications" ADD CONSTRAINT "bar_owner_notifications_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bar_owner_notifications" ADD CONSTRAINT "bar_owner_notifications_bar_id_kava_bars_id_fk" FOREIGN KEY ("bar_id") REFERENCES "public"."kava_bars"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bar_staff" ADD CONSTRAINT "bar_staff_bar_id_kava_bars_id_fk" FOREIGN KEY ("bar_id") REFERENCES "public"."kava_bars"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bar_staff" ADD CONSTRAINT "bar_staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_bar_staff_id_bar_staff_id_fk" FOREIGN KEY ("bar_staff_id") REFERENCES "public"."bar_staff"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crowd_density" ADD CONSTRAINT "crowd_density_bar_id_kava_bars_id_fk" FOREIGN KEY ("bar_id") REFERENCES "public"."kava_bars"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crowd_density" ADD CONSTRAINT "crowd_density_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
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
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kava_bar_photos" ADD CONSTRAINT "kava_bar_photos_bar_id_kava_bars_id_fk" FOREIGN KEY ("bar_id") REFERENCES "public"."kava_bars"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kava_bar_photos" ADD CONSTRAINT "kava_bar_photos_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kava_bars" ADD CONSTRAINT "kava_bars_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kavatenders" ADD CONSTRAINT "kavatenders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kavatenders" ADD CONSTRAINT "kavatenders_bar_id_kava_bars_id_fk" FOREIGN KEY ("bar_id") REFERENCES "public"."kava_bars"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_bar_id_kava_bars_id_fk" FOREIGN KEY ("bar_id") REFERENCES "public"."kava_bars"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_phone_verification_id_phone_verification_codes_id_fk" FOREIGN KEY ("phone_verification_id") REFERENCES "public"."phone_verification_codes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "phone_verification_codes" ADD CONSTRAINT "phone_verification_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reviews" ADD CONSTRAINT "reviews_bar_id_kava_bars_id_fk" FOREIGN KEY ("bar_id") REFERENCES "public"."kava_bars"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsored_listings" ADD CONSTRAINT "sponsored_listings_bar_id_kava_bars_id_fk" FOREIGN KEY ("bar_id") REFERENCES "public"."kava_bars"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "upvotes" ADD CONSTRAINT "upvotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "upvotes" ADD CONSTRAINT "upvotes_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_activity_logs" ADD CONSTRAINT "user_activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_status_changed_by_users_id_fk" FOREIGN KEY ("status_changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_bar_id_kava_bars_id_fk" FOREIGN KEY ("bar_id") REFERENCES "public"."kava_bars"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_bar_id_kava_bars_id_fk" FOREIGN KEY ("bar_id") REFERENCES "public"."kava_bars"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
