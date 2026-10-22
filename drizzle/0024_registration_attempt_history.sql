CREATE TABLE "registration_attempts" (
	"registration_id" uuid NOT NULL,
	"attempt" integer NOT NULL,
	"edition_slug" text NOT NULL,
	"configuration_version" integer,
	"snapshot" jsonb NOT NULL,
	"archived_by" bigint,
	"archived_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registration_attempts_registration_id_attempt_pk" PRIMARY KEY("registration_id","attempt"),
	CONSTRAINT "registration_attempts_positive" CHECK ("registration_attempts"."attempt" > 0)
);
--> statement-breakpoint
ALTER TABLE "registration_events" DROP CONSTRAINT "registration_events_operation_valid";--> statement-breakpoint
ALTER TABLE "registration_events" ADD COLUMN "attempt" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "attempt" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "registration_attempts" ADD CONSTRAINT "registration_attempts_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_attempts" ADD CONSTRAINT "registration_attempts_edition_slug_edition_state_slug_fk" FOREIGN KEY ("edition_slug") REFERENCES "public"."edition_state"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_attempts" ADD CONSTRAINT "registration_attempts_archived_by_users_osu_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."users"("osu_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_attempts" ADD CONSTRAINT "registration_attempts_configuration_fk" FOREIGN KEY ("edition_slug","configuration_version") REFERENCES "public"."edition_revisions"("edition_slug","version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_events" ADD CONSTRAINT "registration_events_attempt_positive" CHECK ("registration_events"."attempt" > 0);--> statement-breakpoint
ALTER TABLE "registration_events" ADD CONSTRAINT "registration_events_operation_valid" CHECK ("registration_events"."operation" IS NULL OR "registration_events"."operation" IN ('staff_remove', 'staff_restore', 'player_withdraw', 'player_reapply'));--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_attempt_positive" CHECK ("registrations"."attempt" > 0);