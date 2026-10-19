import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
const globalDb = globalThis as unknown as { oclrPool?: Pool };
export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured");
  if (!globalDb.oclrPool) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
    });
    pool.on("error", () => {
      console.error(
        "Idle database connection closed; subsequent requests will reconnect.",
      );
    });
    globalDb.oclrPool = pool;
  }
  return globalDb.oclrPool;
}
export function db() {
  return drizzle(getPool());
}

export async function closeDb() {
  if (globalDb.oclrPool) {
    await globalDb.oclrPool.end();
    delete globalDb.oclrPool;
  }
}
