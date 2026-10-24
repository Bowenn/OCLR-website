ALTER TYPE "public"."staff_role" ADD VALUE 'streamer';--> statement-breakpoint
CREATE TABLE "fixture_streams" (
	"fixture_id" uuid PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"source" text NOT NULL,
	"assigned_by" bigint NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_scheduled_at" timestamp with time zone,
	"confirmed_time_zone" text NOT NULL,
	CONSTRAINT "fixture_streams_source" CHECK ("fixture_streams"."source" IN ('self', 'staff'))
);
--> statement-breakpoint
ALTER TABLE "fixtures" ADD COLUMN "stream_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "fixture_streams" ADD CONSTRAINT "fixture_streams_fixture_id_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixture_streams" ADD CONSTRAINT "fixture_streams_user_id_users_osu_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("osu_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixture_streams" ADD CONSTRAINT "fixture_streams_assigned_by_users_osu_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("osu_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fixture_streams_user_idx" ON "fixture_streams" USING btree ("user_id");