// Builds dist/landing.html: the Bluerig landing page as a static page for GitHub Pages,
// using the real app styles. The "Get started" buttons lead to the clickable demo at ./demo/,
// because sign-in for real shops isn't hosted yet. `node demo/build-landing.mjs`
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const css = readFileSync(path.join(root, 'src/app/globals.css'), 'utf8');

const page = `<!doctype html>
<html lang="en-CA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0B1015">
<title>Bluerig · Websites for HVAC and plumbing shops</title>
<meta name="description" content="A website your crew can update from the truck in under a minute.">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 22'%3E%3Crect width='22' height='22' rx='6' fill='%234c8dff'/%3E%3Crect x='7' y='7' width='8' height='8' rx='2' fill='%2304122a'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap" rel="stylesheet">
<style>${css}
.landing .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; }
.landing .note { color: var(--stm); font-size: 14px; margin: 0; }
</style>
</head>
<body>
<main class="landing">
  <nav>
    <span class="logo"><span class="k"><i></i></span>Bluerig</span>
    <a class="btn" href="demo/">Try the demo</a>
  </nav>
  <section class="hero2">
    <h1>Websites for HVAC and plumbing shops. <em>Updated from the truck.</em></h1>
    <p class="sub">Turn on emergency calls, add a town, post a job photo or change your diagnostic fee in under a minute. No designer, no logins to forget, nothing to break.</p>
    <div class="actions">
      <a class="btn primary big" href="demo/">Try the demo</a>
      <p class="note">The demo runs on a sample shop called Northline. Sign-up for real shops isn't open yet.</p>
    </div>
  </section>
  <div class="grid3">
    <div class="tile"><b>Emergency mode</b><p>One tap puts a red “call now” bar on your site. It switches itself off when you say.</p></div>
    <div class="tile"><b>Your crew can edit</b><p>Invite anyone. Changes show up for everyone at once, like a shared doc.</p></div>
    <div class="tile"><b>Promote from your site</b><p>Posts, flyers, business cards, magnets and yard signs in your logo and colours.</p></div>
  </div>
</main>
</body>
</html>
`;

mkdirSync(path.join(root, 'dist'), { recursive: true });
writeFileSync(path.join(root, 'dist/landing.html'), page);
console.log('wrote dist/landing.html');
