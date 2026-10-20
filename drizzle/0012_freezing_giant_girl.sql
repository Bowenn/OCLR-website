ALTER TABLE "edition_events" ALTER COLUMN "reason" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "mappool_events" ALTER COLUMN "reason" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "result_audit_events" ALTER COLUMN "reason" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "result_revisions" ALTER COLUMN "reason" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_role_events" ALTER COLUMN "reason" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_role_events" ADD COLUMN "before" jsonb;--> statement-breakpoint
ALTER TABLE "staff_role_events" ADD COLUMN "after" jsonb;