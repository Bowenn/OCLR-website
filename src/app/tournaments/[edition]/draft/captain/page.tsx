import { getAppTranslations } from "@/i18n/server";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/user";
import { captainAppointment } from "@/lib/captains";
import { captainDraft } from "@/lib/draft";
import { PageHeading } from "@/components/ui";
import { LiveDraft } from "@/components/live-draft";
export async function generateMetadata() {
  const tr = await getAppTranslations();
  return {
    title: tr("Captain draft room"),
    robots: { index: false, follow: false },
  };
}

export default async function CaptainRoom({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const tr = await getAppTranslations();

  const user = await currentUser();
  if (!user) redirect("/login");
  const { edition } = await params;
  if (!(await captainAppointment(user.osuId, edition))) notFound();
  return (
    <>
      <PageHeading
        eyebrow={tr("CAPTAIN WORKSPACE")}
        title={tr("Captain draft room")}
      >
        {tr("Choose a player for your team when it is your turn.")}
      </PageHeading>
      <LiveDraft
        slug={edition}
        initial={await captainDraft(user, edition)}
        captainId={user.osuId}
      />
    </>
  );
}
