CREATE TYPE "public"."fm_mode" AS ENUM('free_mod', 'force_mod');--> statement-breakpoint
CREATE TYPE "public"."mappool_category" AS ENUM('NM', 'HD', 'DT', 'HR', 'FM', 'TB');--> statement-breakpoint
CREATE TYPE "public"."stage_kind" AS ENUM('group', 'knockout');--> statement-breakpoint
CREATE TABLE "mappool_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"category" "mappool_category" NOT NULL,
	"position" integer NOT NULL,
	"beatmap_id" bigint NOT NULL,
	"metadata" jsonb NOT NULL,
	"metadata_fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pool_slot_unique" UNIQUE("pool_id","category","position")
);
--> statement-breakpoint
CREATE TABLE "mappool_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_slug" text NOT NULL,
	"pool_id" uuid,
	"actor_id" bigint NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"before" jsonb,
	"after" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mappools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_slug" text NOT NULL,
	"round_id" uuid NOT NULL,
	"name" text NOT NULL,
	"fm_mode" "fm_mode",
	"fm_restrictions" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pool_round_name_unique" UNIQUE("round_id","name"),
	CONSTRAINT "pool_id_edition_unique" UNIQUE("id","edition_slug")
);
--> statement-breakpoint
CREATE TABLE "tournament_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_slug" text NOT NULL,
	"stage_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "round_stage_position_unique" UNIQUE("stage_id","position"),
	CONSTRAINT "round_id_edition_unique" UNIQUE("id","edition_slug")
);
--> statement-breakpoint
CREATE TABLE "tournament_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_slug" text NOT NULL,
	"kind" "stage_kind" NOT NULL,
	CONSTRAINT "stage_edition_kind_unique" UNIQUE("edition_slug","kind"),
	CONSTRAINT "stage_id_edition_unique" UNIQUE("id","edition_slug")
);
--> statement-breakpoint
ALTER TABLE "mappool_entries" ADD CONSTRAINT "mappool_entries_pool_id_mappools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."mappools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mappool_events" ADD CONSTRAINT "mappool_events_edition_slug_edition_state_slug_fk" FOREIGN KEY ("edition_slug") REFERENCES "public"."edition_state"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mappool_events" ADD CONSTRAINT "mappool_events_pool_id_mappools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."mappools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mappools" ADD CONSTRAINT "mappools_round_id_edition_slug_tournament_rounds_id_edition_slug_fk" FOREIGN KEY ("round_id","edition_slug") REFERENCES "public"."tournament_rounds"("id","edition_slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_rounds" ADD CONSTRAINT "tournament_rounds_stage_id_edition_slug_tournament_stages_id_edition_slug_fk" FOREIGN KEY ("stage_id","edition_slug") REFERENCES "public"."tournament_stages"("id","edition_slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_stages" ADD CONSTRAINT "tournament_stages_edition_slug_edition_state_slug_fk" FOREIGN KEY ("edition_slug") REFERENCES "public"."edition_state"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pool_entry_pool_idx" ON "mappool_entries" USING btree ("pool_id");--> statement-breakpoint
CREATE INDEX "mappool_events_pool_idx" ON "mappool_events" USING btree ("pool_id");--> statement-breakpoint
CREATE INDEX "pool_public_edition_idx" ON "mappools" USING btree ("edition_slug","published_at");