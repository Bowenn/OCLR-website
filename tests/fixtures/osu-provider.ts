/** Test-process transport fixture only. Never imported by application code. */
import { assertTestDatabase } from "../database";
assertTestDatabase(process.env.TEST_DATABASE_URL);
if (
  process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL ||
  process.env.APP_URL !== "http://127.0.0.1:3100" ||
  process.env.OSU_CLIENT_SECRET !== "synthetic-browser-provider-secret"
)
  throw new Error("Provider fixtures require the isolated browser-test server");
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin !== "https://osu.ppy.sh") return originalFetch(input, init);
  if (
    url.pathname === "/oauth/token" &&
    new URLSearchParams(String(init?.body)).get("grant_type") ===
      "client_credentials"
  )
    return Response.json({
      access_token: "synthetic-public-token",
      expires_in: 3600,
      token_type: "Bearer",
    });
  const match = /^\/api\/v2\/beatmaps\/([1-9]\d*)$/.exec(url.pathname);
  if (match) {
    const id = Number(match[1]);
    if (id === 999) return new Response(null, { status: 404 });
    if (id === 888) return new Response(null, { status: 429 });
    if (id === 777) return new Response(null, { status: 503 });
    if (id === 666) return Response.json({ id });
    if (id === 555)
      throw new DOMException("Synthetic provider timeout", "TimeoutError");
    if (id === 123 || id === 456)
      return Response.json({
        id,
        beatmapset_id: 42,
        version: "Synthetic Difficulty",
        difficulty_rating: id === 123 ? 4.5 : 5.25,
        bpm: 180,
        total_length: 123,
        beatmapset: {
          artist: "Synthetic Artist",
          title:
            id === 123
              ? "Synthetic Browser Song"
              : "Synthetic Replacement Song",
          creator: "Synthetic Mapper",
        },
      });
    return new Response(null, { status: 404 });
  }
  // This fixture supplies public beatmap metadata only; it cannot authenticate a user.
  return new Response(null, { status: 503 });
};
