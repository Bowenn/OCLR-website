import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/ui";
import { PlayerProfile } from "@/components/player-profile";
import { publishedPlayerProfile } from "@/lib/player-profiles";
import { modeNames, profileModes } from "@/lib/osu-profile-model";
import { HttpError } from "@/lib/http";
export const metadata = { title: "Player profile" };
export default async function Profile({
  params,
  searchParams,
}: {
  params: Promise<{ osuId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { osuId } = await params;
  const query = await searchParams;
  if (
    Object.keys(query).some((key) => !["mode", "edition"].includes(key)) ||
    (query.mode !== undefined && typeof query.mode !== "string") ||
    (query.edition !== undefined &&
      (typeof query.edition !== "string" ||
        !/^[a-z0-9-]+$/.test(query.edition)))
  )
    notFound();
  let data;
  try {
    data = await publishedPlayerProfile(
      osuId,
      query.mode as string | undefined,
      query.edition as string | undefined,
    );
  } catch (e) {
    if (e instanceof HttpError && [400, 404].includes(e.status)) notFound();
    throw e;
  }
  return (
    <div className="container page">
      <Link
        className="text-link"
        href={
          query.edition
            ? `/tournaments/${query.edition}/players`
            : "/tournaments"
        }
      >
        {query.edition ? "← Tournament players" : "← Tournaments"}
      </Link>
      <PageHeading
        eyebrow="OCLR PLAYER"
        title={
          data.snapshot?.profile.username ?? data.participation[0].username
        }
      >
        Public osu! statistics and published OCLR participation.
      </PageHeading>
      <form method="get" className="filters">
        {query.edition && (
          <input type="hidden" name="edition" value={query.edition as string} />
        )}
        <div className="field">
          <label htmlFor="profile-ruleset">Ruleset</label>
          <select
            id="profile-ruleset"
            name="mode"
            defaultValue={data.identity.mode}
          >
            {profileModes.map((mode) => (
              <option key={mode} value={mode}>
                {modeNames[mode]}
              </option>
            ))}
          </select>
        </div>
        <button>View ruleset</button>
      </form>
      {data.snapshot ? (
        <PlayerProfile snapshot={data.snapshot} />
      ) : (
        <p className="notice" role="status">
          {data.error?.message} Published OCLR participation is shown below.
        </p>
      )}
      <section className="spaced" aria-labelledby="participation">
        <h2 id="participation">Published participation</h2>
        <ul className="player-directory">
          {data.participation.map((p) => (
            <li className="panel" key={p.editionSlug}>
              <h3>
                <Link
                  href={`/tournaments/${p.editionSlug}`}
                  className="text-link"
                >
                  {p.editionName}
                </Link>
              </h3>
              <p>
                {p.captain
                  ? "Captain"
                  : p.participation === "finalized_roster"
                    ? "Finalized roster player"
                    : "Accepted player"}
              </p>
              {p.team ? (
                <Link
                  href={`/tournaments/${p.editionSlug}/teams/${p.team.id}`}
                  className="text-link"
                >
                  {p.team.name}
                </Link>
              ) : (
                <p className="muted">Team awaiting publication</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
