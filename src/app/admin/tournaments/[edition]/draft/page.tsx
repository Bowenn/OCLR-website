import { getAppTranslations } from "@/i18n/server";
import { authorizedPage } from "@/lib/auth/page";
import { requireStaff } from "@/lib/auth/staff";
import { staffDraft } from "@/lib/draft";
import { PageHeading } from "@/components/ui";
import { StaffDraftRoom } from "@/components/staff-draft";
export default async function ControlRoom({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const tr = await getAppTranslations();

  return authorizedPage(async () => {
    const actor = await requireStaff();
    const { edition } = await params;
    return (
      <>
        <PageHeading eyebrow={edition} title={tr("Draft control room")} />
        <StaffDraftRoom
          slug={edition}
          initial={await staffDraft(actor, edition)}
        />
      </>
    );
  });
}
