import { randomBytes, createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { beforeEach, afterAll, describe, it, expect } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import { fixtureReferees, staffRoles } from "../../src/db/schema";
import {
  desktopAuthorizations,
  desktopSessions,
} from "../../src/db/desktop-auth-schema";
import {
  createDesktopAuthorization,
  getDesktopAuthorization,
  approveDesktopAuthorization,
  exchangeDesktopAuthorization,
  refreshDesktopAuthorization,
  requireDesktopUser,
  revokeDesktopAuthorization,
  desktopResponse,
  listDesktopSessions,
  revokeDesktopSession,
  desktopScopes,
} from "../../src/lib/desktop-auth";
import { desktopFixtures, desktopPanel } from "../../src/lib/desktop-referee";
import {
  seedRefereeFixture,
  refereeTestUser,
  refereeTestAdmin,
} from "../fixtures/referee";
import { assertTestDatabase } from "../database";
const enabled = !!process.env.TEST_DATABASE_URL;
describe.skipIf(!enabled)(
  "desktop PKCE authorization and private read boundary",
  () => {
    let seeded: Awaited<ReturnType<typeof seedRefereeFixture>>;
    beforeEach(async () => {
      assertTestDatabase(process.env.TEST_DATABASE_URL);
      process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
      process.env.APP_URL = "http://127.0.0.1:3001";
      seeded = await seedRefereeFixture();
      await db().execute(
        sql`TRUNCATE desktop_authorizations, desktop_sessions, desktop_tokens, desktop_security_events CASCADE`,
      );
    });
    afterAll(closeDb);
    async function request() {
      const verifier = randomBytes(32).toString("base64url");
      const body = {
        client_id: "oclr-ref-tools",
        client_version: "0.8.0",
        platform: "linux",
        device_name: "OCLR ref tools",
        redirect_uri: "http://127.0.0.1:49152/oclr/callback",
        scope: [...desktopScopes],
        state: randomBytes(32).toString("base64url"),
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
        code_challenge_method: "S256",
      };
      const info = await createDesktopAuthorization(body);
      return { body, info, verifier };
    }
    async function approved() {
      const r = await request();
      const url = new URL(
        await approveDesktopAuthorization(
          refereeTestUser,
          r.info.authorization_request_id,
          true,
        ),
      );
      return {
        ...r,
        exchange: {
          client_id: "oclr-ref-tools",
          authorization_request_id: r.info.authorization_request_id,
          code: url.searchParams.get("code")!,
          code_verifier: r.verifier,
          redirect_uri: r.body.redirect_uri,
        },
      };
    }
    async function login() {
      const r = await approved();
      return { ...r, token: await exchangeDesktopAuthorization(r.exchange) };
    }
    const bearer = (
      token: string,
      path = "/api/referee/v1/me/fixtures?view=active&limit=50",
    ) =>
      new Request("http://127.0.0.1:3001" + path, {
        headers: { Authorization: `Bearer ${token}` },
      });
    it("requires loopback S256, rejects unsupported scope and has no GET approval side effects", async () => {
      const r = await request();
      for (const patch of [
        { redirect_uri: "https://evil.example/oclr/callback" },
        { redirect_uri: "http://127.0.0.1:80/oclr/callback" },
        { code_challenge_method: "plain" },
        { scope: ["admin:write"] },
      ])
        await expect(
          createDesktopAuthorization({ ...r.body, ...patch }),
        ).rejects.toMatchObject({ status: 400 });
      const view = await getDesktopAuthorization(
        refereeTestUser,
        r.info.authorization_request_id,
      );
      expect(view.verificationCode).toBe(r.info.verification_code);
      expect(await db().select().from(desktopSessions)).toHaveLength(0);
      const url = new URL(
        await approveDesktopAuthorization(
          refereeTestUser,
          r.info.authorization_request_id,
          false,
        ),
      );
      expect(url.searchParams.get("error")).toBe("access_denied");
      expect(url.searchParams.get("state")).toBe(r.body.state);
      await expect(
        approveDesktopAuthorization(
          refereeTestUser,
          r.info.authorization_request_id,
          true,
        ),
      ).rejects.toMatchObject({ status: 409 });
    });
    it("binds verifier and redirect without consuming valid code; exchange is one-time under concurrency", async () => {
      const r = await approved();
      await expect(
        exchangeDesktopAuthorization({
          ...r.exchange,
          code_verifier: "A".repeat(43),
        }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        exchangeDesktopAuthorization({
          ...r.exchange,
          redirect_uri: "http://127.0.0.1:49153/oclr/callback",
        }),
      ).rejects.toMatchObject({ status: 400 });
      const replies = await Promise.allSettled([
        exchangeDesktopAuthorization(r.exchange),
        exchangeDesktopAuthorization(r.exchange),
      ]);
      expect(replies.filter((x) => x.status === "fulfilled")).toHaveLength(1);
      expect(await db().select().from(desktopSessions)).toHaveLength(1);
    });
    it("terminates after five invalid attempts and rejects expired authorizations", async () => {
      const r = await approved();
      for (let i = 0; i < 5; i++)
        await expect(
          exchangeDesktopAuthorization({
            ...r.exchange,
            code_verifier: "A".repeat(43),
          }),
        ).rejects.toMatchObject({ status: 400 });
      await expect(
        exchangeDesktopAuthorization(r.exchange),
      ).rejects.toMatchObject({ status: 400 });
      const a = await request();
      await db()
        .update(desktopAuthorizations)
        .set({ expiresAt: new Date(0) })
        .where(eq(desktopAuthorizations.id, a.info.authorization_request_id));
      await expect(
        approveDesktopAuthorization(
          refereeTestUser,
          a.info.authorization_request_id,
          true,
        ),
      ).rejects.toMatchObject({ status: 410 });
    });
    it("expires approved exchange codes within 60 seconds and never extends request expiry", async () => {
      const startedAt = Date.now();
      const r = await approved();
      const [row] = await db()
        .select()
        .from(desktopAuthorizations)
        .where(eq(desktopAuthorizations.id, r.info.authorization_request_id));
      expect(row.expiresAt.getTime()).toBeGreaterThanOrEqual(startedAt + 60000);
      expect(row.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 60000);
      await db()
        .update(desktopAuthorizations)
        .set({ expiresAt: new Date(0) })
        .where(eq(desktopAuthorizations.id, row.id));
      await expect(
        exchangeDesktopAuthorization(r.exchange),
      ).rejects.toMatchObject({
        code: "INVALID_GRANT",
      });
      expect(await db().select().from(desktopSessions)).toHaveLength(0);

      const ending = await request();
      const originalExpiry = new Date(Date.now() + 30000);
      await db()
        .update(desktopAuthorizations)
        .set({ expiresAt: originalExpiry })
        .where(
          eq(desktopAuthorizations.id, ending.info.authorization_request_id),
        );
      await approveDesktopAuthorization(
        refereeTestUser,
        ending.info.authorization_request_id,
        true,
      );
      const [clipped] = await db()
        .select()
        .from(desktopAuthorizations)
        .where(
          eq(desktopAuthorizations.id, ending.info.authorization_request_id),
        );
      expect(clipped.expiresAt).toEqual(originalExpiry);
    });
    it("rotates refresh family and revokes old and new access on refresh reuse", async () => {
      const { token } = await login();
      const refreshed = await refreshDesktopAuthorization({
        client_id: "oclr-ref-tools",
        refresh_token: token.refresh_token,
      });
      expect(refreshed.session_id).toBe(token.session_id);
      expect(refreshed.session_expires_at).toBe(token.session_expires_at);
      expect(refreshed.refresh_token).not.toBe(token.refresh_token);
      expect(
        (await requireDesktopUser(bearer(token.access_token), "referee:relay"))
          .osuId,
      ).toBe(refereeTestUser.osuId);
      await expect(
        refreshDesktopAuthorization({
          client_id: "oclr-ref-tools",
          refresh_token: token.refresh_token,
        }),
      ).rejects.toMatchObject({ status: 401 });
      await expect(
        requireDesktopUser(bearer(refreshed.access_token)),
      ).rejects.toMatchObject({ code: "SESSION_REVOKED" });
    });
    it("enforces subject session revoke and current referee grants", async () => {
      const { token } = await login();
      await revokeDesktopSession(refereeTestAdmin, token.session_id);
      await requireDesktopUser(bearer(token.access_token));
      await revokeDesktopAuthorization({
        client_id: "oclr-ref-tools",
        refresh_token: token.refresh_token,
      });
      await expect(
        requireDesktopUser(bearer(token.access_token)),
      ).rejects.toMatchObject({ status: 401 });
      const b = await login();
      await db()
        .update(staffRoles)
        .set({ revokedAt: new Date() })
        .where(eq(staffRoles.userId, refereeTestUser.osuId));
      await expect(
        requireDesktopUser(bearer(b.token.access_token)),
      ).rejects.toMatchObject({ status: 403 });
      expect(
        JSON.stringify(await listDesktopSessions(refereeTestUser)),
      ).not.toContain("oclr_desk_");
    });
    it("serves client-shaped snapshots only for assigned fixtures and never initializes on GET", async () => {
      const r = await login();
      const list = await desktopFixtures(bearer(r.token.access_token));
      expect(list.items.map((f) => f.fixtureId)).toContain(seeded.fixtureId);
      const panel = await desktopPanel(
        bearer(
          r.token.access_token,
          `/api/referee/v1/fixtures/${seeded.fixtureId}/panel`,
        ),
        seeded.fixtureId,
      );
      expect(panel.viewer.osuId).toBe(refereeTestUser.osuId);
      expect(panel.workspace.session?.revision).toBe(
        seeded.workspace.session?.revision,
      );
      expect(JSON.stringify(panel)).not.toContain("oclr_desk_");
      // Cross-repository schema validation consumes only fictional fixtures and unusable tokens.
      for (const [name, data] of Object.entries({
        fixtures: list,
        panel,
        request: r.info,
        token: {
          ...r.token,
          access_token: "oclr_desk_at_" + "A".repeat(43),
          refresh_token: "oclr_desk_rt_" + "B".repeat(43),
        },
      }))
        writeFileSync(
          `/tmp/oclr-desktop-contract-${name}.json`,
          await desktopResponse(data).text(),
        );
      await db()
        .delete(fixtureReferees)
        .where(
          and(
            eq(fixtureReferees.fixtureId, seeded.fixtureId),
            eq(fixtureReferees.userId, refereeTestUser.osuId),
          ),
        );
      await expect(
        desktopPanel(
          bearer(
            r.token.access_token,
            `/api/referee/v1/fixtures/${seeded.fixtureId}/panel`,
          ),
          seeded.fixtureId,
        ),
      ).rejects.toMatchObject({ status: 404 });
      expect(
        (await desktopFixtures(bearer(r.token.access_token))).items,
      ).toHaveLength(0);
      // Admin desktop tokens do not inherit the browser's all-fixtures exception.
      await db()
        .insert(staffRoles)
        .values({
          userId: refereeTestAdmin.osuId,
          editionSlug: "test-cup",
          role: "admin",
          grantedBy: refereeTestAdmin.osuId,
        })
        .onConflictDoNothing();
      const a = await request();
      const uri = new URL(
        await approveDesktopAuthorization(
          refereeTestAdmin,
          a.info.authorization_request_id,
          true,
        ),
      );
      const t = await exchangeDesktopAuthorization({
        client_id: "oclr-ref-tools",
        authorization_request_id: a.info.authorization_request_id,
        code: uri.searchParams.get("code"),
        code_verifier: a.verifier,
        redirect_uri: a.body.redirect_uri,
      });
      await expect(
        desktopPanel(
          bearer(
            t.access_token,
            `/api/referee/v1/fixtures/${seeded.fixtureId}/panel`,
          ),
          seeded.fixtureId,
        ),
      ).rejects.toMatchObject({ status: 404 });
    });
  },
);
