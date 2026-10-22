ALTER TABLE "edition_state" ADD COLUMN "registration_paused_at" timestamp with time zone;--> statement-breakpoint
-- Preserve every existing enrollment closure; future draft unlocks only clear locked_at.
UPDATE "edition_state" SET "registration_paused_at" = "locked_at" WHERE "locked_at" IS NOT NULL;
