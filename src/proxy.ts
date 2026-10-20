import { NextRequest, NextResponse } from "next/server";
import { appUrl } from "@/lib/http";
export function proxy(request: NextRequest) {
  let canonical: URL | null = null;
  try {
    canonical = process.env.APP_URL ? new URL(appUrl()) : null;
  } catch {
    return NextResponse.json(
      { error: "The site origin is not configured correctly." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (
    canonical &&
    request.headers.get("host") !== canonical.host &&
    ["GET", "HEAD"].includes(request.method)
  ) {
    canonical.pathname = request.nextUrl.pathname;
    canonical.search = request.nextUrl.search;
    return NextResponse.redirect(canonical, 308);
  }
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https://a.ppy.sh https://assets.ppy.sh data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(canonical?.protocol === "https:" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
  const headers = new Headers(request.headers);
  headers.set("Content-Security-Policy", policy);
  headers.set("x-nonce", nonce);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  if (canonical?.protocol === "https:")
    response.headers.set("Strict-Transport-Security", "max-age=31536000");
  if (
    request.nextUrl.pathname.startsWith("/api/") ||
    request.nextUrl.pathname.startsWith("/auth/")
  )
    response.headers.set("Cache-Control", "no-store");
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|rookie-stage.svg).*)"],
};
