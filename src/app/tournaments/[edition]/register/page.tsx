import { notFound } from "next/navigation";
import { db } from "@/db";
import { readTournament } from "@/lib/tournaments";
import { currentUser } from "@/lib/auth/user";
import {
  ownRegistrations,
  registrationAvailability,
} from "@/lib/registrations";
import { Action, EmptyState, PageHeading } from "@/components/ui";
import { ApplicationForm } from "@/components/application-form";
export const metadata = { title: "Individual registration" };
export default async function Register({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const { edition: slug } = await params;
  const record = process.env.DATABASE_URL
    ? await readTournament(slug, db(), true)
    : undefined;
  const edition = record?.edition;
  if (!edition) notFound();
  const availability = await registrationAvailability(edition);
  const user = await currentUser();
  const existing = user
    ? (await ownRegistrations(user.osuId)).find((r) => r.editionSlug === slug)
    : null;
  return (
    <>
      <PageHeading eyebrow={edition.name} title="Individual registration">
        Apply as yourself. Teams are formed later through the captain draft.
      </PageHeading>
      {existing ? (
        <div className="panel">
          <h2>You have an application</h2>
          <p className="muted">Current status: {existing.status}.</p>
          <Action href="/dashboard">View my application</Action>
        </div>
      ) : availability !== "open" ? (
        <EmptyState
          title={
            availability === "unavailable"
              ? "Registration temporarily unavailable"
              : "Registration is not open"
          }
        >
          Check the tournament overview for registration dates.
        </EmptyState>
      ) : !user ? (
        <div className="panel">
          <h2>Sign in before applying</h2>
          <p className="muted">Use your own osu! identity to register.</p>
          <Action href="/login">Login with osu!</Action>
        </div>
      ) : (
        <>
          {edition.eligibility && (
            <section className="notice spaced">
              <h2>Eligibility</h2>
              <p>{edition.eligibility}</p>
            </section>
          )}
          <ApplicationForm
            edition={edition}
            username={user.username}
            configurationVersion={record!.revision}
          />
        </>
      )}
    </>
  );
}
