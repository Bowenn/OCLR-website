import { historicalPage } from "@/components/historical-archive";
import { InformationDocument } from "@/components/tournament-information";
import { getAppTranslations } from "@/i18n/server";
import { notFound } from "next/navigation";
import { getPublicEdition } from "@/lib/content";
import { formatDate, publicEditionSummary } from "@/lib/editions";
import { registrationAvailability } from "@/lib/registrations";
import { publicCompetition } from "@/lib/public-competition";
import { publicMappools } from "@/lib/mappools";
import { publishedTeams } from "@/lib/teams";
import { publicStaff } from "@/lib/public-staff";
import { publicDraft } from "@/lib/draft";
import {
  informationPreview,
  type TournamentInformation,
} from "@/lib/tournament-information";
import "./information.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const { edition } = await params;
  return {
    title:
      informationPreview(edition)?.name ??
      (await getPublicEdition(edition))?.name ??
      "Tournament",
  };
}

export default async function Overview({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const tr = await getAppTranslations();
  const { edition: slug } = await params;
  const archivePage = await historicalPage(slug, "overview");
  if (archivePage) return archivePage;
  const edition = await getPublicEdition(slug);
  if (!edition) notFound();
  const base = `/tournaments/${slug}`;
  const preview = informationPreview(slug);
  if (preview)
    return (
      <InformationDocument
        document={preview}
        active={{
          label: tr("Registration phase"),
          detail: tr("Deadline {date}", { date: "11.23 · 23:59 (UTC+8)" }),
          href: `${base}/register`,
          action: tr("Register individually"),
        }}
      />
    );

  const [state, results] = await Promise.all([
    registrationAvailability(edition),
    Promise.allSettled([
      publishedTeams(slug),
      publicMappools(slug),
      publicStaff(),
      publicDraft(slug),
      publicCompetition(slug),
    ]),
  ]);
  const [
    teamsResult,
    poolsResult,
    staffResult,
    draftResult,
    competitionResult,
  ] = results;
  const teams = teamsResult.status === "fulfilled" ? teamsResult.value : [];
  const pools = poolsResult.status === "fulfilled" ? poolsResult.value : [];
  const staff = staffResult.status === "fulfilled" ? staffResult.value : [];
  const draft = draftResult.status === "fulfilled" ? draftResult.value : null;
  const competition =
    competitionResult.status === "fulfilled" ? competitionResult.value : null;
  const fixture = competition?.fixtures
    .filter((f) => !f.result && f.status !== "cancelled")
    .sort((a, b) =>
      (a.scheduledAt ?? "9999").localeCompare(b.scheduledAt ?? "9999"),
    )[0];
  const roles = new Map<
    string,
    TournamentInformation["organization"][number]["members"]
  >();
  for (const person of staff)
    for (const grant of person.roles) {
      if (grant.edition && grant.edition.slug !== slug) continue;
      const names = roles.get(grant.role) ?? [];
      if (
        !names.some(
          (member) =>
            member.href === `https://osu.ppy.sh/users/${person.osuId}`,
        )
      )
        names.push({
          name: person.username,
          href: `https://osu.ppy.sh/users/${person.osuId}`,
        });
      roles.set(grant.role, names);
    }
  const document: TournamentInformation = {
    name: edition.name,
    intro: publicEditionSummary(edition.summary) ?? "",
    banner: edition.branding.background,
    timeZone: edition.timeZone,
    schedule: [
      ...(edition.registration
        ? [
            {
              event: tr("Registration opens"),
              date: formatDate(
                edition.registration.opensAt,
                edition.timeZone,
                tr.locale,
              ),
            },
            {
              event: tr("Registration closes"),
              date: formatDate(
                edition.registration.closesAt,
                edition.timeZone,
                tr.locale,
              ),
            },
          ]
        : []),
      ...edition.schedule
        .filter((event) => event.at)
        .map((event) => ({
          event: event.label,
          date: formatDate(event.at, edition.timeZone, tr.locale),
        })),
    ],
    prizes: [],
    organization: [...roles].map(([role, members]) => ({
      role: tr(role),
      members,
    })),
    links: [
      ...(state === "open"
        ? [{ label: tr("Register individually"), href: `${base}/register` }]
        : []),
      { label: tr("Schedule"), href: `${base}/schedule` },
      { label: tr("Players"), href: `${base}/players` },
      ...(draft ? [{ label: tr("Live draft"), href: `${base}/draft` }] : []),
      ...(competition?.fixtures.length
        ? [
            { label: tr("Bracket"), href: `${base}/bracket` },
            { label: tr("Results"), href: `${base}/results` },
          ]
        : []),
    ],
    teams: teams.map((team) => ({
      name: team.name,
      captain: team.captainName,
      members: (team.members ?? [])
        .filter((member) => member.osuId !== team.captainId)
        .map((member) => member.username),
      href: `${base}/teams/${team.id}`,
    })),
    pools: pools.map((pool) => ({
      name: pool.roundName,
      href: `${base}/mappools/${pool.id}`,
      groups: [...new Set(pool.entries.map((entry) => entry.category))].map(
        (category) => ({
          category,
          maps: pool.entries
            .filter((entry) => entry.category === category)
            .map((entry) => ({
              title: `${entry.metadata.artist} — ${entry.metadata.title} [${entry.metadata.difficulty}]`,
              href: `https://osu.ppy.sh/beatmaps/${entry.beatmapId}`,
            })),
        }),
      ),
    })),
    rules: [
      ...(edition.eligibility
        ? [{ heading: tr("Eligibility"), paragraphs: [edition.eligibility] }]
        : []),
      ...(edition.rules?.sections ?? []).map((rule) => ({
        heading: rule.heading,
        paragraphs: [rule.body],
      })),
    ],
  };
  const active =
    state === "open"
      ? {
          label: tr("Registration phase"),
          detail: edition.registration
            ? tr("Deadline {date}", {
                date: formatDate(
                  edition.registration.closesAt,
                  edition.timeZone,
                  tr.locale,
                ),
              })
            : undefined,
          href: `${base}/register`,
          action: tr("Register individually"),
        }
      : draft && ["live", "paused"].includes(draft.state)
        ? {
            label: tr("Captain draft"),
            href: `${base}/draft`,
            action: tr("Live draft"),
          }
        : fixture
          ? {
              label: fixture.roundName,
              href: `${base}/schedule`,
              action: tr("View schedule"),
            }
          : {
              label: tr(edition.status),
              href: edition.rules ? "#rules" : `${base}/schedule`,
              action: edition.rules
                ? tr("Read the rules")
                : tr("View schedule"),
            };
  return (
    <>
      {results.some((result) => result.status === "rejected") && (
        <p className="notice" role="status">
          {tr(
            "Some competition information is temporarily unavailable. Please try again later.",
          )}
        </p>
      )}
      <InformationDocument document={document} active={active} />
    </>
  );
}
