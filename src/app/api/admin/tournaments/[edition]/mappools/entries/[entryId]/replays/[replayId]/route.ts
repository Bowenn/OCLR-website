import { requireUser } from "@/lib/auth/user";
import {
  downloadMappoolReplay,
  deleteMappoolReplay,
} from "@/lib/mappool-replays";
import { apiError, requireSameOrigin, readJson } from "@/lib/http";
type Context = {
  params: Promise<{ edition: string; entryId: string; replayId: string }>;
};
export const runtime = "nodejs";
export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireUser(),
      { edition, entryId, replayId } = await context.params;
    const { bytes, filename } = await downloadMappoolReplay(
      user,
      edition,
      entryId,
      replayId,
    );
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(bytes.length),
        "Content-Disposition": `attachment; filename="replay.osr"; filename*=UTF-8''${encodeURIComponent(filename).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16))}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    const user = await requireUser(),
      { edition, entryId, replayId } = await context.params;
    return Response.json(
      await deleteMappoolReplay(
        user,
        edition,
        entryId,
        replayId,
        await readJson(request),
      ),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
