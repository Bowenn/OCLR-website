import { getAppTranslations } from "@/i18n/server";
import { notFound } from "next/navigation";
import { WikiDocument } from "@/components/wiki-document";
import { wikiArticles } from "@/lib/wiki-articles";
type Props = { params: Promise<{ article: string }> };
function findArticle(slug: string) {
  return wikiArticles.find(
    (item) => item.slug === slug && slug !== "introduction",
  );
}
export async function generateMetadata({ params }: Props) {
  const article = findArticle((await params).article);
  const tr = await getAppTranslations();
  return {
    title: article ? `${article.title} · ${tr("OCL Wiki")}` : tr("OCL Wiki"),
  };
}
export default async function Page({ params }: Props) {
  const article = findArticle((await params).article);
  if (!article) notFound();
  return <WikiDocument article={article} />;
}
