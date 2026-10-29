import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
// Keep the process key in a closure, separate from enumerable connection entries.
// This limits accidental connection dumps; it cannot defend a full heap compromise.
function createVault() {
  const key = randomBytes(32);
  return {
    seal(token: string) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const ciphertext = Buffer.concat([
        cipher.update(token, "utf8"),
        cipher.final(),
      ]);
      return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
    },
    open(sealed: Buffer) {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        sealed.subarray(0, 12),
      );
      decipher.setAuthTag(sealed.subarray(12, 28));
      return Buffer.concat([
        decipher.update(sealed.subarray(28)),
        decipher.final(),
      ]).toString("utf8");
    },
  };
}
const state = globalThis as typeof globalThis & {
  oclrRemoteCredentialVault?: ReturnType<typeof createVault>;
};
// Route bundles must share the same key without persisting it to disk/configuration.
export const remoteCredentialVault = (state.oclrRemoteCredentialVault ??=
  createVault());
