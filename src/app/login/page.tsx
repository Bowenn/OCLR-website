import Link from "next/link";
import { redirect } from "next/navigation";
import { authReady } from "@/lib/auth/config";
import { currentUser } from "@/lib/auth/user";
import { PageHeading } from "@/components/ui";
export const metadata = { title: "Login with osu!" };
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; loggedOut?: string }>;
}) {
  if (await currentUser()) redirect("/dashboard");
  const params = await searchParams;
  return (
    <div className="container page auth-page">
      <PageHeading
        eyebrow="YOUR OCLR IDENTITY"
        title="One account. Your stage."
      >
        Sign in securely with your existing osu! account.
      </PageHeading>
      <section className="panel">
        {params.error && (
          <p role="alert" className="notice">
            {params.error === "declined"
              ? "You declined osu! authorization. You can try again whenever you are ready."
              : "Sign-in could not be completed or the request expired. Please start again."}
          </p>
        )}
        {params.loggedOut && (
          <p role="status" className="notice">
            You have signed out.
          </p>
        )}
        <h2>Login with osu!</h2>
        <p className="muted">
          We use your stable osu! ID and display name to link your applications.
          Signing in does not register you for a tournament.
        </p>
        {authReady() ? (
          <a className="button" href="/auth/osu">
            Continue with osu! ↗
          </a>
        ) : (
          <p className="notice">
            osu! sign-in is awaiting secure configuration. Please return later.
          </p>
        )}
        <p className="muted small spaced">
          Read our{" "}
          <Link className="text-link" href="/privacy">
            privacy notice
          </Link>{" "}
          before continuing.
        </p>
      </section>
    </div>
  );
}
