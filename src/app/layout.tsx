import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/header';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'OCLR — osu! Chinese League Rookie', template: '%s | OCLR' },
  description: 'The home of osu! Chinese League Rookie. Tournament information, individual player registration and the OCLR community.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a><Header /><main id="main">{children}</main><footer className="site-footer"><div><Link className="brand" href="/">OCLR</Link><p>osu! Chinese League Rookie</p><p className="muted">A community tournament. Not affiliated with or endorsed by osu!.</p></div><nav aria-label="Footer"><Link href="/tournaments">Tournaments</Link><Link href="/about">About OCLR</Link><Link href="/privacy">Privacy</Link></nav><span className="footer-note">PLAY. CONNECT. GROW.</span></footer></body></html>;
}
