ALTER TYPE "public"."staff_role" ADD VALUE 'tester';--> statement-breakpoint
ALTER TYPE "public"."staff_role" ADD VALUE 'replayer';--> statement-breakpoint
CREATE TABLE "mappool_replays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"sha256" text NOT NULL,
	"filename" text NOT NULL,
	"size" integer NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"uploader_id" bigint NOT NULL,
	"uploader_name" text NOT NULL,
	"summary" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "replay_entry_sha_unique" UNIQUE("entry_id","sha256")
);
--> statement-breakpoint
ALTER TABLE "mappools" ADD COLUMN "selection_locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mappools" ADD COLUMN "showcase_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mappool_replays" ADD CONSTRAINT "mappool_replays_entry_id_mappool_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."mappool_entries"("id") ON DELETE no action ON UPDATE no action;