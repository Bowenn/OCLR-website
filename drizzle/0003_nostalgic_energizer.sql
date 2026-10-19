CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_slug" text NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" bigint NOT NULL,
	"origin" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_slug" text NOT NULL,
	"captain_id" bigint NOT NULL,
	"name" text NOT NULL,
	"capacity" integer,
	"identity_published" boolean DEFAULT false NOT NULL,
	"roster_published" boolean DEFAULT false NOT NULL,
	"finalized_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	CONSTRAINT "teams_id_edition_unique" UNIQUE("id","edition_slug")
);
--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_osu_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("osu_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_team_id_edition_slug_teams_id_edition_slug_fk" FOREIGN KEY ("team_id","edition_slug") REFERENCES "public"."teams"("id","edition_slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_edition_slug_edition_state_slug_fk" FOREIGN KEY ("edition_slug") REFERENCES "public"."edition_state"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_captain_id_users_osu_id_fk" FOREIGN KEY ("captain_id") REFERENCES "public"."users"("osu_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "membership_active_edition_user_unique" ON "memberships" USING btree ("edition_slug","user_id") WHERE "memberships"."left_at" IS NULL;--> statement-breakpoint
CREATE INDEX "membership_team_idx" ON "memberships" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_active_captain_unique" ON "teams" USING btree ("edition_slug","captain_id") WHERE "teams"."archived_at" IS NULL;