CREATE TABLE "user_profile_cache" (
	"osu_id" bigint NOT NULL,
	"mode" text NOT NULL,
	"profile" jsonb,
	"attempted_at" timestamp with time zone NOT NULL,
	"retry_at" timestamp with time zone NOT NULL,
	"refresh_token" uuid,
	"error_status" integer,
	CONSTRAINT "user_profile_cache_osu_id_mode_pk" PRIMARY KEY("osu_id","mode"),
	CONSTRAINT "user_profile_cache_id_positive" CHECK ("user_profile_cache"."osu_id" > 0 AND "user_profile_cache"."osu_id" <= 9007199254740991),
	CONSTRAINT "user_profile_cache_mode" CHECK ("user_profile_cache"."mode" IN ('osu', 'taiko', 'fruits', 'mania'))
);
--> statement-breakpoint
CREATE INDEX "user_profile_cache_attempt_idx" ON "user_profile_cache" USING btree ("attempted_at");