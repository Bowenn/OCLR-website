import { z } from "zod";
const instant = z.iso.datetime({ offset: true });
export const questionSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
    label: z.string().trim().min(1).max(200),
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
    name: z.string().trim().min(1).max(100),
    season: z.string().trim().min(1).max(40).nullable().default(null),
    branding: z
      .object({
        logo: z.enum(["/oclr-s11-square-logo.webp"]).nullable(),
        background: z.enum(["/oclr-s11-website-background.webp"]).nullable(),
        keyVisual: z.enum(["/oclr-s11-key-visual.webp"]).nullable(),
      })
      .strict()
      .default({ logo: null, background: null, keyVisual: null }),
    published: z.boolean(),
    status: z.enum(["upcoming", "live", "completed"]),
    summary: z.string().trim().min(1).max(2000),
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
        version: z.string().trim().min(1).max(80),
        sections: z
          .array(
            z
              .object({
                heading: z.string().trim().min(1).max(200),
                body: z.string().trim().min(1).max(20000),
              })
              .strict(),
          )
          .min(1)
          .max(32),
      })
      .strict()
      .nullable(),
    eligibility: z.string().trim().min(1).max(4000).nullable(),
    registration: z
      .object({
        enabled: z.boolean().default(true),
        opensAt: instant,
        closesAt: instant,
        withdrawUntil: instant.nullable(),
        questions: z.array(questionSchema).max(16).default([]),
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
      .refine(
        (v) =>
          !v.withdrawUntil ||
          Date.parse(v.withdrawUntil) >= Date.parse(v.opensAt),
        "Withdrawal deadline must not precede opening",
      )
      .nullable(),
    schedule: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(200),
            at: instant.nullable(),
          })
          .strict(),
      )
      .max(64),
  })
  .strict();
export type Edition = z.output<typeof editionSchema>;
export type EditionConfiguration = Omit<z.output<typeof editionSchema>, "slug">;
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
    edition.registration.enabled === false ||
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
