CREATE TYPE "public"."draft_state" AS ENUM('setup', 'ready', 'live', 'paused', 'completed', 'finalized', 'aborted');--> statement-breakpoint
CREATE TABLE "draft_picks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"turn_index" integer NOT NULL,
	"team_id" uuid NOT NULL,
	"captain_id" bigint NOT NULL,
	"player_id" bigint NOT NULL,
	"actor_id" bigint NOT NULL,
	"mode" text NOT NULL,
	"request_key" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"revision" integer NOT NULL,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "draft_actor_request_unique" UNIQUE("session_id","actor_id","request_key")
);
--> statement-breakpoint
CREATE TABLE "draft_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_slug" text NOT NULL,
	"state" "draft_state" DEFAULT 'setup' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"turn_index" integer DEFAULT 0 NOT NULL,
	"turn_sequence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pool" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"public_version" integer DEFAULT 0 NOT NULL,
	"published_revision" integer DEFAULT -1 NOT NULL,
	"public_snapshot" jsonb,
	"captain_snapshot" jsonb,
	CONSTRAINT "draft_sessions_edition_slug_unique" UNIQUE("edition_slug")
);
--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_session_id_draft_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."draft_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_captain_id_users_osu_id_fk" FOREIGN KEY ("captain_id") REFERENCES "public"."users"("osu_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_player_id_users_osu_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."users"("osu_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_actor_id_users_osu_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("osu_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_sessions" ADD CONSTRAINT "draft_sessions_edition_slug_edition_state_slug_fk" FOREIGN KEY ("edition_slug") REFERENCES "public"."edition_state"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "draft_active_turn_unique" ON "draft_picks" USING btree ("session_id","turn_index") WHERE "draft_picks"."voided_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "draft_active_player_unique" ON "draft_picks" USING btree ("session_id","player_id") WHERE "draft_picks"."voided_at" IS NULL;