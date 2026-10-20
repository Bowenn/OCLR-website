import Image from "next/image";
import { Avatar } from "./avatar";
import { modeNames, type ProfileSnapshot } from "@/lib/osu-profile-model";
const number = (v: number | null, decimals = 0) =>
  v === null
    ? "Unavailable"
    : new Intl.NumberFormat("en-GB", {
        maximumFractionDigits: decimals,
      }).format(v);
const score = (v: string | null) =>
  v === null ? "Unavailable" : BigInt(v).toLocaleString("en-GB");
export function PlayerProfile({ snapshot }: { snapshot: ProfileSnapshot }) {
  const p = snapshot.profile;
  const s = p.statistics;
  return (
    <section
      className="panel profile-summary"
      aria-label={`${modeNames[p.ruleset]} profile snapshot`}
    >
      {p.coverUrl && (
        <div className="profile-cover">
          <Image
            src={p.coverUrl}
            alt=""
            width={1200}
            height={300}
            unoptimized
          />
        </div>
      )}
      <div className="directory-identity">
        <Avatar
          osuId={p.osuId}
          username={p.username}
          avatarUrl={p.avatarUrl ?? undefined}
        />
        <div>
          <p className="eyebrow">{modeNames[p.ruleset]} · PUBLIC PROFILE</p>
          <h2>{p.username}</h2>
          <p className="muted">
            {p.countryName ?? p.countryCode ?? "Country unavailable"}
            {p.countryName && p.countryCode ? ` (${p.countryCode})` : ""} · osu!
            ID {p.osuId}
          </p>
          <a href={p.canonicalUrl} className="text-link">
            View on osu! ↗
          </a>
        </div>
      </div>
      <dl className="profile-statistics">
        {[
          [
            "Global rank",
            s.globalRank === null
              ? "Unranked / unavailable"
              : `#${number(s.globalRank)}`,
          ],
          [
            "Country rank",
            s.countryRank === null
              ? "Unranked / unavailable"
              : `#${number(s.countryRank)}`,
          ],
          [
            "Performance",
            s.pp === null ? "Unavailable" : `${number(s.pp, 2)} pp`,
          ],
          [
            "Accuracy",
            s.accuracy === null ? "Unavailable" : `${number(s.accuracy, 2)}%`,
          ],
          ["Play count", number(s.playCount)],
          [
            "Play time",
            s.playTimeSeconds === null
              ? "Unavailable"
              : `${number(s.playTimeSeconds)} seconds`,
          ],
          ["Ranked score", score(s.rankedScore)],
          ["Total score", score(s.totalScore)],
          [
            "Maximum combo",
            s.maximumCombo === null
              ? "Unavailable"
              : `${number(s.maximumCombo)}×`,
          ],
          [
            "Level",
            s.level?.current === null || s.level?.current === undefined
              ? "Unavailable"
              : `${number(s.level.current)}${s.level.progress !== null ? ` (${number(s.level.progress)}%)` : ""}`,
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {s.grades && (
        <p className="muted small">
          Grades:{" "}
          {Object.entries(s.grades)
            .map(([grade, count]) => `${grade.toUpperCase()} ${number(count)}`)
            .join(" · ")}
        </p>
      )}
      <details className="spaced">
        <summary>Public profile details</summary>
        <dl className="directory-details">
          <div>
            <dt>Default ruleset</dt>
            <dd>
              {p.defaultRuleset ? modeNames[p.defaultRuleset] : "Unavailable"}
            </dd>
          </div>
          <div>
            <dt>Joined</dt>
            <dd>{p.joinedAt ?? "Unavailable"}</dd>
          </div>
          <div>
            <dt>Last seen</dt>
            <dd>{p.lastSeenAt ?? "Not public / unavailable"}</dd>
          </div>
          <div>
            <dt>Previous usernames</dt>
            <dd>{p.previousUsernames.join(", ") || "None returned"}</dd>
          </div>
          <div>
            <dt>Active account</dt>
            <dd>
              {p.active === null ? "Unavailable" : p.active ? "Yes" : "No"}
            </dd>
          </div>
          <div>
            <dt>Bot account</dt>
            <dd>{p.bot === null ? "Unavailable" : p.bot ? "Yes" : "No"}</dd>
          </div>
        </dl>
      </details>
      <p className="small muted spaced">
        Source: {p.source} · Last updated{" "}
        <time dateTime={p.fetchedAt}>{p.fetchedAt}</time>. Statistics are a
        saved {modeNames[p.ruleset]} snapshot.
      </p>
      {(snapshot.stale || snapshot.notice) && (
        <p className="notice" role="status">
          {snapshot.stale ? "Stale snapshot. " : ""}
          {snapshot.notice ?? "A new snapshot is not available yet."}
        </p>
      )}
    </section>
  );
}
