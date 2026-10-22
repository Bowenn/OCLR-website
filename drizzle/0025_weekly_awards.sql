CREATE TABLE "award_settings" (
	"edition_slug" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"weeks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tiers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "award_settings_version" CHECK ("award_settings"."version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "weekly_award_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_slug" text NOT NULL,
	"week" integer NOT NULL,
	"revision" integer NOT NULL,
	"fingerprint" text NOT NULL,
	"report" jsonb NOT NULL,
	"published_by" bigint NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "weekly_award_revision" UNIQUE("edition_slug","week","revision"),
	CONSTRAINT "weekly_award_positive" CHECK ("weekly_award_releases"."week" > 0 AND "weekly_award_releases"."revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "award_settings" ADD CONSTRAINT "award_settings_edition_slug_edition_state_slug_fk" FOREIGN KEY ("edition_slug") REFERENCES "public"."edition_state"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_award_releases" ADD CONSTRAINT "weekly_award_releases_edition_slug_edition_state_slug_fk" FOREIGN KEY ("edition_slug") REFERENCES "public"."edition_state"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_award_active" ON "weekly_award_releases" USING btree ("edition_slug","week") WHERE "weekly_award_releases"."active";