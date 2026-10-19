CREATE TYPE "public"."staff_role" AS ENUM('admin', 'mappooler', 'referee');--> statement-breakpoint
CREATE TABLE "staff_role_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grant_id" uuid NOT NULL,
	"actor_id" bigint NOT NULL,
	"target_id" bigint NOT NULL,
	"role" "staff_role" NOT NULL,
	"edition_slug" text,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" bigint NOT NULL,
	"edition_slug" text,
	"role" "staff_role" NOT NULL,
	"granted_by" bigint NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "staff_role_events" ADD CONSTRAINT "staff_role_events_grant_id_staff_roles_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."staff_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_roles" ADD CONSTRAINT "staff_roles_user_id_users_osu_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("osu_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_roles" ADD CONSTRAINT "staff_roles_edition_slug_edition_state_slug_fk" FOREIGN KEY ("edition_slug") REFERENCES "public"."edition_state"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_role_events_grant_idx" ON "staff_role_events" USING btree ("grant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_global_role_unique" ON "staff_roles" USING btree ("user_id","role") WHERE "staff_roles"."edition_slug" IS NULL AND "staff_roles"."revoked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_scoped_role_unique" ON "staff_roles" USING btree ("user_id","role","edition_slug") WHERE "staff_roles"."edition_slug" IS NOT NULL AND "staff_roles"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "staff_roles_user_idx" ON "staff_roles" USING btree ("user_id");