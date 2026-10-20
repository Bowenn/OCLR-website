import { authorizedPage } from "@/lib/auth/page";
import { requireStaff } from "@/lib/auth/staff";
import { RegistrationList } from "@/components/registration-list";
export const metadata = { title: "All registrations" };
export default async function Registrations({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return authorizedPage(async () => (
    <RegistrationList
      actor={await requireStaff()}
      filtersInput={await searchParams}
    />
  ));
}
