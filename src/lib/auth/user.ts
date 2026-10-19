import { cookies } from "next/headers";
import { readSession } from "./sessions";
import { sessionCookie } from "./config";
import { HttpError } from "../http";
export async function currentUser() {
  return readSession((await cookies()).get(sessionCookie())?.value);
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Sign in with osu! to continue.");
  return user;
}
