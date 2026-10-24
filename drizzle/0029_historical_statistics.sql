CREATE TABLE "historical_statistics" (
	"edition_slug" text NOT NULL,
	"mp_id" bigint NOT NULL,
	"fixture_id" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"draft" jsonb NOT NULL,
	"published" jsonb,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "historical_statistics_edition_slug_mp_id_pk" PRIMARY KEY("edition_slug","mp_id"),
	CONSTRAINT "historical_statistics_version" CHECK (version >= 0 AND mp_id > 0)
);
--> statement-breakpoint
ALTER TABLE "historical_statistics" ADD CONSTRAINT "historical_statistics_edition_slug_edition_state_slug_fk" FOREIGN KEY ("edition_slug") REFERENCES "public"."edition_state"("slug") ON DELETE no action ON UPDATE no action;