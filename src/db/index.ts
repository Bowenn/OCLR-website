import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
const globalDb = globalThis as unknown as { oclrPool?: Pool };
export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured");
  globalDb.oclrPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
  });
  return globalDb.oclrPool;
}
export function db() {
  return drizzle(getPool());
}
