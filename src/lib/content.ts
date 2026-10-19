import { readFileSync } from "node:fs";
import defaultEditions from "@/content/editions.json" with { type: "json" };
import { editionsSchema } from "./editions";
// Operations may mount approved content outside the application bundle.
export function getEditions() {
  const filename = process.env.OCLR_EDITIONS_FILE;
  return editionsSchema.parse(
    filename
      ? JSON.parse(readFileSync(/* turbopackIgnore: true */ filename, "utf8"))
      : defaultEditions,
  );
}
export function getPublicEditions() {
  return getEditions().filter((e) => e.published);
}
export function getPublicEdition(slug: string) {
  return getPublicEditions().find((e) => e.slug === slug);
}
