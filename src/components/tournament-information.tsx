import Link from "next/link";
import Image from "next/image";
import { getAppTranslations } from "@/i18n/server";
import type { TournamentInformation } from "@/lib/tournament-information";

export async function InformationDocument({
  document,
  active,
}: {
  document: TournamentInformation;
  active: { label: string; detail?: string; href: string; action: string };
}) {
  const tr = await getAppTranslations();
  const sections = [
    ...(document.schedule.length
      ? [{ id: "schedule", title: tr("Tournament schedule") }]
      : []),
    ...(document.prizes.length ? [{ id: "prizes", title: tr("Prizes") }] : []),
    ...(document.organization.length
      ? [{ id: "organization", title: tr("Organisation") }]
      : []),
    ...(document.links.length ? [{ id: "links", title: tr("Links") }] : []),
    ...(document.teams.length
      ? [{ id: "participants", title: tr("Participants") }]
      : []),
    ...(document.pools.length
      ? [{ id: "mappools", title: tr("Mappools") }]
      : []),
    ...(document.rules.length
      ? [{ id: "rules", title: tr("Tournament rules") }]
      : []),
  ];
  return (
    <div className="information-page">
      <Link href={active.href} className="information-active">
        <span className="information-active-dot" aria-hidden="true" />
        <span className="information-active-label">{active.label}</span>
        {active.detail && (
          <span className="information-active-detail">{active.detail}</span>
        )}
        <span className="information-active-action">
          {active.action}
          <span aria-hidden="true"> →</span>
        </span>
      </Link>
      <div className="information-layout">
        <article
          className="information-document"
          aria-labelledby="information-title"
        >
          <header className="information-heading">
            <p className="eyebrow">{"osu! Chinese League Rookie"}</p>
            <h1 id="information-title">{document.name}</h1>
          </header>
          {document.banner && (
            <div className="information-banner">
              <Image
                src={document.banner}
                alt=""
                width={2560}
                height={1200}
                sizes="(max-width: 900px) 100vw, 1000px"
                unoptimized
              />
              <span>{document.name}</span>
            </div>
          )}
          {document.intro && (
            <p className="information-intro">{document.intro}</p>
          )}
          {document.schedule.length > 0 && (
            <section id="schedule">
              <h2>{tr("Tournament schedule")}</h2>
              <p className="information-timezone">{document.timeZone}</p>
              <div className="information-table-scroll" tabIndex={0}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{tr("Event")}</th>
                      <th scope="col">{tr("Date")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {document.schedule.map((row, i) => (
                      <tr key={i}>
                        <td>{row.event}</td>
                        <td>{row.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {document.prizes.length > 0 && (
            <section id="prizes">
              <h2>{tr("Prizes")}</h2>
              <div className="information-table-scroll" tabIndex={0}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{tr("Placing")}</th>
                      <th scope="col">{tr("Prizes")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {document.prizes.map((row, i) => (
                      <tr key={row.placing}>
                        <td>
                          <span
                            className={`information-place place-${i + 1}`}
                            aria-hidden="true"
                          >
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          {row.placing}
                        </td>
                        <td>{row.reward}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {document.organization.length > 0 && (
            <section id="organization">
              <h2>{tr("Organisation")}</h2>
              <div className="information-table-scroll" tabIndex={0}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{tr("Position")}</th>
                      <th scope="col">{tr("Members")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {document.organization.map((row, i) => (
                      <tr key={i}>
                        <td>{row.role}</td>
                        <td>
                          {row.members.map((person, j) => (
                            <span key={person.name}>
                              {j > 0 && (
                                <span className="information-name-separator">
                                  {" / "}
                                </span>
                              )}
                              {person.href ? (
                                <a href={person.href}>{person.name}</a>
                              ) : (
                                <span className="information-name">
                                  {person.name}
                                </span>
                              )}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {document.links.length > 0 && (
            <section id="links">
              <h2>{tr("Links")}</h2>
              <ul className="information-links">
                {document.links.map((link) => (
                  <li key={link.href}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {document.teams.length > 0 && (
            <section id="participants">
              <h2>{tr("Participants")}</h2>
              <div className="information-table-scroll" tabIndex={0}>
                <table className="information-teams">
                  <thead>
                    <tr>
                      <th scope="col">{tr("Team")}</th>
                      <th scope="col">{"Captain"}</th>
                      <th scope="col">{tr("Members")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {document.teams.map((team) => (
                      <tr key={team.name}>
                        <td>
                          {team.href ? (
                            <Link href={team.href}>{team.name}</Link>
                          ) : (
                            team.name
                          )}
                        </td>
                        <td>
                          <strong>{team.captain}</strong>
                        </td>
                        <td>{team.members.join(" / ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {document.pools.length > 0 && (
            <section id="mappools">
              <h2>{tr("Mappools")}</h2>
              {document.pools.map((pool, i) => (
                <div className="information-pool" key={i}>
                  <h3>{pool.name}</h3>
                  {pool.href && (
                    <p>
                      <Link href={pool.href}>{tr("Explore mappools")} →</Link>
                    </p>
                  )}
                  <ul className="information-pool-groups">
                    {pool.groups.map((group) => (
                      <li key={group.category}>
                        <strong>{group.category}</strong>
                        <ol>
                          {group.maps.map((map, j) => (
                            <li key={j}>
                              {map.href ? (
                                <a href={map.href}>{map.title}</a>
                              ) : (
                                map.title
                              )}
                            </li>
                          ))}
                        </ol>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}
          {document.rules.length > 0 && (
            <section id="rules">
              <h2>{tr("Tournament rules")}</h2>
              {document.rules.map((rule, i) => (
                <section
                  className="information-rule"
                  id={`rules-${i + 1}`}
                  key={i}
                >
                  <h3>{rule.heading}</h3>
                  <ol>
                    {rule.paragraphs.map((paragraph, j) => (
                      <li key={j}>{paragraph}</li>
                    ))}
                  </ol>
                </section>
              ))}
            </section>
          )}
        </article>
        {sections.length > 0 && (
          <aside className="information-contents">
            <nav aria-label={tr("Contents")}>
              <h2>{tr("Contents")}</h2>
              <ol>
                {sections.map((section, i) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`}>
                      <span aria-hidden="true">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {section.title}
                    </a>
                    {section.id === "rules" && (
                      <ul>
                        {document.rules.map((rule, j) => (
                          <li key={j}>
                            <a href={`#rules-${j + 1}`}>{rule.heading}</a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
              <a className="information-back-top" href="#information-title">
                {tr("Back to top")} ↑
              </a>
            </nav>
          </aside>
        )}
      </div>
    </div>
  );
}
