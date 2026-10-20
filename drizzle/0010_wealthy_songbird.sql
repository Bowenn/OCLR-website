ALTER TABLE "tournament_stages" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_stages" ADD COLUMN "group_configuration" jsonb;--> statement-breakpoint
ALTER TABLE "tournament_stages" ADD COLUMN "groups_published_at" timestamp with time zone;