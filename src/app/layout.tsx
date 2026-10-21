import type { Metadata } from "next";
import { isStaff } from "@/lib/auth/staff";
import { currentUser } from "@/lib/auth/user";
import { Header } from "@/components/header";
import "./globals.css";
import "./public-tournament.css";
import { cookies } from "next/headers";
import { readTheme, themeCookie } from "@/lib/preferences";
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
  const theme = readTheme((await cookies()).get(themeCookie)?.value);
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
    <html lang="en" data-theme={theme}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Header
          theme={theme}
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
          <p>
            © {new Date().getUTCFullYear()}{" "}
            <a
              className="footer-credit"
              href="https://osu.ppy.sh/users/1176704"
              target="_blank"
              rel="noopener noreferrer"
            >
              Lapis
            </a>{" "}
            · OCLR — osu! Chinese League Rookie
          </p>
          <p className="muted">Not affiliated with or endorsed by osu!.</p>
        </footer>
      </body>
    </html>
  );
}
