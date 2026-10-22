CREATE TABLE "badge_reviews" (
	"edition_slug" text NOT NULL,
	"user_id" bigint NOT NULL,
	"mode" text NOT NULL,
	"fingerprint" text NOT NULL,
	"classifications" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"reviewed_by" bigint NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "badge_reviews_edition_slug_user_id_mode_pk" PRIMARY KEY("edition_slug","user_id","mode"),
	CONSTRAINT "badge_review_mode" CHECK ("badge_reviews"."mode" IN ('osu', 'taiko', 'fruits', 'mania')),
	CONSTRAINT "badge_review_version" CHECK ("badge_reviews"."version" > 0),
	CONSTRAINT "badge_review_inventory" CHECK (jsonb_typeof("badge_reviews"."classifications") = 'array' AND jsonb_array_length("badge_reviews"."classifications") <= 100)
);
--> statement-breakpoint
ALTER TABLE "badge_reviews" ADD CONSTRAINT "badge_reviews_edition_slug_user_id_registrations_edition_slug_user_id_fk" FOREIGN KEY ("edition_slug","user_id") REFERENCES "public"."registrations"("edition_slug","user_id") ON DELETE no action ON UPDATE no action;