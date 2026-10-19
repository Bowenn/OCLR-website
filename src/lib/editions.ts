import { z } from "zod";
const instant = z.iso.datetime({ offset: true });
const question = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
    label: z.string().min(1).max(200),
    required: z.boolean(),
    maxLength: z.number().int().min(1).max(2000).default(500),
  })
  .strict();
export const editionSchema = z
  .object({
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(80),
    name: z.string().min(1).max(100),
    published: z.boolean(),
    status: z.enum(["upcoming", "live", "completed"]),
    summary: z.string().min(1).max(2000),
    timeZone: z.string().refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "Use an IANA time zone"),
    rules: z
      .object({
        version: z.string().min(1).max(80),
        sections: z
          .array(
            z
              .object({ heading: z.string().min(1), body: z.string().min(1) })
              .strict(),
          )
          .min(1),
      })
      .strict()
      .nullable(),
    eligibility: z.string().min(1).max(4000).nullable(),
    registration: z
      .object({
        opensAt: instant,
        closesAt: instant,
        withdrawUntil: instant.nullable(),
        questions: z.array(question).max(16).default([]),
      })
      .strict()
      .refine(
        (v) => Date.parse(v.opensAt) < Date.parse(v.closesAt),
        "Registration must close after it opens",
      )
      .refine(
        (v) =>
          new Set(v.questions.map((q) => q.id)).size === v.questions.length,
        "Question IDs must be unique",
      )
      .nullable(),
    schedule: z.array(
      z.object({ label: z.string().min(1), at: instant.nullable() }).strict(),
    ),
  })
  .strict();
export type Edition = z.infer<typeof editionSchema>;
export const editionsSchema = z
  .array(editionSchema)
  .refine(
    (v) => new Set(v.map((e) => e.slug)).size === v.length,
    "Edition slugs must be unique",
  );
export function enrollmentState(
  edition: Edition,
  now = new Date(),
): "unannounced" | "upcoming" | "open" | "closed" {
  if (
    !edition.published ||
    !edition.registration ||
    !edition.rules ||
    !edition.eligibility
  )
    return "unannounced";
  if (
    edition.status === "completed" ||
    now.getTime() >= Date.parse(edition.registration.closesAt)
  )
    return "closed";
  if (now.getTime() < Date.parse(edition.registration.opensAt))
    return "upcoming";
  return "open";
}
export function formatDate(
  value: string | Date | null,
  timeZone: string,
): string {
  if (!value) return "To be announced";
  return `${new Intl.DateTimeFormat("en-GB", { timeZone, dateStyle: "medium", timeStyle: "short", hourCycle: "h23" }).format(new Date(value))} (${timeZone})`;
}
