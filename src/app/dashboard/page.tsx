import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/user";
import { PageHeading, Action } from "@/components/ui";
export default async function Dashboard() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <div className="container page">
      <PageHeading eyebrow="PLAYER CENTER" title={`Welcome, ${user.username}`}>
        Signed in with osu! ID {user.osuId}.
      </PageHeading>
      <Action href="/tournaments">Browse tournaments →</Action>
      <form action="/auth/logout" method="post" className="spaced">
        <button className="secondary">Sign out</button>
      </form>
    </div>
  );
}
