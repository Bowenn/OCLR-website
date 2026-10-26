CREATE TABLE "referee_reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fixture_id" uuid NOT NULL,
	"actor_id" bigint NOT NULL,
	"request_key" uuid NOT NULL,
	"payload_hash" text NOT NULL,
	"revision" integer NOT NULL,
	"session_revision" integer NOT NULL,
	"dependency_fingerprint" text NOT NULL,
	"attempt_id" uuid NOT NULL,
	"import_id" uuid,
	"source_fingerprint" text,
	"game_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "referee_reconciliations" ADD CONSTRAINT "referee_reconciliations_fixture_id_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referee_reconciliations" ADD CONSTRAINT "referee_reconciliations_actor_id_users_osu_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("osu_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "referee_reconciliation_request" ON "referee_reconciliations" USING btree ("fixture_id","actor_id","request_key");--> statement-breakpoint
CREATE UNIQUE INDEX "referee_reconciliation_revision" ON "referee_reconciliations" USING btree ("fixture_id","revision");--> statement-breakpoint
CREATE INDEX "referee_reconciliation_fixture" ON "referee_reconciliations" USING btree ("fixture_id");