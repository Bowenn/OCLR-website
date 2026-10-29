CREATE TABLE "desktop_authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_name" text NOT NULL,
	"platform" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"state" text NOT NULL,
	"challenge" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"verification_code" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"user_id" bigint,
	"code_hash" text,
	"failures" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "desktop_security_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" bigint,
	"session_id" uuid,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "desktop_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" bigint NOT NULL,
	"device_name" text NOT NULL,
	"platform" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"refreshed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"refresh_expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "desktop_tokens" (
	"hash" text PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "referee_irc_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"fixture_id" uuid NOT NULL,
	"actor_id" bigint NOT NULL,
	"request_key" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"text" text NOT NULL,
	"target" text NOT NULL,
	"baseline_message_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"selection" jsonb,
	"status" text DEFAULT 'queued' NOT NULL,
	"record_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dispatched_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "referee_irc_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fixture_id" uuid NOT NULL,
	"edition_slug" text NOT NULL,
	"actor_id" bigint NOT NULL,
	"desktop_session_id" uuid NOT NULL,
	"room_id" bigint NOT NULL,
	"irc_username" text NOT NULL,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "oauth_states" ADD COLUMN "desktop_request_id" uuid;--> statement-breakpoint
ALTER TABLE "desktop_authorizations" ADD CONSTRAINT "desktop_authorizations_user_id_users_osu_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("osu_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desktop_sessions" ADD CONSTRAINT "desktop_sessions_user_id_users_osu_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("osu_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desktop_tokens" ADD CONSTRAINT "desktop_tokens_session_id_desktop_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."desktop_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referee_irc_commands" ADD CONSTRAINT "referee_irc_commands_connection_id_referee_irc_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."referee_irc_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referee_irc_commands" ADD CONSTRAINT "referee_irc_commands_fixture_id_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referee_irc_commands" ADD CONSTRAINT "referee_irc_commands_actor_id_users_osu_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("osu_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referee_irc_connections" ADD CONSTRAINT "referee_irc_connections_fixture_id_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referee_irc_connections" ADD CONSTRAINT "referee_irc_connections_actor_id_users_osu_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("osu_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "desktop_session_user_idx" ON "desktop_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "desktop_token_session_idx" ON "desktop_tokens" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "referee_irc_request" ON "referee_irc_commands" USING btree ("fixture_id","actor_id","request_key");--> statement-breakpoint
CREATE INDEX "referee_irc_connection_commands" ON "referee_irc_commands" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "referee_irc_fixture" ON "referee_irc_connections" USING btree ("fixture_id");