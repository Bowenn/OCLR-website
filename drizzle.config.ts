import { defineConfig } from "drizzle-kit";
import * as nextEnv from "@next/env";

// Support both native ESM and Drizzle Kit's CommonJS config loader.
const env = "default" in nextEnv ? nextEnv.default : nextEnv;
(env as typeof nextEnv).loadEnvConfig(
  process.cwd(),
  process.env.NODE_ENV !== "production",
);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
});
