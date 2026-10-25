/** Explicit read scopes; ordinary staff/write capabilities are never token scopes. */
export const developerApiScopes = [
  "identity:read",
  "tournaments:read",
  "tournaments:private:read",
  "profiles:read",
] as const;
export type DeveloperApiScope = (typeof developerApiScopes)[number];
export type DeveloperTokenMetadata = {
  id: string;
  origin: string;
  scopes: DeveloperApiScope[];
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
};
export const developerTokenPrefix = "oclr_dev_";
export function validDeveloperToken(value: string): boolean {
  return value.length === 52 && /^oclr_dev_[A-Za-z0-9_-]{43}$/.test(value);
}
/** Canonical loopback origins only; no suffix matching, credentials or paths. */
export function isDeveloperOrigin(value: string) {
  try {
    const url = new URL(value);
    return (
      url.origin === value &&
      ["http:", "https:"].includes(url.protocol) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}
