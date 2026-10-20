import { authorizedPage } from "@/lib/auth/page";
import { requireUser } from "@/lib/auth/user";
import { capabilityScope } from "@/lib/auth/staff";
import { PageHeading } from "@/components/ui";
import { ProfileLookup } from "@/components/profile-lookup";
export default function Profiles() {
  return authorizedPage(async () => {
    await capabilityScope(await requireUser(), "manage_registrations");
    return (
      <>
        <PageHeading
          eyebrow="TOURNAMENT OPERATIONS"
          title="osu! profile lookup"
        >
          Look up official public metadata. This does not create a player,
          publish participation or change eligibility.
        </PageHeading>
        <ProfileLookup />
      </>
    );
  });
}
