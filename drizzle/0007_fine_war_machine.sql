ALTER TABLE "mappools" ADD CONSTRAINT "pool_id_round_edition_unique" UNIQUE("id","round_id","edition_slug");--> statement-breakpoint
CREATE TYPE "public"."fixture_status" AS ENUM('scheduled', 'in_progress', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."result_state" AS ENUM('draft', 'submitted', 'approved');--> statement-breakpoint
CREATE TABLE "fixture_referees" (
	"fixture_id" uuid NOT NULL,
	"user_id" bigint NOT NULL,
	"assigned_by" bigint NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fixture_referees_fixture_id_user_id_pk" PRIMARY KEY("fixture_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "fixtures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_slug" text NOT NULL,
	"round_id" uuid NOT NULL,
	"label" text NOT NULL,
	"home_team_id" uuid NOT NULL,
	"away_team_id" uuid NOT NULL,
	"scheduled_at" timestamp with time zone,
	"time_zone" text NOT NULL,
	"status" "fixture_status" DEFAULT 'scheduled' NOT NULL,
	"mappool_id" uuid,
	"position" integer NOT NULL,
	"home_source_id" uuid,
	"home_source_outcome" text,
	"away_source_id" uuid,
	"away_source_outcome" text,
	"published_at" timestamp with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fixture_id_edition_unique" UNIQUE("id","edition_slug"),
	CONSTRAINT "fixture_round_position_unique" UNIQUE("round_id","position"),
	CONSTRAINT "fixture_distinct_teams" CHECK ("fixtures"."home_team_id" <> "fixtures"."away_team_id"),
	CONSTRAINT "fixture_positive_position" CHECK ("fixtures"."position" > 0),
	CONSTRAINT "fixture_home_source_pair" CHECK (("fixtures"."home_source_id" IS NULL AND "fixtures"."home_source_outcome" IS NULL) OR ("fixtures"."home_source_id" IS NOT NULL AND "fixtures"."home_source_outcome" IS NOT NULL AND "fixtures"."home_source_outcome" IN ('winner', 'loser'))),
	CONSTRAINT "fixture_away_source_pair" CHECK (("fixtures"."away_source_id" IS NULL AND "fixtures"."away_source_outcome" IS NULL) OR ("fixtures"."away_source_id" IS NOT NULL AND "fixtures"."away_source_outcome" IS NOT NULL AND "fixtures"."away_source_outcome" IN ('winner', 'loser')))
);
--> statement-breakpoint
CREATE TABLE "match_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"external_game_id" bigint NOT NULL,
	"beatmap_id" bigint,
	"data" jsonb NOT NULL,
	CONSTRAINT "match_import_game_unique" UNIQUE("import_id","external_game_id")
);
--> statement-breakpoint
CREATE TABLE "match_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fixture_id" uuid NOT NULL,
	"external_match_id" bigint NOT NULL,
	"fingerprint" text NOT NULL,
	"source" jsonb NOT NULL,
	"created_by" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_import_revision_unique" UNIQUE("fixture_id","external_match_id","fingerprint")
);
--> statement-breakpoint
CREATE TABLE "match_results" (
	"fixture_id" uuid PRIMARY KEY NOT NULL,
	"state" "result_state" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"current_revision" integer DEFAULT 0 NOT NULL,
	"published_revision" integer,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "result_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fixture_id" uuid NOT NULL,
	"actor_id" bigint NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"detail" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "result_game_claims" (
	"edition_slug" text NOT NULL,
	"external_game_id" bigint NOT NULL,
	"fixture_id" uuid NOT NULL,
	CONSTRAINT "result_game_claims_edition_slug_external_game_id_pk" PRIMARY KEY("edition_slug","external_game_id")
);
--> statement-breakpoint
CREATE TABLE "result_revisions" (
	"fixture_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"import_id" uuid NOT NULL,
	"proposal" jsonb NOT NULL,
	"reason" text NOT NULL,
	"created_by" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by" bigint,
	"approved_at" timestamp with time zone,
	CONSTRAINT "result_revisions_fixture_id_revision_pk" PRIMARY KEY("fixture_id","revision")
);
--> statement-breakpoint
ALTER TABLE "tournament_rounds" ADD COLUMN "scoring_rules" jsonb;--> statement-breakpoint
ALTER TABLE "tournament_rounds" ADD COLUMN "standings_rules" jsonb;--> statement-breakpoint
ALTER TABLE "fixture_referees" ADD CONSTRAINT "fixture_referees_fixture_id_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixture_referees" ADD CONSTRAINT "fixture_referees_user_id_users_osu_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("osu_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_round_id_edition_slug_tournament_rounds_id_edition_slug_fk" FOREIGN KEY ("round_id","edition_slug") REFERENCES "public"."tournament_rounds"("id","edition_slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_home_team_id_edition_slug_teams_id_edition_slug_fk" FOREIGN KEY ("home_team_id","edition_slug") REFERENCES "public"."teams"("id","edition_slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_away_team_id_edition_slug_teams_id_edition_slug_fk" FOREIGN KEY ("away_team_id","edition_slug") REFERENCES "public"."teams"("id","edition_slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_mappool_id_round_id_edition_slug_mappools_id_round_id_edition_slug_fk" FOREIGN KEY ("mappool_id","round_id","edition_slug") REFERENCES "public"."mappools"("id","round_id","edition_slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_home_source_id_edition_slug_fixtures_id_edition_slug_fk" FOREIGN KEY ("home_source_id","edition_slug") REFERENCES "public"."fixtures"("id","edition_slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_away_source_id_edition_slug_fixtures_id_edition_slug_fk" FOREIGN KEY ("away_source_id","edition_slug") REFERENCES "public"."fixtures"("id","edition_slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_games" ADD CONSTRAINT "match_games_import_id_match_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."match_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_imports" ADD CONSTRAINT "match_imports_fixture_id_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_fixture_id_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_audit_events" ADD CONSTRAINT "result_audit_events_fixture_id_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_game_claims" ADD CONSTRAINT "result_game_claims_fixture_id_edition_slug_fixtures_id_edition_slug_fk" FOREIGN KEY ("fixture_id","edition_slug") REFERENCES "public"."fixtures"("id","edition_slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_revisions" ADD CONSTRAINT "result_revisions_fixture_id_match_results_fixture_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."match_results"("fixture_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_revisions" ADD CONSTRAINT "result_revisions_import_id_match_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."match_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fixture_referee_user_idx" ON "fixture_referees" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fixtures_public_schedule_idx" ON "fixtures" USING btree ("edition_slug","published_at","scheduled_at");--> statement-breakpoint
CREATE INDEX "result_audit_fixture_idx" ON "result_audit_events" USING btree ("fixture_id");--> statement-breakpoint
