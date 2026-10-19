import type { User } from "./sessions";
import { requireUser } from "./user";
import { HttpError } from "../http";
export function isStaff(user: User) {
  return (process.env.STAFF_OSU_IDS ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => /^[1-9]\d*$/.test(v))
    .includes(String(user.osuId));
}
export function assertStaff(user: User) {
  if (!isStaff(user)) throw new HttpError(403, "Staff access is required.");
}
export async function requireStaff() {
  const user = await requireUser();
  assertStaff(user);
  return user;
}
