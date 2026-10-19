CREATE TYPE "public"."registration_status" AS ENUM('pending', 'accepted', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TABLE "edition_state" (
	"slug" text PRIMARY KEY NOT NULL,
	"locked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "registration_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"actor_id" bigint,
	"from_status" "registration_status",
	"to_status" "registration_status" NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_slug" text NOT NULL,
	"user_id" bigint NOT NULL,
	"status" "registration_status" DEFAULT 'pending' NOT NULL,
	"rules_version" text NOT NULL,
	"answers" jsonb NOT NULL,
	"status_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registrations_edition_user_unique" UNIQUE("edition_slug","user_id")
);
--> statement-breakpoint
ALTER TABLE "registration_events" ADD CONSTRAINT "registration_events_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_events" ADD CONSTRAINT "registration_events_actor_id_users_osu_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("osu_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_edition_slug_edition_state_slug_fk" FOREIGN KEY ("edition_slug") REFERENCES "public"."edition_state"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_user_id_users_osu_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("osu_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "registration_events_registration_idx" ON "registration_events" USING btree ("registration_id");--> statement-breakpoint
CREATE INDEX "registrations_status_idx" ON "registrations" USING btree ("edition_slug","status");