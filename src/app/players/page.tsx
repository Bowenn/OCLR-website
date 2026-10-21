import { redirect } from "next/navigation";
import { getPublicEdition } from "@/lib/content";
export default async function Players({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const edition = typeof query.edition === "string" ? query.edition : "";
  if (edition && (await getPublicEdition(edition))) {
    const search = new URLSearchParams();
    for (const key of ["q", "page"])
      if (typeof query[key] === "string") search.set(key, query[key]);
    redirect(
      `/tournaments/${edition}/players${search.size ? `?${search}` : ""}`,
    );
  }
  redirect("/tournaments");
}
