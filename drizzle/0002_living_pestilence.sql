CREATE TABLE "captains" (
	"edition_slug" text NOT NULL,
	"user_id" bigint NOT NULL,
	"position" integer NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	CONSTRAINT "captains_edition_slug_user_id_pk" PRIMARY KEY("edition_slug","user_id"),
	CONSTRAINT "captains_edition_position_unique" UNIQUE("edition_slug","position")
);
--> statement-breakpoint
CREATE TABLE "edition_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_slug" text NOT NULL,
	"actor_id" bigint,
	"kind" text NOT NULL,
	"reason" text NOT NULL,
	"detail" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "edition_state" ADD COLUMN "setup_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "edition_state" ADD COLUMN "pool_published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "draft_unavailable_reason" text;--> statement-breakpoint
ALTER TABLE "captains" ADD CONSTRAINT "captains_edition_slug_edition_state_slug_fk" FOREIGN KEY ("edition_slug") REFERENCES "public"."edition_state"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captains" ADD CONSTRAINT "captains_user_id_users_osu_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("osu_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_events" ADD CONSTRAINT "edition_events_edition_slug_edition_state_slug_fk" FOREIGN KEY ("edition_slug") REFERENCES "public"."edition_state"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_events" ADD CONSTRAINT "edition_events_actor_id_users_osu_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("osu_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "edition_events_edition_idx" ON "edition_events" USING btree ("edition_slug");