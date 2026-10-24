ALTER TYPE "public"."staff_role" ADD VALUE 'developer';
--> statement-breakpoint
ALTER TABLE "staff_roles" ADD CONSTRAINT "developer_global_only" CHECK ("staff_roles"."role"::text <> 'developer' OR "staff_roles"."edition_slug" IS NULL);
