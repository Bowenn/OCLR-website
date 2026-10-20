import { redirect } from "next/navigation";
import { authorizedPage } from "@/lib/auth/page";
import { requireStaff } from "@/lib/auth/staff";
import { applicationDetails } from "@/lib/staff";
export default async function LegacyApplication({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return authorizedPage(async () => {
    const { id } = await params;
    const { registration } = await applicationDetails(await requireStaff(), id);
    redirect(
      `/admin/tournaments/${registration.editionSlug}/registrations/${id}`,
    );
  });
}
