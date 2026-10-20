ALTER TABLE "match_imports" ADD CONSTRAINT "import_id_fixture_unique" UNIQUE("id","fixture_id");--> statement-breakpoint
ALTER TABLE "result_revisions" DROP CONSTRAINT "result_revisions_import_id_match_imports_id_fk";
--> statement-breakpoint
ALTER TABLE "result_revisions" ADD CONSTRAINT "result_revisions_import_id_fixture_id_match_imports_id_fixture_id_fk" FOREIGN KEY ("import_id","fixture_id") REFERENCES "public"."match_imports"("id","fixture_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_revisions" ADD CONSTRAINT "result_revision_positive" CHECK ("result_revisions"."revision" > 0);--> statement-breakpoint
ALTER TABLE "result_revisions" ADD CONSTRAINT "result_approval_actor_pair" CHECK (("result_revisions"."approved_at" IS NULL AND "result_revisions"."approved_by" IS NULL) OR ("result_revisions"."approved_at" IS NOT NULL AND "result_revisions"."approved_by" IS NOT NULL));