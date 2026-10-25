import { developerReadResponse } from "@/lib/developer-api-http";
function respond(request: Request) {
  return developerReadResponse(request, "identity:read", (principal) => ({
    user: principal.subject,
    access: {
      kind: principal.kind,
      scopes: principal.scopes,
      expiresAt: principal.expiresAt,
    },
  }));
}
export {
  respond as GET,
  respond as HEAD,
  respond as OPTIONS,
  respond as POST,
  respond as PUT,
  respond as PATCH,
  respond as DELETE,
};
