import { readFileSync } from "node:fs";
import { z } from "zod";
import defaultAnnouncements from "@/content/announcements.json" with { type: "json" };
export const announcementsSchema = z
  .array(
    z
      .object({
        slug: z
          .string()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
          .max(100),
        title: z.string().min(1).max(160),
        summary: z.string().min(1).max(500),
        published: z.boolean(),
        publishedAt: z.iso.datetime({ offset: true }).nullable(),
        sections: z
          .array(
            z
              .object({
                heading: z.string().min(1).max(160),
                body: z.string().min(1).max(20000),
              })
              .strict(),
          )
          .min(1)
          .max(32),
      })
      .strict()
      .refine(
        (v) => !v.published || v.publishedAt !== null,
        "Published announcements require a publication time",
      ),
  )
  .refine(
    (values) => new Set(values.map((v) => v.slug)).size === values.length,
    "Announcement slugs must be unique",
  );
export function getAnnouncements() {
  const path = process.env.OCLR_ANNOUNCEMENTS_FILE;
  return announcementsSchema.parse(
    path
      ? JSON.parse(readFileSync(/* turbopackIgnore: true */ path, "utf8"))
      : defaultAnnouncements,
  );
}
export function publicAnnouncements(now = new Date()) {
  return getAnnouncements()
    .filter(
      (a) =>
        a.published &&
        a.publishedAt &&
        Date.parse(a.publishedAt) <= now.getTime(),
    )
    .sort((a, b) => Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!));
}
export function publicAnnouncement(slug: string) {
  return publicAnnouncements().find((a) => a.slug === slug);
}
