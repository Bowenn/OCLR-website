import { requireBrowserSession } from "@/lib/auth/user";
import { listDeveloperTokens, createDeveloperToken } from "@/lib/developer-api";
import { apiError, readJson, requireSameOrigin } from "@/lib/http";
export async function GET() {
  try {
    return Response.json(
      await listDeveloperTokens(await requireBrowserSession()),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const session = await requireBrowserSession();
    const input = await readJson(request, 4096);
    return Response.json(await createDeveloperToken(session, input), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
