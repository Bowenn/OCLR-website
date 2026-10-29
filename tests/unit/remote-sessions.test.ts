import { afterEach, expect, it, vi } from "vitest";
import {
  connectRemote,
  disconnectRemote,
  remoteConnection,
  verifiedConnection,
  remoteSessionLifetime,
} from "../../src/lib/remote-sessions";
import { remoteCredentialVault } from "../../src/lib/remote-credential-vault";
import { remoteRead } from "../../src/lib/remote-transport";
vi.mock("../../src/lib/remote-transport", () => ({ remoteRead: vi.fn() }));
afterEach(() => {
  vi.restoreAllMocks();
});
it("keeps authenticated ciphertext in entries, revalidates with the credential and clears on disconnect", async () => {
  const token = `oclr_dev_${"Q".repeat(43)}`;
  vi.mocked(remoteRead).mockResolvedValue({
    data: {
      user: { osuId: 1, username: "Synthetic" },
      access: {
        kind: "developer-read",
        scopes: ["identity:read"],
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
    },
  } as never);
  const { id, expiresAt } = await connectRemote({ mode: "developer", token });
  try {
    const stored = remoteConnection(id);
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(stored).not.toHaveProperty("token");
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + remoteSessionLifetime);
    expect((await verifiedConnection(id)).identity?.user.osuId).toBe(1);
    expect(remoteRead).toHaveBeenLastCalledWith("/me", undefined, token);
    const sealed = stored.sealedToken!;
    disconnectRemote(id);
    expect(sealed.every((byte) => byte === 0)).toBe(true);
    expect(() => remoteConnection(id)).toThrow();
  } finally {
    disconnectRemote(id);
  }
});
it("expires at the backend credential expiry and removes revoked sessions", async () => {
  const expiry = Date.now() + 5000;
  vi.mocked(remoteRead).mockResolvedValue({
    data: {
      user: { osuId: 1, username: "Synthetic" },
      access: {
        kind: "developer-read",
        scopes: [],
        expiresAt: new Date(expiry).toISOString(),
      },
    },
  } as never);
  const { id, expiresAt } = await connectRemote({
    mode: "developer",
    token: `oclr_dev_${"R".repeat(43)}`,
  });
  expect(expiresAt).toBe(expiry);
  vi.spyOn(Date, "now").mockReturnValue(expiry);
  expect(() => remoteConnection(id)).toThrow();
});
it("authenticates ciphertext and uses distinct nonces", () => {
  const first = remoteCredentialVault.seal("synthetic");
  expect(remoteCredentialVault.seal("synthetic")).not.toEqual(first);
  first[first.length - 1] ^= 1;
  expect(() => remoteCredentialVault.open(first)).toThrow();
});
