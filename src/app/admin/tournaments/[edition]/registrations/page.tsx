import { getAppTranslations } from "@/i18n/server";
import { authorizedPage } from "@/lib/auth/page";
import { requireStaff, assertReadCapability } from "@/lib/auth/staff";
import { RegistrationList } from "@/components/registration-list";
export async function generateMetadata() {
  const tr = await getAppTranslations();
  return { title: tr("Tournament registrations") };
}

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
    await assertReadCapability(actor, "manage_registrations", edition);
    return (
      <RegistrationList
        actor={actor}
        editionSlug={edition}
        filtersInput={await searchParams}
      />
    );
  });
}
