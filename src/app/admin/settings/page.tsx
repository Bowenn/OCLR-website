import { getAppTranslations } from "@/i18n/server";
import { authorizedPage } from "@/lib/auth/page";
import { requireUser } from "@/lib/auth/user";
import { siteSettingsForAdmin } from "@/lib/site-settings";
import { PageHeading } from "@/components/ui";
import { SiteAppearanceForm } from "@/components/site-appearance-form";

export async function generateMetadata() {
  const tr = await getAppTranslations();
  return { title: tr("Site settings") };
}
export default async function SiteSettingsPage() {
  return authorizedPage(async () => {
    const tr = await getAppTranslations();
    const settings = await siteSettingsForAdmin(await requireUser());
    return (
      <>
        <PageHeading
          eyebrow={tr("ADMINISTRATION")}
          title={tr("Site settings")}
        />
        <SiteAppearanceForm
          initialAppearance={settings.defaultAppearance}
          revision={settings.revision}
        />
      </>
    );
  });
}
