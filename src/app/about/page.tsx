import Link from "next/link";
import { PageHeading } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { publicStaff } from "@/lib/public-staff";
import { privacyContact } from "@/lib/auth/config";
export const metadata = { title: "About OCLR" };
export const dynamic = "force-dynamic";
export default async function About() {
  const staff = await publicStaff();
  const contact = privacyContact();
  return (
    <div className="container page">
      <PageHeading
        eyebrow="THE ROOKIE STAGE"
        title="osu! Chinese League Rookie"
      >
        Founded in 2018, OCLR is part of the OCL tournament series, whose
        history dates back to 2014. Players register individually and compete in
        captain-drafted teams.
      </PageHeading>
      <div className="about-layout">
        <section aria-labelledby="staff-heading">
          <h2 id="staff-heading">Staff & organizers</h2>
          {staff.length ? (
            <ul className="public-staff-list">
              {staff.map((person) => (
                <li key={person.osuId}>
                  <Avatar osuId={person.osuId} username={person.username} />
                  <div>
                    <h3>
                      <a
                        className="text-link"
                        href={`https://osu.ppy.sh/users/${person.osuId}`}
                      >
                        {person.username} ↗
                      </a>
                    </h3>
                    <ul>
                      {person.roles.map((grant) => (
                        <li
                          key={`${grant.role}-${grant.edition?.slug ?? "global"}`}
                        >
                          <span className="staff-role-name">{grant.role}</span>{" "}
                          · {grant.edition?.name ?? "All editions"}
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              OCLR is run by its community organizing team. Public staff
              profiles have not been announced.
            </p>
          )}
        </section>
        <aside className="about-aside">
          <h2>Contact</h2>
          {contact ? (
            <p>
              <a href={contact.url} className="text-link">
                {contact.label}
              </a>
            </p>
          ) : (
            <p className="muted">
              Public contact details have not been announced.
            </p>
          )}
          <p className="small muted">
            For personal data requests, see the{" "}
            <Link className="text-link" href="/privacy">
              privacy notice
            </Link>
            .
          </p>
          <p className="small muted">
            OCLR is a community event and is not affiliated with or endorsed by
            osu!.
          </p>
        </aside>
      </div>
    </div>
  );
}
