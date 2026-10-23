CREATE TABLE "team_coaches" (
	"team_id" uuid NOT NULL,
	"edition_slug" text NOT NULL,
	"user_id" bigint NOT NULL,
	CONSTRAINT "team_coaches_team_id_user_id_pk" PRIMARY KEY("team_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "team_coaches" ADD CONSTRAINT "team_coaches_user_id_users_osu_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("osu_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_coaches" ADD CONSTRAINT "team_coaches_team_id_edition_slug_teams_id_edition_slug_fk" FOREIGN KEY ("team_id","edition_slug") REFERENCES "public"."teams"("id","edition_slug") ON DELETE no action ON UPDATE no action;