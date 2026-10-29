import { PageHeading } from "@/components/ui";
import { getAppTranslations } from "@/i18n/server";
import { authorizedPage } from "@/lib/auth/page";
import { currentUser } from "@/lib/auth/user";
import { DesktopError, getDesktopAuthorization } from "@/lib/desktop-auth";
import { notFound } from "next/navigation";
import { z } from "zod";

export async function generateMetadata() {
  const tr = await getAppTranslations();
  return {
    title: tr("Authorize oclr-irc"),
    robots: { index: false, follow: false },
  };
}
export default async function DesktopAuthorize({
  searchParams,
}: {
  searchParams: Promise<{ request_id?: string | string[] }>;
}) {
  const tr = await getAppTranslations();
  const { request_id: requestId } = await searchParams;
  if (typeof requestId !== "string" || !z.uuid().safeParse(requestId).success)
    notFound();
  const actor = await currentUser();
  if (!actor)
    return (
      <div className="container page auth-page">
        <PageHeading title={tr("Authorize oclr-irc")} />
        <section className="panel form-stack">
          <p>
            {tr(
              "Sign in with osu! to review this desktop authorization request.",
            )}
          </p>
          <a
            className="button"
            href={`/auth/osu?desktop_request=${encodeURIComponent(requestId)}`}
          >
            {tr("Continue with osu!")}
          </a>
        </section>
      </div>
    );
  return authorizedPage(async () => {
    let request;
    try {
      request = await getDesktopAuthorization(actor, requestId);
    } catch (error) {
      if (error instanceof DesktopError && [409, 410].includes(error.status))
        return (
          <div className="container page auth-page">
            <PageHeading title={tr("Authorize oclr-irc")} />
            <section className="panel">
              <p>
                {tr(
                  "This desktop authorization request expired or was already handled. Start again in oclr-irc.",
                )}
              </p>
            </section>
          </div>
        );
      throw error;
    }
    const scopeLabels: Record<string, string> = {
      "referee:fixtures:read": tr("Read matches assigned to you"),
      "referee:context:read": tr("Read the rules and mappool for your matches"),
      "referee:panel:read": tr("Read your referee workspace and records"),
      "referee:relay": tr(
        "Sync local IRC room activity and execute commands queued from the referee page",
      ),
    };
    return (
      <div className="container page auth-page">
        <PageHeading title={tr("Authorize oclr-irc")}>
          {tr("Check that this code matches the one in your desktop app.")}
        </PageHeading>
        <section className="panel form-stack">
          <p>
            <strong>{actor.username}</strong> · {actor.osuId}
          </p>
          <p>{request.deviceName}</p>
          <p>
            <strong>{request.verificationCode}</strong>
          </p>
          <ul>
            {request.scopes.map((scope) => (
              <li key={scope}>{scopeLabels[scope] ?? scope}</li>
            ))}
          </ul>
          <p className="small muted">
            {tr("Authorization expires at {value0}", {
              value0: request.expiresAt,
            })}
          </p>
          <p>
            {tr(
              "The desktop session lasts up to 12 hours. Website sign-out does not revoke it; disconnect the desktop app to revoke its session.",
            )}
          </p>
          <p className="small muted">
            {tr(
              "Your osu! IRC password stays on your computer. This authorization does not publish match results.",
            )}
          </p>
          <a href="/desktop/sessions">{tr("Manage desktop sessions")}</a>
          <form
            method="post"
            action="/api/desktop/v1/auth/decision"
            className="actions"
          >
            <input type="hidden" name="request_id" value={request.id} />
            <button type="submit" name="decision" value="approve">
              {tr("Authorize desktop app")}
            </button>
            <button
              type="submit"
              className="secondary"
              name="decision"
              value="deny"
            >
              {tr("Deny")}
            </button>
          </form>
        </section>
      </div>
    );
  });
}
