import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/user";
import { captainAppointment } from "@/lib/captains";
import { captainDraft } from "@/lib/draft";
import { PageHeading } from "@/components/ui";
import { LiveDraft } from "@/components/live-draft";
export const metadata = {
  title: "Captain draft room",
  robots: { index: false, follow: false },
};
export default async function CaptainRoom({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { edition } = await params;
  if (!(await captainAppointment(user.osuId, edition))) notFound();
  return (
    <>
      <PageHeading eyebrow="CAPTAIN WORKSPACE" title="Captain draft room">
        Choose a player for your team when it is your turn.
      </PageHeading>
      <LiveDraft
        slug={edition}
        initial={await captainDraft(user, edition)}
        captainId={user.osuId}
      />
    </>
  );
}
