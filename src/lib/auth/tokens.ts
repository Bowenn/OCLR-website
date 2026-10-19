import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
export const randomToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const validToken = (value: string | undefined | null): value is string =>
  Boolean(value && /^[A-Za-z0-9_-]{43}$/.test(value));
export function equalTokens(a: string | undefined, b: string | null) {
  return (
    validToken(a) &&
    validToken(b) &&
    timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}
