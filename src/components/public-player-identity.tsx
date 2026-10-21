import { useAppTranslations } from "@/i18n/shared";
import Link from "next/link";
import { Avatar } from "./avatar";
export function PublicPlayerIdentity({
  osuId,
  username,
  edition,
  countryCode,
  countryName,
}: {
  osuId: number;
  username: string;
  edition?: string;
  countryCode?: string | null;
  countryName?: string | null;
}) {
  const tr = useAppTranslations();

  const flag =
    countryCode && /^[A-Z]{2}$/.test(countryCode)
      ? String.fromCodePoint(
          ...[...countryCode].map((c) => 127397 + c.charCodeAt(0)),
        )
      : null;
  return (
    <div className="public-player-identity">
      <Avatar osuId={osuId} username={username} />
      <div>
        <a className="text-link" href={`https://osu.ppy.sh/users/${osuId}`}>
          {username}
        </a>
        <p className="muted small">
          {tr("osu! ID ")}
          {osuId}
        </p>
        {flag && (
          <p className="small">
            <span
              role="img"
              aria-label={tr("{value0} flag", {
                value0: countryName ?? countryCode ?? "",
              })}
            >
              {flag}
            </span>{" "}
            {countryName ?? countryCode}
          </p>
        )}
        {edition && (
          <Link
            className="text-link small"
            href={`/players/${osuId}?edition=${edition}`}
            prefetch={false}
          >
            {tr("OCLR profile")}
          </Link>
        )}
      </div>
    </div>
  );
}
