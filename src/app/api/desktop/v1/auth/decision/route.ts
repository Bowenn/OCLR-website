import {
  approveDesktopAuthorization,
  desktopError,
  DesktopError,
} from "@/lib/desktop-auth";
import { requireSameOrigin } from "@/lib/http";
import { requireUser } from "@/lib/auth/user";
async function readDecisionForm(request: Request) {
  if (
    request.headers.get("content-type")?.split(";", 1)[0].trim() !==
      "application/x-www-form-urlencoded" ||
    Number(request.headers.get("content-length") ?? 0) > 2048
  )
    throw new DesktopError(400, "INVALID_REQUEST");
  const reader = request.body?.getReader();
  if (!reader) throw new DesktopError(400, "INVALID_REQUEST");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) {
        await reader.cancel();
        throw new DesktopError(400, "INVALID_REQUEST");
      }
      chunks.push(value);
    }
    return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new DesktopError(400, "INVALID_REQUEST");
  } finally {
    reader.releaseLock();
  }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const actor = await requireUser();
    const form = await readDecisionForm(request);
    if (
      [...form.keys()].some((k) => !["request_id", "decision"].includes(k)) ||
      form.getAll("request_id").length !== 1 ||
      form.getAll("decision").length !== 1 ||
      !["approve", "deny"].includes(form.get("decision") ?? "")
    )
      throw new DesktopError(400, "INVALID_REQUEST");
    const url = await approveDesktopAuthorization(
      actor,
      form.get("request_id")!,
      form.get("decision") === "approve",
    );
    return new Response(null, {
      status: 303,
      headers: {
        Location: url,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (e) {
    return desktopError(e);
  }
}
