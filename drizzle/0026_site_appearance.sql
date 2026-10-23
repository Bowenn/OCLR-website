CREATE TABLE "site_setting_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" bigint,
	"before_appearance" text NOT NULL,
	"after_appearance" text NOT NULL,
	"revision" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_setting_events_revision_unique" UNIQUE("revision"),
	CONSTRAINT "site_setting_events_revision" CHECK ("site_setting_events"."revision" > 0),
	CONSTRAINT "site_setting_events_appearances" CHECK ("site_setting_events"."before_appearance" IN ('default', 'cute-pastel') AND "site_setting_events"."after_appearance" IN ('default', 'cute-pastel') AND "site_setting_events"."before_appearance" <> "site_setting_events"."after_appearance")
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"default_appearance" text DEFAULT 'default' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_settings_singleton" CHECK ("site_settings"."id" = 1),
	CONSTRAINT "site_settings_revision" CHECK ("site_settings"."revision" >= 0),
	CONSTRAINT "site_settings_appearance" CHECK ("site_settings"."default_appearance" IN ('default', 'cute-pastel'))
);
--> statement-breakpoint
ALTER TABLE "site_setting_events" ADD CONSTRAINT "site_setting_events_actor_id_users_osu_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("osu_id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "site_settings" ("id") VALUES (1) ON CONFLICT DO NOTHING;
