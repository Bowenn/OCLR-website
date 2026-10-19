import { z } from "zod";
import { appUrl, HttpError } from "../http";
export function privacyReady() {
  return (
    z.email().safeParse(process.env.PRIVACY_CONTACT_EMAIL).success &&
    Boolean(process.env.PRIVACY_RETENTION_NOTICE?.trim())
  );
}
export function authReady() {
  return Boolean(
    process.env.APP_URL &&
    process.env.DATABASE_URL &&
    process.env.OSU_CLIENT_ID &&
    process.env.OSU_CLIENT_SECRET &&
    privacyReady(),
  );
}
export function oauthConfig() {
  if (!authReady() || !/^\d+$/.test(process.env.OSU_CLIENT_ID!))
    throw new HttpError(
      503,
      "osu! sign-in is not configured yet. Please return later.",
    );
  return {
    clientId: process.env.OSU_CLIENT_ID!,
    clientSecret: process.env.OSU_CLIENT_SECRET!,
    redirectUri: `${appUrl()}/auth/osu/callback`,
  };
}
export const sessionCookie = () =>
  process.env.APP_URL?.startsWith("https:")
    ? "__Host-oclr_session"
    : "oclr_session";
export const stateCookie = () =>
  process.env.APP_URL?.startsWith("https:")
    ? "__Host-oclr_oauth"
    : "oclr_oauth";
export const cookieOptions = () => ({
  httpOnly: true,
  secure: Boolean(process.env.APP_URL?.startsWith("https:")),
  sameSite: "lax" as const,
  path: "/",
});
