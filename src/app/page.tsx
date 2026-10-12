import Link from 'next/link';

export default function Home() {
  return (
    <main className="landing">
      <nav>
        <span className="logo"><span className="k"><i /></span>Bluerig</span>
        <Link className="btn" href="/login">Sign in</Link>
      </nav>
      <section className="hero2">
        <h1>
          Websites for HVAC and plumbing shops. <em>Updated from the truck.</em>
        </h1>
        <p className="sub">
          Turn on emergency calls, add a town, post a job photo or change your diagnostic fee in under a minute. No designer, no logins to forget,
          nothing to break.
        </p>
        <Link className="btn primary big" href="/login">Get started</Link>
      </section>
      <div className="grid3">
        <div className="tile"><b>Emergency mode</b><p>One tap puts a red “call now” bar on your site. It switches itself off when you say.</p></div>
        <div className="tile"><b>Your crew can edit</b><p>Invite anyone. Changes show up for everyone at once, like a shared doc.</p></div>
        <div className="tile"><b>Promote from your site</b><p>Posts, flyers, business cards, magnets and yard signs in your logo and colours.</p></div>
      </div>
    </main>
  );
}
