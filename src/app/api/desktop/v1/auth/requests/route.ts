import {
  DesktopError,
  createDesktopAuthorization,
  desktopResponse,
  desktopError,
} from "@/lib/desktop-auth";
import { readJson } from "@/lib/http";
export async function POST(request: Request) {
  try {
    if (request.headers.has("authorization"))
      throw new DesktopError(403, "INSUFFICIENT_SCOPE");
    const result = await createDesktopAuthorization(await readJson(request));
    return desktopResponse(result, 201);
  } catch (e) {
    return desktopError(e);
  }
}
