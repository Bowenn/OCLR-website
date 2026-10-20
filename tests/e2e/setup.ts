import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
import prepared from "../../drizzle/legacy-editions.json" with { type: "json" };
import { closeDb } from "../../src/db";
export async function seedBrowserEditions() {
  if (!process.env.TEST_DATABASE_URL) return;
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await seedEditions(
    [
      ...prepared,
      edition,
      {
        ...edition,
        slug: "draft-desktop-test",
        name: "Synthetic desktop draft",
      },
      { ...edition, slug: "draft-mobile-test", name: "Synthetic mobile draft" },
    ],
    false,
  );
}
export default async function setup() {
  await seedBrowserEditions();
  await closeDb();
}
