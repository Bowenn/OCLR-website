ALTER TABLE "registrations" ALTER COLUMN "rules_version" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "eligibility_acknowledged" boolean;