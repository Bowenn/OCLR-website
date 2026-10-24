import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { staffRoles } from "@/db/schema";
import type { User } from "./sessions";
import { requireUser } from "./user";
import { HttpError } from "../http";

export const capabilities = [
  "view_streaming",
  "select_streaming",
  "manage_streaming",
  "manage_staff",
  "manage_registrations",
  "manage_captains",
  "manage_teams",
  "manage_draft",
  "manage_mappools",
  "manage_fixtures",
  "record_results",
  "approve_results",
  "publish_results",
  "configure_tournament",
] as const;
export type Capability = (typeof capabilities)[number];
export const roles = [
  "admin",
  "mappooler",
  "referee",
  "developer",
  "streamer",
] as const;
export type StaffRole = (typeof roles)[number];
const roleCapabilities: Record<StaffRole, readonly Capability[]> = {
  developer: [],
  admin: capabilities,
  mappooler: ["manage_mappools"],
  referee: ["record_results"],
  streamer: ["view_streaming", "select_streaming"],
};
export type StaffGrant = { role: StaffRole; editionSlug: string | null };
export function permits(
  grants: readonly StaffGrant[],
  capability: Capability,
  edition?: string,
) {
  return grants.some(
    (g) =>
      (g.editionSlug === null || g.editionSlug === edition) &&
      roleCapabilities[g.role].includes(capability),
  );
}
/** Developer adds global reads only. Existing roles keep their original write scopes. */
export function isDeveloper(grants: readonly StaffGrant[]) {
  return grants.some((g) => g.role === "developer" && g.editionSlug === null);
}
export function canRead(
  grants: readonly StaffGrant[],
  capability: Capability,
  edition?: string,
) {
  return isDeveloper(grants) || permits(grants, capability, edition);
}
export async function assertReadCapability(
  user: User,
  capability: Capability,
  edition?: string,
  reader?: StaffReader,
) {
  if (!canRead(await staffAccess(user, reader), capability, edition))
    throw new HttpError(403, "You do not have permission for this operation.");
}
export async function assertBusinessWrite(
  user: User,
  edition?: string,
  reader?: StaffReader,
) {
  const grants = await staffAccess(user, reader);
  if (
    isDeveloper(grants) &&
    !capabilities.some((capability) => permits(grants, capability, edition))
  )
    throw new HttpError(403, "Developer access is read-only.");
}
export function bootstrapAdminIds() {
  return (process.env.ADMIN_OSU_IDS ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => /^[1-9]\d*$/.test(v))
    .map(Number)
    .filter(Number.isSafeInteger);
}
/** No session claims or process cache: revocations apply to the next check. */
type StaffReader = Pick<ReturnType<typeof db>, "select">;
export async function staffAccess(
  user: User,
  reader?: StaffReader,
): Promise<StaffGrant[]> {
  if (bootstrapAdminIds().includes(user.osuId))
    return [{ role: "admin", editionSlug: null }];
  if (!process.env.DATABASE_URL) return [];
  return (reader ?? db())
    .select({ role: staffRoles.role, editionSlug: staffRoles.editionSlug })
    .from(staffRoles)
    .where(
      and(eq(staffRoles.userId, user.osuId), isNull(staffRoles.revokedAt)),
    );
}
export async function hasCapability(
  user: User,
  capability: Capability,
  edition?: string,
  reader?: StaffReader,
) {
  return permits(await staffAccess(user, reader), capability, edition);
}
export async function assertCapability(
  user: User,
  capability: Capability,
  edition?: string,
  reader?: StaffReader,
) {
  if (!(await hasCapability(user, capability, edition, reader)))
    throw new HttpError(403, "You do not have permission for this operation.");
}
export async function isStaff(user: User) {
  return (await staffAccess(user)).length > 0;
}
export async function requireStaff() {
  const user = await requireUser();
  if (!(await isStaff(user)))
    throw new HttpError(403, "Staff access is required.");
  return user;
}
function scopeFor(grants: readonly StaffGrant[], capability: Capability) {
  const allowed = grants.filter((g) =>
    roleCapabilities[g.role].includes(capability),
  );
  if (!allowed.length)
    throw new HttpError(403, "You do not have permission for this operation.");
  return allowed.some((g) => g.editionSlug === null)
    ? null
    : allowed.map((g) => g.editionSlug!);
}
export async function capabilityScope(user: User, capability: Capability) {
  return scopeFor(await staffAccess(user), capability);
}
/** Read authorization is explicit; never use this to authorize a command or export. */
export async function readCapabilityScope(user: User, capability: Capability) {
  const grants = await staffAccess(user);
  return isDeveloper(grants) ? null : scopeFor(grants, capability);
}
