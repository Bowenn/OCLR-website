import { notFound } from "next/navigation";
import { historicalPage } from "@/components/historical-archive";
import { getAppTranslations } from "@/i18n/server";

export async function generateMetadata() {
  const tr = await getAppTranslations();
  return { title: tr("Staff") };
}

export default async function Staff({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const { edition } = await params;
  const page = await historicalPage(edition, "staff");
  if (!page) notFound();
  return page;
}
