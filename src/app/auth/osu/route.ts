import { NextResponse } from "next/server";
import { db } from "@/db";
import { oauthStates } from "@/db/schema";
import { authorizationUrl } from "@/lib/auth/osu";
import { randomToken, hashToken } from "@/lib/auth/tokens";
import { cookieOptions, stateCookie } from "@/lib/auth/config";
import { apiError } from "@/lib/http";
export async function GET() {
  try {
    const token = randomToken();
    const url = authorizationUrl(token);
    await db()
      .insert(oauthStates)
      .values({
        stateHash: hashToken(token),
        expiresAt: new Date(Date.now() + 600000),
      });
    const response = NextResponse.redirect(url);
    response.cookies.set(stateCookie(), token, {
      ...cookieOptions(),
      maxAge: 600,
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return apiError(error);
  }
}
