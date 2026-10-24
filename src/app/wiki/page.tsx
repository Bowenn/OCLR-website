import { WikiDocument } from "@/components/wiki-document";
import { wikiArticles } from "@/lib/wiki-articles";
import { getAppTranslations } from "@/i18n/server";
export async function generateMetadata() {
  const tr = await getAppTranslations();
  return { title: tr("OCLR Wiki") };
}
export default function Page() {
  return <WikiDocument article={wikiArticles[0]} />;
}
