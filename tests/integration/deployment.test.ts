import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { assertTestDatabase } from "../database";

const base = process.env.TEST_DATABASE_URL;
describe.skipIf(!base)("deployment migrations and verified backups", () => {
  it("installs and upgrades one persistent isolated DB, preserves data, rejects drift/incorrect targets, and rolls back failed SQL", async () => {
    assertTestDatabase(base);
    const suffix = randomUUID().replaceAll("-", "");
    const name = `oclr_deploy_${suffix}_test`,
      owner = `migrate_${suffix}`,
      reader = `runtime_${suffix}`;
    const admin = new Pool({ connectionString: base });
    const directory = mkdtempSync(join(tmpdir(), "oclr-deployment-db-test-"));
    let pool: Pool | undefined;
    try {
      await admin.query(
        `CREATE ROLE ${owner} LOGIN PASSWORD 'isolated_fixture_only'`,
      );
      await admin.query(
        `CREATE ROLE ${reader} LOGIN PASSWORD 'isolated_fixture_only'`,
      );
      await admin.query(`CREATE DATABASE ${name} OWNER ${owner}`);
      const migration = new URL(base);
      migration.pathname = `/${name}`;
      migration.username = owner;
      migration.password = "isolated_fixture_only";
      migration.search = "?sslmode=disable";
      const runtime = new URL(migration);
      runtime.username = reader;
      pool = new Pool({ connectionString: migration.toString() });
      // Exercise the documented existing-instance setup: no superuser runtime or DDL grants.
      await pool.query(`REVOKE ALL ON DATABASE ${name} FROM PUBLIC;
        GRANT CONNECT ON DATABASE ${name} TO ${reader};
        REVOKE CREATE ON SCHEMA public FROM PUBLIC;
        GRANT USAGE ON SCHEMA public TO ${reader};
        ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${reader};
        ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${reader}`);
      mkdirSync(join(directory, "drizzle/meta"), { recursive: true });
      symlinkSync(resolve("node_modules"), join(directory, "node_modules"));
      const entries: {
        idx: number;
        when: number;
        tag: string;
        breakpoints: boolean;
      }[] = [];
      function add(sql: string) {
        const idx = entries.length,
          tag = `${String(idx).padStart(4, "0")}_fixture`;
        entries.push({
          idx,
          when: 1800000000000 + idx,
          tag,
          breakpoints: true,
        });
        writeFileSync(join(directory, `drizzle/${tag}.sql`), sql);
        writeFileSync(
          join(directory, "drizzle/meta/_journal.json"),
          JSON.stringify({ version: "7", dialect: "postgresql", entries }),
        );
      }
      const helper = resolve("scripts/deployment-db.ts");
      function run(mode: string, overrides: Record<string, string> = {}) {
        const backup = mkdtempSync(join(directory, "backup-"));
        const result = spawnSync(
          process.execPath,
          ["--import", "tsx", helper, mode, backup],
          {
            cwd: directory,
            encoding: "utf8",
            timeout: 15000,
            env: {
              ...process.env,
              OCLR_ENVIRONMENT: "staging",
              DATABASE_URL: runtime.toString(),
              MIGRATION_DATABASE_URL: migration.toString(),
              OCLR_EXPECTED_DB_HOST: migration.hostname,
              OCLR_EXPECTED_DB_NAME: name,
              ...overrides,
            },
          },
        );
        return { ...result, backup };
      }
      add(
        "CREATE TABLE retained (id serial PRIMARY KEY, label text NOT NULL);",
      );
      let result = run("apply");
      expect(result.status, result.stdout + result.stderr).toBe(0);
      expect(existsSync(join(result.backup, "database.dump.sha256"))).toBe(
        true,
      );
      await pool.query(
        "INSERT INTO retained(label) VALUES ('persisted registration/team/pool/result placeholder')",
      );
      const readerPool = new Pool({ connectionString: runtime.toString() });
      try {
        expect(
          (await readerPool.query("SELECT * FROM retained")).rowCount,
        ).toBe(1);
        await expect(
          readerPool.query("CREATE TABLE unauthorized (id integer)"),
        ).rejects.toThrow(/permission denied/);
      } finally {
        await readerPool.end();
      }
      // Upgrade 1 adds a column; upgrade 2 deliberately has no migrations.
      add(
        "ALTER TABLE retained ADD COLUMN reviewed boolean NOT NULL DEFAULT false;",
      );
      result = run("apply", { OCLR_ENVIRONMENT: "production" });
      expect(result.status, result.stdout + result.stderr).toBe(0);
      expect(
        (await pool.query("SELECT label, reviewed FROM retained")).rows,
      ).toEqual([
        {
          label: "persisted registration/team/pool/result placeholder",
          reviewed: false,
        },
      ]);
      result = run("apply");
      expect(result.status, result.stdout + result.stderr).toBe(0);
      expect(result.stdout).toContain("none (safe no-op)");
      expect(existsSync(join(result.backup, "migration.started"))).toBe(false);
      expect(
        (await pool.query("SELECT * FROM drizzle.__drizzle_migrations"))
          .rowCount,
      ).toBe(2);
      const restore = spawnSync(
        "pg_restore",
        ["--list", join(result.backup, "database.dump")],
        { encoding: "utf8" },
      );
      expect(restore.status, restore.stderr).toBe(0);
      expect(restore.stdout).toContain("retained");
      expect(
        run("inspect", { OCLR_EXPECTED_DB_NAME: "wrong_test_database" }).stderr,
      ).toContain("does not match");
      expect(run("inspect", { PGPORT: "1" }).stderr).toContain(
        "Unset inherited PG*",
      );
      expect(run("inspect", { OCLR_ENVIRONMENT: "production" }).status).toBe(0);
      expect(
        run("inspect", {
          MIGRATION_DATABASE_URL: `${migration}&sslmode=verify-full`,
        }).status,
      ).not.toBe(0);
      await pool.query(
        "SELECT pg_advisory_lock(hashtext('oclr-production-update'))",
      );
      try {
        expect(run("apply").stderr).toContain("Another database deployment");
      } finally {
        await pool.query(
          "SELECT pg_advisory_unlock(hashtext('oclr-production-update'))",
        );
      }
      const first = join(directory, "drizzle/0000_fixture.sql"),
        original = readFileSync(first, "utf8");
      writeFileSync(first, `${original}\n-- changed history`);
      expect(run("inspect").stderr).toContain("differs from this release");
      writeFileSync(first, original);
      // A missing backup binary is fatal before even recording migration start.
      add(
        "ALTER TABLE retained ADD COLUMN must_rollback integer; --> statement-breakpoint\nSELECT * FROM missing_table;",
      );
      const failedBackup = run("apply", { PATH: "/nonexistent" });
      expect(failedBackup.status).toBe(1);
      expect(existsSync(join(failedBackup.backup, "migration.started"))).toBe(
        false,
      );
      const failedMigration = run("apply");
      expect(failedMigration.status).toBe(1);
      expect(
        existsSync(join(failedMigration.backup, "migration.started")),
      ).toBe(true);
      expect(
        (await pool.query("SELECT * FROM drizzle.__drizzle_migrations"))
          .rowCount,
      ).toBe(2);
      expect(
        (await pool.query("SELECT * FROM retained")).rows[0],
      ).not.toHaveProperty("must_rollback");
      expect((await pool.query("SELECT * FROM retained")).rowCount).toBe(1);
    } finally {
      await pool?.end();
      await admin.query(`DROP DATABASE IF EXISTS ${name}`);
      await admin.query(`DROP ROLE IF EXISTS ${reader}, ${owner}`);
      await admin.end();
      rmSync(directory, { recursive: true, force: true });
    }
  }, 120000);
});
