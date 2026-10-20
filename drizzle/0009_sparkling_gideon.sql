ALTER TABLE "match_results" ADD COLUMN "latest_import_id" uuid;--> statement-breakpoint
ALTER TABLE "result_audit_events" ADD COLUMN "request_key" uuid;--> statement-breakpoint
ALTER TABLE "result_audit_events" ADD COLUMN "request_hash" text;--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_latest_import_id_fixture_id_match_imports_id_fixture_id_fk" FOREIGN KEY ("latest_import_id","fixture_id") REFERENCES "public"."match_imports"("id","fixture_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "result_command_key_unique" ON "result_audit_events" USING btree ("fixture_id","actor_id","request_key") WHERE "result_audit_events"."request_key" IS NOT NULL;