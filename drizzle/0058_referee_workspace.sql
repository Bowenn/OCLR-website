CREATE TABLE "referee_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fixture_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"actor_id" bigint NOT NULL,
	"request_key" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referee_event_ordinal_unique" UNIQUE("fixture_id","ordinal"),
	CONSTRAINT "referee_event_request_unique" UNIQUE("fixture_id","actor_id","request_key"),
	CONSTRAINT "referee_event_ordinal_positive" CHECK ("referee_events"."ordinal" > 0),
	CONSTRAINT "referee_event_hash" CHECK ("referee_events"."request_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "referee_event_payload_object" CHECK (jsonb_typeof("referee_events"."payload") = 'object')
);
--> statement-breakpoint
CREATE TABLE "referee_round_policies" (
	"round_id" uuid PRIMARY KEY NOT NULL,
	"edition_slug" text NOT NULL,
	"revision" integer NOT NULL,
	"policy" jsonb NOT NULL,
	"updated_by" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referee_policy_revision_positive" CHECK ("referee_round_policies"."revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "referee_sessions" (
	"fixture_id" uuid PRIMARY KEY NOT NULL,
	"edition_slug" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"first_ban_team_id" uuid,
	"first_pick_team_id" uuid,
	"settings" jsonb NOT NULL,
	"dependency_fingerprint" text NOT NULL,
	"basis" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referee_session_revision_nonnegative" CHECK ("referee_sessions"."revision" >= 0),
	CONSTRAINT "referee_session_fingerprint" CHECK ("referee_sessions"."dependency_fingerprint" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "referee_events" ADD CONSTRAINT "referee_events_fixture_id_referee_sessions_fixture_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."referee_sessions"("fixture_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referee_events" ADD CONSTRAINT "referee_events_actor_id_users_osu_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("osu_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referee_round_policies" ADD CONSTRAINT "referee_round_policies_updated_by_users_osu_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("osu_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referee_round_policies" ADD CONSTRAINT "referee_round_policies_round_id_edition_slug_tournament_rounds_id_edition_slug_fk" FOREIGN KEY ("round_id","edition_slug") REFERENCES "public"."tournament_rounds"("id","edition_slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referee_sessions" ADD CONSTRAINT "referee_sessions_fixture_id_edition_slug_fixtures_id_edition_slug_fk" FOREIGN KEY ("fixture_id","edition_slug") REFERENCES "public"."fixtures"("id","edition_slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referee_sessions" ADD CONSTRAINT "referee_sessions_first_ban_team_id_edition_slug_teams_id_edition_slug_fk" FOREIGN KEY ("first_ban_team_id","edition_slug") REFERENCES "public"."teams"("id","edition_slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referee_sessions" ADD CONSTRAINT "referee_sessions_first_pick_team_id_edition_slug_teams_id_edition_slug_fk" FOREIGN KEY ("first_pick_team_id","edition_slug") REFERENCES "public"."teams"("id","edition_slug") ON DELETE no action ON UPDATE no action;