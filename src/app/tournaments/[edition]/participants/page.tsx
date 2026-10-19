import { EmptyState, PageHeading } from "@/components/ui";
export const metadata = { title: "Participants" };
export default function Participants() {
  return (
    <>
      <PageHeading eyebrow="THE COMMUNITY" title="Participants">
        Approved public participant and team information.
      </PageHeading>
      <EmptyState title="No participants published">
        Applications are private. Only explicitly approved public identities and
        finalized rosters will appear here.
      </EmptyState>
    </>
  );
}
