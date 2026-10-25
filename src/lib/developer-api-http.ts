import { randomUUID } from "node:crypto";
import { appUrl, HttpError } from "./http";
import {
  authenticateDeveloperRead,
  DeveloperApiError,
  developerApiLimiter,
  developerOrigins,
  type DeveloperReadPrincipal,
} from "./developer-api";
import type { DeveloperApiScope } from "./developer-api-model";

function responseHeaders(request: Request, id: string) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-Request-Id": id,
    Vary: "Origin",
  });
  const origin = request.headers.get("origin");
  if (origin !== null && developerOrigins().includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set(
      "Access-Control-Expose-Headers",
      "X-Request-Id, Retry-After, WWW-Authenticate",
    );
  }
  return headers;
}
function failure(error: unknown, id: string, headers: Headers, head: boolean) {
  const status = error instanceof HttpError ? error.status : 500;
  const code =
    error instanceof DeveloperApiError
      ? error.code
      : status === 500
        ? "INTERNAL_ERROR"
        : "INVALID_REQUEST";
  const message =
    error instanceof HttpError
      ? error.message
      : "This request could not be completed. Please try again.";
  if (status === 401)
    headers.set("WWW-Authenticate", 'Bearer realm="oclr-developer"');
  if (status === 429) headers.set("Retry-After", "60");
  return head
    ? new Response(null, { status, headers })
    : Response.json(
        { error: { code, message, requestId: id } },
        { status, headers },
      );
}
/** The only cross-origin surface. Its callback receives a read principal, not User. */
export async function developerReadResponse(
  request: Request,
  scope: DeveloperApiScope,
  read: (principal: DeveloperReadPrincipal) => unknown | Promise<unknown>,
) {
  const id = randomUUID();
  let headers = new Headers({
    "Cache-Control": "no-store",
    "X-Request-Id": id,
    Vary: "Origin",
  });
  try {
    headers = responseHeaders(request, id);
    // Validate configured transport even for an anonymous preflight/error.
    appUrl();
    developerApiLimiter.take("all-reads", 600);
    const origin = request.headers.get("origin");
    if (origin !== null && !developerOrigins().includes(origin))
      throw new DeveloperApiError(
        403,
        "ORIGIN_NOT_ALLOWED",
        "This local origin is not allowed.",
      );
    if (request.method === "OPTIONS") {
      const method = request.headers.get("access-control-request-method");
      const requestedHeaders = (
        request.headers.get("access-control-request-headers") ?? ""
      )
        .split(",")
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean);
      if (
        (method && !["GET", "HEAD"].includes(method)) ||
        requestedHeaders.some(
          (v) => !["authorization", "accept", "accept-language"].includes(v),
        )
      )
        throw new DeveloperApiError(
          403,
          "PREFLIGHT_REJECTED",
          "This preflight request is not allowed.",
        );
      headers.set("Allow", "GET, HEAD, OPTIONS");
      headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      headers.set(
        "Access-Control-Allow-Headers",
        "Authorization, Accept, Accept-Language",
      );
      headers.set("Access-Control-Max-Age", "300");
      headers.append(
        "Vary",
        "Access-Control-Request-Method, Access-Control-Request-Headers",
      );
      return new Response(null, { status: 204, headers });
    }
    if (!["GET", "HEAD"].includes(request.method)) {
      headers.set("Allow", "GET, HEAD, OPTIONS");
      throw new DeveloperApiError(
        405,
        "READ_ONLY",
        "Developer API access is read-only.",
      );
    }
    if (new URL(request.url).search)
      throw new DeveloperApiError(
        400,
        "INVALID_REQUEST",
        "This endpoint does not accept query parameters.",
      );
    const principal = await authenticateDeveloperRead(request, scope);
    const data = await read(principal);
    const body = JSON.stringify({
      data,
      meta: { apiVersion: "1", requestId: id },
    });
    if (Buffer.byteLength(body) > 262144)
      throw new Error("Bounded API response exceeded");
    headers.set("Content-Type", "application/json");
    return new Response(request.method === "HEAD" ? null : body, { headers });
  } catch (error) {
    return failure(error, id, headers, request.method === "HEAD");
  }
}
/** Unknown v1 resources share the same error/CORS policy, without exposing data. */
export function missingDeveloperResource(request: Request) {
  return developerReadResponse(request, "identity:read", () => {
    throw new DeveloperApiError(
      404,
      "NOT_FOUND",
      "API resource was not found.",
    );
  });
}
