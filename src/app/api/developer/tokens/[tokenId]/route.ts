import { requireBrowserSession } from "@/lib/auth/user";
import { revokeDeveloperToken } from "@/lib/developer-api";
import { apiError, requireSameOrigin } from "@/lib/http";
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tokenId: string }> },
) {
  try {
    requireSameOrigin(request);
    return Response.json(
      await revokeDeveloperToken(
        await requireBrowserSession(),
        (await params).tokenId,
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
