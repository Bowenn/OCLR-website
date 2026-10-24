export const localDatabase = {
  container: "oclr-frontend-postgres",
  volume: "oclr-frontend-postgres-data",
  name: "oclr_frontend_test",
  user: "oclr_frontend",
  port: "55434",
  label: "frontend-test-v1",
} as const;

/** The demo writer is deliberately restricted to this disposable local database. */
export function assertDevelopmentDatabase(
  databaseUrl: string | undefined,
  testDatabaseUrl: string | undefined,
  nodeEnv = process.env.NODE_ENV,
) {
  if (nodeEnv === "production")
    throw new Error("Development data is disabled in production.");
  if (!databaseUrl || !testDatabaseUrl || databaseUrl !== testDatabaseUrl)
    throw new Error(
      "DATABASE_URL and TEST_DATABASE_URL must identify the same local test database.",
    );
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("Invalid local test database configuration.");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.port !== localDatabase.port ||
    url.pathname !== `/${localDatabase.name}` ||
    (url.searchParams.size > 0 &&
      (url.searchParams.size !== 1 ||
        url.searchParams.get("sslmode") !== "disable"))
  )
    throw new Error(
      `Development data requires the loopback database ${localDatabase.name} on port ${localDatabase.port}.`,
    );
}
