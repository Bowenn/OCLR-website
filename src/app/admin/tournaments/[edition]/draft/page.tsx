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
  return authorizedPage(async () => {
    const actor = await requireStaff();
    const { edition } = await params;
    return (
      <>
        <PageHeading eyebrow={edition} title="Draft control room" />
        <StaffDraftRoom
          slug={edition}
          initial={await staffDraft(actor, edition)}
        />
      </>
    );
  });
}
