// Fetch a few public pages of a shop's existing website and boil them down to text.
// Polite by design: identifies itself, obeys robots.txt, same host only, max 5 pages,
// small size and time limits, and refuses private network addresses.
import 'server-only';
import * as cheerio from 'cheerio';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { PageText } from './extract';
import { isAllowed, USER_AGENT } from './robots';

const MAX_PAGES = 5;
const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 8000;
const PREFERRED = /contact|about|service|hvac|heating|cooling|plumbing|furnace|area|location|hours/i;

export class ImportError extends Error {}

export function normalizeSiteUrl(input: string): URL {
  let s = input.trim();
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  const u = new URL(s);
  if (!/^https?:$/.test(u.protocol)) throw new ImportError('Only http and https websites.');
  u.hash = '';
  return u;
}

function privateIp(ip: string): boolean {
  if (isIP(ip) === 6) return ip === '::1' || /^f[cd]|^fe80|^::ffff:(10|127|169\.254|192\.168)\./i.test(ip);
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/** Only the end-to-end test may read a site on this machine (never on Vercel). */
const e2eLocalHost = (host: string) => process.env.BLUERIG_E2E === '1' && !process.env.VERCEL && /^(127\.\d+\.\d+\.\d+|localhost)$/.test(host);

async function assertPublicHost(host: string) {
  if (e2eLocalHost(host)) return;
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new ImportError('That address isn’t a public website.');
  const addrs = await lookup(host, { all: true }).catch(() => {
    throw new ImportError('We couldn’t find that website. Check the address.');
  });
  if (addrs.some((a) => privateIp(a.address))) throw new ImportError('That address isn’t a public website.');
}

async function get(url: URL, accept = 'text/html'): Promise<{ body: string; type: string; finalUrl: URL } | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    let current = url;
    for (let hop = 0; hop < 4; hop++) {
      await assertPublicHost(current.hostname);
      const res = await fetch(current, { headers: { 'User-Agent': USER_AGENT, Accept: accept }, redirect: 'manual', signal: ctrl.signal });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        current = new URL(res.headers.get('location')!, current);
        continue;
      }
      if (!res.ok) return null;
      const len = Number(res.headers.get('content-length') ?? 0);
      if (len > MAX_BYTES) return null;
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_BYTES) return null;
      return { body: new TextDecoder().decode(buf), type: res.headers.get('content-type') ?? '', finalUrl: current };
    }
    return null;
  } catch (e) {
    if (e instanceof ImportError) throw e;
    return null;
  } finally {
    clearTimeout(t);
  }
}

const COLOUR = /#[0-9a-f]{3}(?:[0-9a-f]{3})?\b|rgba?\([^)]{5,40}\)/gi;
function countColours(css: string, into: Record<string, number>) {
  for (const m of css.match(COLOUR) ?? []) into[m.toLowerCase()] = (into[m.toLowerCase()] ?? 0) + 1;
}

export function htmlToPage(html: string, url: URL): PageText {
  const $ = cheerio.load(html);
  const colours: Record<string, number> = {};
  $('style').each((_, el) => countColours($(el).text(), colours));
  $('[style]').each((_, el) => countColours($(el).attr('style') ?? '', colours));
  const abs = (s?: string) => {
    try {
      return s ? new URL(s, url).toString() : '';
    } catch {
      return '';
    }
  };
  const logoCandidates: { src: string; score: number }[] = [];
  $('img').each((_, el) => {
    const $el = $(el);
    const src = abs($el.attr('src') || $el.attr('data-src'));
    if (!src || src.startsWith('data:')) return;
    const hay = `${$el.attr('src')} ${$el.attr('alt')} ${$el.attr('class')} ${$el.attr('id')} ${$el.parent().attr('class')}`.toLowerCase();
    let score = 0;
    if (/logo/.test(hay)) score += 4;
    if ($el.closest('header, .header, #header, nav').length) score += 2;
    if ($el.closest('a[href="/"], a[href="./"]').length) score += 1;
    if (/\.svg(\?|$)/i.test(src)) score += 1;
    if (score) logoCandidates.push({ src, score });
  });
  const icon = abs($('link[rel="apple-touch-icon"]').attr('href'));
  if (icon) logoCandidates.push({ src: icon, score: 2 });

  const telLinks = $('a[href^="tel:"]').map((_, el) => $(el).attr('href') ?? '').get();
  const mailLinks = $('a[href^="mailto:"]').map((_, el) => $(el).attr('href') ?? '').get();
  const links = $('a[href]')
    .map((_, el) => ({ href: abs($(el).attr('href')), text: $(el).text().trim().slice(0, 80) }))
    .get()
    .filter((l) => l.href);
  const headings = $('h1, h2, h3').map((_, el) => $(el).text().replace(/\s+/g, ' ').trim()).get().filter(Boolean);
  $('script, style, noscript, svg, iframe, template').remove();
  // Keep block boundaries as line breaks so sentences don't run together.
  $('br, p, div, li, h1, h2, h3, h4, h5, h6, td, section, footer, header').each((_, el) => {
    $(el).append('\n');
  });
  const text = $('body').text().replace(/[ \t ]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim().slice(0, 40000);
  return {
    url: url.toString(),
    title: $('title').first().text().trim(),
    metaDescription: $('meta[name="description"]').attr('content') ?? '',
    ogSiteName: $('meta[property="og:site_name"]').attr('content') ?? '',
    ogImage: abs($('meta[property="og:image"]').attr('content')),
    themeColor: $('meta[name="theme-color"]').attr('content') ?? '',
    headings,
    text,
    telLinks,
    mailLinks,
    links,
    logoCandidates,
    colours,
  };
}

/** Fetch the homepage plus up to 4 helpful pages from the same site. */
export async function fetchSite(input: string): Promise<{ pages: PageText[]; skipped: string[]; root: URL }> {
  const start = normalizeSiteUrl(input);
  const robots = await get(new URL('/robots.txt', start), 'text/plain');
  const robotsTxt = robots && /text\/plain/.test(robots.type) ? robots.body : null;
  const skipped: string[] = [];
  if (!isAllowed(robotsTxt, start.pathname + start.search)) {
    throw new ImportError('This website asks automated tools not to read it (robots.txt). Fill in the details by hand instead.');
  }
  const home = await get(start);
  if (!home || !/html/.test(home.type)) throw new ImportError('We couldn’t load that website. Check the address, or try again later.');
  const root = home.finalUrl;
  const homePage = htmlToPage(home.body, root);
  const pages = [homePage];

  // Pick same-host links that look useful, contact first.
  const seen = new Set([root.pathname]);
  const candidates = homePage.links
    .map((l) => {
      try {
        return { u: new URL(l.href), text: l.text };
      } catch {
        return null;
      }
    })
    .filter((x): x is { u: URL; text: string } => !!x && x.u.hostname.replace(/^www\./, '') === root.hostname.replace(/^www\./, ''))
    .filter((x) => !/\.(pdf|jpe?g|png|gif|webp|zip|docx?)$/i.test(x.u.pathname))
    .filter((x) => PREFERRED.test(x.u.pathname + ' ' + x.text))
    .sort((a, b) => Number(/contact/i.test(b.u.pathname + b.text)) - Number(/contact/i.test(a.u.pathname + a.text)));

  for (const c of candidates) {
    if (pages.length >= MAX_PAGES) break;
    c.u.hash = '';
    if (seen.has(c.u.pathname)) continue;
    seen.add(c.u.pathname);
    if (!isAllowed(robotsTxt, c.u.pathname + c.u.search)) {
      skipped.push(c.u.toString());
      continue;
    }
    const r = await get(c.u);
    if (r && /html/.test(r.type)) pages.push(htmlToPage(r.body, r.finalUrl));
  }

  // Count colours in the first two stylesheets too (brand colours usually live there).
  const $ = cheerio.load(home.body);
  const sheets = $('link[rel="stylesheet"]').map((_, el) => $(el).attr('href') ?? '').get().filter(Boolean).slice(0, 2);
  for (const href of sheets) {
    try {
      const u = new URL(href, root);
      if (u.hostname !== root.hostname) continue;
      const css = await get(u, 'text/css');
      if (css) countColours(css.body, homePage.colours);
    } catch {
      /* ignore */
    }
  }
  return { pages, skipped, root };
}
