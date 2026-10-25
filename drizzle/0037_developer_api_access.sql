CREATE TABLE "developer_api_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" bigint,
	"access_id" uuid NOT NULL,
	"action" text NOT NULL,
	"detail" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "developer_api_events_action" CHECK ("developer_api_events"."action" IN ('create', 'revoke'))
);
--> statement-breakpoint
CREATE TABLE "developer_api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"session_hash" text NOT NULL,
	"user_id" bigint NOT NULL,
	"origin" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "developer_api_tokens_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "developer_api_tokens_hash" CHECK ("developer_api_tokens"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "developer_api_tokens_expiry" CHECK ("developer_api_tokens"."expires_at" > "developer_api_tokens"."created_at" AND "developer_api_tokens"."expires_at" <= "developer_api_tokens"."created_at" + interval '1 hour'),
	CONSTRAINT "developer_api_tokens_scopes" CHECK (jsonb_typeof("developer_api_tokens"."scopes") = 'array' AND jsonb_array_length("developer_api_tokens"."scopes") BETWEEN 1 AND 4 AND "developer_api_tokens"."scopes" <@ '["identity:read","tournaments:read","tournaments:private:read","profiles:read"]'::jsonb)
);
--> statement-breakpoint
ALTER TABLE "developer_api_events" ADD CONSTRAINT "developer_api_events_actor_id_users_osu_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("osu_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_api_tokens" ADD CONSTRAINT "developer_api_tokens_session_hash_sessions_token_hash_fk" FOREIGN KEY ("session_hash") REFERENCES "public"."sessions"("token_hash") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_api_tokens" ADD CONSTRAINT "developer_api_tokens_user_id_users_osu_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("osu_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "developer_api_tokens_user_idx" ON "developer_api_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "developer_api_tokens_session_idx" ON "developer_api_tokens" USING btree ("session_hash");