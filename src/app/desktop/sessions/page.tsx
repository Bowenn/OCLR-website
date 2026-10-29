import { DesktopSessions } from "@/components/desktop-sessions";
import { PageHeading } from "@/components/ui";
import { getAppTranslations } from "@/i18n/server";
import { authorizedPage } from "@/lib/auth/page";
import { requireUser } from "@/lib/auth/user";
export async function generateMetadata() {
  const tr = await getAppTranslations();
  return {
    title: tr("Desktop sessions"),
    robots: { index: false, follow: false },
  };
}
export default async function Page() {
  return authorizedPage(async () => {
    await requireUser();
    const tr = await getAppTranslations();
    return (
      <div className="container page auth-page">
        <PageHeading title={tr("Desktop sessions")}>
          {tr(
            "Revoke a session to stop its local IRC synchronization and queued commands.",
          )}
        </PageHeading>
        <DesktopSessions />
      </div>
    );
  });
}
