import {
  DesktopError,
  exchangeDesktopAuthorization,
  desktopResponse,
  desktopError,
} from "@/lib/desktop-auth";
import { readJson } from "@/lib/http";
export async function POST(request: Request) {
  try {
    if (request.headers.has("authorization"))
      throw new DesktopError(403, "INSUFFICIENT_SCOPE");
    const result = await exchangeDesktopAuthorization(await readJson(request));
    return desktopResponse(result, 200);
  } catch (e) {
    return desktopError(e);
  }
}
