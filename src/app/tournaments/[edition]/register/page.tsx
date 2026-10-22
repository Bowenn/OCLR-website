import { verifyEligibility } from "@/lib/eligibility";
import { getAppTranslations } from "@/i18n/server";
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
export async function generateMetadata() {
  const tr = await getAppTranslations();
  return { title: tr("Individual registration") };
}

export default async function Register({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const tr = await getAppTranslations();

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
      <PageHeading title={tr("Individual registration")}>
        {tr(
          "Apply as yourself. Teams are formed later through the captain draft.",
        )}
      </PageHeading>
      {existing && existing.status !== "withdrawn" ? (
        <div className="panel">
          <h2>{tr("You have an application")}</h2>
          <p className="muted">
            {tr("Current status: ")}
            {tr(existing.status)}.
          </p>
          <Action href="/dashboard">{tr("View my application")}</Action>
        </div>
      ) : availability !== "open" ? (
        <EmptyState
          title={
            availability === "unavailable"
              ? tr("Registration temporarily unavailable")
              : tr("Registration is not open")
          }
        >
          {tr("Check the tournament overview for registration dates.")}
        </EmptyState>
      ) : !user ? (
        <div className="panel">
          <h2>{tr("Sign in before applying")}</h2>
          <p className="muted">
            {tr("Use your own osu! identity to register.")}
          </p>
          <Action href="/login">{tr("Login with osu!")}</Action>
        </div>
      ) : (
        <>
          {existing?.status === "withdrawn" && (
            <div className="notice spaced">
              <h2>{tr("Apply again")}</h2>
              <p>
                {tr(
                  "Complete the current application and applicable acknowledgments again. Previous applications and review history are retained; the new application needs a fresh review.",
                )}
              </p>
            </div>
          )}
          {edition.eligibility && (
            <section className="notice spaced">
              <h2>{tr("Eligibility")}</h2>
              <p>{edition.eligibility}</p>
            </section>
          )}
          <ApplicationForm
            edition={edition}
            username={user.username}
            configurationVersion={record!.revision}
            verification={await verifyEligibility(
              user.osuId,
              edition,
              record!.revision,
            )}
            previousAttempt={
              existing?.status === "withdrawn"
                ? {
                    attempt: existing.attempt,
                    expectedUpdatedAt: existing.updatedAt.toISOString(),
                  }
                : undefined
            }
          />
        </>
      )}
    </>
  );
}
