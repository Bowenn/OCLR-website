import type { Metadata } from "next";
import Link from "next/link";
import { isStaff } from "@/lib/auth/staff";
import { currentUser } from "@/lib/auth/user";
import { Header } from "@/components/header";
import "./globals.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: {
    default: "OCLR — osu! Chinese League Rookie",
    template: "%s | OCLR",
  },
  openGraph: {
    title: "OCLR — osu! Chinese League Rookie",
    description:
      "Tournament information, individual registration and the OCLR community.",
    siteName: "OCLR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "OCLR — osu! Chinese League Rookie",
    description:
      "The rookie stage. Individual entry, captain draft and team competition.",
  },
  description:
    "The home of osu! Chinese League Rookie. Tournament information, individual player registration and the OCLR community.",
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let user: Awaited<ReturnType<typeof currentUser>> = null;
  let authUnavailable = false;
  let staff = false;
  try {
    user = await currentUser();
    staff = user ? await isStaff(user) : false;
  } catch {
    authUnavailable = true;
  }
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Header
          user={
            user ? { osuId: user.osuId, username: user.username, staff } : null
          }
        />
        {authUnavailable && (
          <div className="container">
            <p className="notice" role="status">
              Sign-in is temporarily unavailable. Public tournament information
              remains accessible.
            </p>
          </div>
        )}
        <main id="main">{children}</main>
        <footer className="site-footer">
          <div>
            <Link className="brand" href="/">
              OCLR
            </Link>
            <p>osu! Chinese League Rookie</p>
            <p className="muted">
              A community tournament. Not affiliated with or endorsed by osu!.
            </p>
          </div>
          <nav aria-label="Footer">
            <Link href="/tournaments">Tournaments</Link>
            <Link href="/about">About OCLR</Link>
            <Link href="/privacy">Privacy</Link>
          </nav>
          <span className="footer-note">PLAY. CONNECT. GROW.</span>
        </footer>
      </body>
    </html>
  );
}
