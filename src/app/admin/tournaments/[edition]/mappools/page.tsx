import { requireUser } from "@/lib/auth/user";
import { mappoolWorkspace } from "@/lib/mappools";
import { PageHeading } from "@/components/ui";
import { MappoolEditor } from "@/components/mappool-editor";
export const metadata = { title: "Manage mappools" };
export default async function MappoolsPage({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const actor = await requireUser();
  const { edition } = await params;
  const data = await mappoolWorkspace(actor, edition);
  return (
    <>
      <PageHeading eyebrow="COMPETITION MAPS" title="Mappool management">
        Configure approved stages, rounds and map slots. Published pools require
        an explicit unpublish before editing.
      </PageHeading>
      <MappoolEditor slug={edition} data={data} />
    </>
  );
}
