import { getAppTranslations } from "@/i18n/server";
import Link from "next/link";
import { PageHeading } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { publicStaff } from "@/lib/public-staff";
import { privacyContact } from "@/lib/auth/config";
export async function generateMetadata() {
  const tr = await getAppTranslations();
  return { title: tr("About OCLR") };
}

export const dynamic = "force-dynamic";
export default async function About() {
  const tr = await getAppTranslations();

  const staff = await publicStaff();
  const contact = privacyContact();
  return (
    <div className="container page">
      <PageHeading
        eyebrow={tr("THE ROOKIE STAGE")}
        title={"osu! Chinese League Rookie"}
      >
        {tr(
          "Founded in 2018, OCLR is part of the OCL tournament series, whose history dates back to 2014. Players register individually and compete in captain-drafted teams.",
        )}
      </PageHeading>
      <div className="about-layout">
        <section className="about-staff" aria-labelledby="staff-heading">
          <h2 id="staff-heading">{tr("Staff & organizers")}</h2>
          {staff.length ? (
            <ul className="public-staff-list">
              {staff.map((person) => (
                <li key={person.osuId}>
                  <Avatar osuId={person.osuId} username={person.username} />
                  <div>
                    <h3>
                      <a
                        className="context-link"
                        href={`https://osu.ppy.sh/users/${person.osuId}`}
                      >
                        {person.username}
                      </a>
                    </h3>
                    <ul>
                      {person.roles.map((grant) => (
                        <li
                          key={`${grant.role}-${grant.edition?.slug ?? "global"}`}
                        >
                          <span className="staff-role-name">
                            {tr(grant.role)}
                          </span>{" "}
                          · {grant.edition?.name ?? tr("All editions")}
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              {tr(
                "OCLR is run by its community organizing team. Public staff profiles have not been announced.",
              )}
            </p>
          )}
        </section>
        <aside className="about-aside" aria-labelledby="contact-heading">
          <h2 id="contact-heading">{tr("Contact")}</h2>
          {contact ? (
            <p>
              <a
                href={contact.url}
                className="button secondary about-contact-link"
              >
                {tr("Contact OCLR Admin on osu!")}
              </a>
            </p>
          ) : (
            <p className="muted">
              {tr("Public contact details have not been announced.")}
            </p>
          )}
          <p className="small muted">
            {tr("For personal data requests, see the")}{" "}
            <Link className="text-link" href="/privacy">
              {tr("privacy notice")}
            </Link>
            .
          </p>
        </aside>
      </div>
    </div>
  );
}
