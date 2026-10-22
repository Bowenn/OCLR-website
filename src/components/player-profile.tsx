import { useAppTranslations } from "@/i18n/shared";
import { BwsSummary } from "./bws-summary";
import type { BwsSummary as BwsData } from "@/lib/bws-model";
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
export function PlayerProfile({
  snapshot,
  bws,
}: {
  snapshot: ProfileSnapshot;
  bws?: BwsData | null;
}) {
  const tr = useAppTranslations();

  const p = snapshot.profile;
  const s = p.statistics;
  return (
    <section
      className="panel profile-summary"
      aria-label={tr("{value0} profile snapshot", {
        value0: modeNames[p.ruleset],
      })}
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
          <p className="eyebrow">
            {modeNames[p.ruleset]} {tr(" · PUBLIC PROFILE")}
          </p>
          <h2>{p.username}</h2>
          <p className="muted">
            {p.countryName ?? p.countryCode ?? tr("Country unavailable")}
            {p.countryName && p.countryCode ? ` (${p.countryCode})` : ""}{" "}
            {tr(" · osu! ID ")}
            {p.osuId}
          </p>
          <a href={p.canonicalUrl} className="text-link">
            {tr("View on osu! ↗")}
          </a>
        </div>
      </div>
      {bws && <BwsSummary value={bws} />}
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
            <dt>{tr(label)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {s.grades && (
        <p className="muted small">
          {tr("Grades:")}{" "}
          {Object.entries(s.grades)
            .map(([grade, count]) => `${grade.toUpperCase()} ${number(count)}`)
            .join(" · ")}
        </p>
      )}
      <details className="spaced">
        <summary>{tr("Public profile details")}</summary>
        <dl className="directory-details">
          <div>
            <dt>{tr("Default ruleset")}</dt>
            <dd>
              {p.defaultRuleset
                ? modeNames[p.defaultRuleset]
                : tr("Unavailable")}
            </dd>
          </div>
          <div>
            <dt>{tr("Joined")}</dt>
            <dd>{p.joinedAt ?? tr("Unavailable")}</dd>
          </div>
          <div>
            <dt>{tr("Last seen")}</dt>
            <dd>{p.lastSeenAt ?? tr("Not public / unavailable")}</dd>
          </div>
          <div>
            <dt>{tr("Previous usernames")}</dt>
            <dd>{p.previousUsernames.join(", ") || tr("None returned")}</dd>
          </div>
          <div>
            <dt>{tr("Active account")}</dt>
            <dd>
              {p.active === null
                ? tr("Unavailable")
                : p.active
                  ? tr("Yes")
                  : tr("No")}
            </dd>
          </div>
          <div>
            <dt>{tr("Bot account")}</dt>
            <dd>
              {p.bot === null
                ? tr("Unavailable")
                : p.bot
                  ? tr("Yes")
                  : tr("No")}
            </dd>
          </div>
        </dl>
      </details>
      <p className="small muted spaced">
        {tr("Source: ")}
        {p.source} {tr(" · Last updated")}{" "}
        <time dateTime={p.fetchedAt}>{p.fetchedAt}</time>
        {tr(". Statistics are a saved ")}
        {modeNames[p.ruleset]} {tr(" snapshot.")}
      </p>
      {(snapshot.stale || snapshot.notice) && (
        <p className="notice" role="status">
          {snapshot.stale ? tr("Stale snapshot. ") : ""}
          {snapshot.notice ?? tr("A new snapshot is not available yet.")}
        </p>
      )}
    </section>
  );
}
