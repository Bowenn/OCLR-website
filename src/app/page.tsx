import { Action, Badge } from '@/components/ui';
import { site } from '@/content/site';
const highlights = [
  ['01', 'Competitive spirit', 'A team competition built around osu!.'],
  ['02', 'Community first', 'Individual players, brought together on one stage.'],
  ['03', 'A new chapter', 'Captains choose their rosters in a live player draft.'],
];
export default function Home() {
  return <>
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-art" aria-hidden="true" /><div className="hero-shade" aria-hidden="true" />
      <div className="container hero-content">
        <p className="eyebrow hero-kicker"><span /> THE ROOKIE STAGE</p>
        <h1 id="hero-title">OCLR<span>osu! Chinese League Rookie</span></h1>
        <p className="hero-tagline">Every player starts somewhere.<br />Make this your stage.</p>
        <p className="hero-copy">An osu! community tournament. Register individually.<br className="desktop-break" /> Come together through the captain draft. Compete as a team.</p>
        <div className="actions"><Action href="/tournaments">View tournament <span aria-hidden="true">↗</span></Action><Action href="#the-oclr-way" secondary>Learn more</Action></div>
        <div className="hero-caption"><span className="caption-line" /> RHYTHM. CONNECTION. COMPETITION.</div>
      </div>
      <span className="hero-coordinate" aria-hidden="true">OCLR / THE NEXT CHAPTER</span>
    </section>
    <div className="container">
      <section className="highlights" aria-label="The OCLR experience">{highlights.map(([number, title, copy]) => <div key={number}><span className="highlight-number">{number}</span><div><h2>{title}</h2><p>{copy}</p></div></div>)}</section>
      <section className="upcoming-section" aria-labelledby="upcoming-heading">
        <div className="section-title"><div><p className="eyebrow">WHAT’S NEXT</p><h2 id="upcoming-heading">The next stage</h2></div><a className="text-link" href="/tournaments">All tournaments ↗</a></div>
        <div className="featured-edition"><div className="edition-art" aria-hidden="true"><span>OCLR<small>THE ROOKIE STAGE</small></span></div><div className="edition-copy"><Badge>Awaiting announcement</Badge><h3>{site.announcement}</h3><p className="muted">Edition details, rules and registration dates will be published once confirmed.</p><Action href="/tournaments" secondary>View tournament information →</Action></div><dl className="edition-facts"><div><dt>Registration</dt><dd>Not announced</dd></div><div><dt>Tournament dates</dt><dd>To be announced</dd></div><div><dt>Entry</dt><dd>Individual registration</dd></div></dl></div>
      </section>
      <section id="the-oclr-way" className="workflow-section" aria-labelledby="workflow-heading"><div><p className="eyebrow">INDIVIDUAL ENTRY. TEAM COMPETITION.</p><h2 id="workflow-heading">Find your rhythm.<br />Build your team story.</h2><p className="muted">Players apply individually. Staff review applications and appoint captains. A live captain-turn draft brings the teams together before competition begins.</p><Action href="/about" secondary>About OCLR ↗</Action></div><ol className="workflow-list"><li><span>01</span><div><h3>Register as a player</h3><p>Apply with your osu! identity when registration opens.</p></div></li><li><span>02</span><div><h3>Follow the live draft</h3><p>Staff appoint captains, who take turns selecting eligible players.</p></div></li><li><span>03</span><div><h3>Take the stage together</h3><p>Published, finalized rosters become the competing teams.</p></div></li></ol></section>
    </div>
  </>;
}
