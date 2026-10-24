CREATE TABLE "player_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_slug" text NOT NULL,
	"player_id" bigint NOT NULL,
	"author_id" bigint NOT NULL,
	"request_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_messages_author_request_unique" UNIQUE("author_id","request_id"),
	CONSTRAINT "player_messages_body_length" CHECK (char_length(btrim("player_messages"."body")) BETWEEN 1 AND 1000)
);
--> statement-breakpoint
ALTER TABLE "player_messages" ADD CONSTRAINT "player_messages_edition_slug_edition_state_slug_fk" FOREIGN KEY ("edition_slug") REFERENCES "public"."edition_state"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_messages" ADD CONSTRAINT "player_messages_player_id_users_osu_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."users"("osu_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_messages" ADD CONSTRAINT "player_messages_author_id_users_osu_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("osu_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "player_messages_target_idx" ON "player_messages" USING btree ("edition_slug","player_id","created_at");--> statement-breakpoint
CREATE INDEX "player_messages_author_time_idx" ON "player_messages" USING btree ("author_id","created_at");