import { authorizedPage } from "@/lib/auth/page";
import { requireStaff, assertCapability } from "@/lib/auth/staff";
import { RegistrationList } from "@/components/registration-list";
export const metadata = { title: "Tournament registrations" };
export default async function Registrations({
  params,
  searchParams,
}: {
  params: Promise<{ edition: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return authorizedPage(async () => {
    const actor = await requireStaff();
    const { edition } = await params;
    await assertCapability(actor, "manage_registrations", edition);
    return (
      <RegistrationList
        actor={actor}
        editionSlug={edition}
        filtersInput={await searchParams}
      />
    );
  });
}
