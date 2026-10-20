import { expect, it } from "vitest";
import { assertTestDatabase } from "../database";
it("requires a distinct test database name rather than a misleading substring", () => {
  for (const name of [
    "oclr_test",
    "test",
    "oclr-test-migration",
    "oclr_operations_migration_20261020_test",
  ])
    expect(() =>
      assertTestDatabase(`postgres://127.0.0.1/${name}`),
    ).not.toThrow();
  for (const input of [
    undefined,
    "",
    "not a URL",
    "https://example.test/oclr_test",
    "postgres://127.0.0.1/contest",
    "postgres://127.0.0.1/oclr_production",
    "postgres://127.0.0.1/latest",
    "postgres://127.0.0.1/%2Ftest",
  ])
    expect(() => assertTestDatabase(input)).toThrow();
});
