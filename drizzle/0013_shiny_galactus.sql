CREATE TABLE "edition_revisions" (
	"edition_slug" text NOT NULL,
	"version" integer NOT NULL,
	"configuration" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "edition_revisions_edition_slug_version_pk" PRIMARY KEY("edition_slug","version")
);
--> statement-breakpoint
ALTER TABLE "edition_state" ADD COLUMN "configuration" jsonb;--> statement-breakpoint
ALTER TABLE "edition_state" ADD COLUMN "configuration_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "edition_state" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "edition_state" ADD COLUMN "configuration_updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "configuration_version" integer;--> statement-breakpoint
ALTER TABLE "edition_revisions" ADD CONSTRAINT "edition_revisions_edition_slug_edition_state_slug_fk" FOREIGN KEY ("edition_slug") REFERENCES "public"."edition_state"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_configuration_fk" FOREIGN KEY ("edition_slug","configuration_version") REFERENCES "public"."edition_revisions"("edition_slug","version") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- Preserve the committed S11 draft. Never replace an existing DB configuration.
INSERT INTO edition_state (slug, configuration)
VALUES ('s11', '{"name": "OCLR Season 11", "published": false, "status": "upcoming", "summary": "osu! Chinese League Rookie — Season 11. Tournament information is awaiting organizer approval.", "timeZone": "UTC", "rules": null, "eligibility": null, "registration": null, "schedule": [], "season": "11", "branding": {"logo": "/oclr-s11-square-logo.webp", "background": "/oclr-s11-website-background.webp", "keyVisual": "/oclr-s11-key-visual.webp"}}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET configuration = EXCLUDED.configuration
WHERE edition_state.configuration IS NULL;
--> statement-breakpoint
INSERT INTO edition_revisions (edition_slug, version, configuration)
SELECT slug, configuration_version, configuration FROM edition_state WHERE configuration IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE FUNCTION oclr_immutable_edition_slug() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.slug IS DISTINCT FROM OLD.slug THEN
    RAISE EXCEPTION 'Tournament slugs are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE TRIGGER edition_slug_immutable BEFORE UPDATE OF slug ON edition_state
FOR EACH ROW EXECUTE FUNCTION oclr_immutable_edition_slug();
