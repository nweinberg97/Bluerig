// Paste a website address → a draft Bluerig site. Heuristics do most of the work;
// if a language model is configured it only fills gaps, and anything it says must
// appear word-for-word on the site (no invented facts).
import 'server-only';
import { fetchSite } from '../import/fetch-site';
import { extractAll, type Extracted, type PageText } from '../import/extract';
import { buildProfile, type ImportSummary } from '../import/build-profile';
import { llmJson } from './llm';
import type { ServiceIcon } from '../profile';

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ');

async function fillGaps(x: Extracted, pages: PageText[]): Promise<Extracted> {
  const needName = !x.name;
  const needServices = x.services.length < 2;
  const needCity = !x.city;
  if (!needName && !needServices && !needCity) return x;
  const corpus = pages.map((p) => `URL: ${p.url}\nTITLE: ${p.title}\n${p.text.slice(0, 6000)}`).join('\n\n---\n\n').slice(0, 20000);
  const out = await llmJson<{ name: string | null; city: string | null; services: { name: string; quote: string }[] }>({
    name: 'site_facts',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'city', 'services'],
      properties: {
        name: { type: ['string', 'null'] },
        city: { type: ['string', 'null'] },
        services: { type: 'array', maxItems: 8, items: { type: 'object', additionalProperties: false, required: ['name', 'quote'], properties: { name: { type: 'string' }, quote: { type: 'string' } } } },
      },
    },
    system: 'Extract facts about a heating, cooling or plumbing business from its website text. Only use what the text says. For each service, "quote" must be copied exactly from the text. Use null when unsure.',
    user: corpus,
    timeoutMs: 20000,
  });
  if (!out) return x;
  const all = norm(pages.map((p) => `${p.title}\n${p.text}`).join('\n'));
  const next = { ...x, services: [...x.services] };
  if (needName && out.name && all.includes(norm(out.name))) next.name = { value: out.name.slice(0, 40), source: 'read from the site (AI-assisted)', sure: false };
  if (needCity && out.city && all.includes(norm(out.city))) next.city = { value: out.city.slice(0, 40), source: 'read from the site (AI-assisted)', sure: false };
  if (needServices) {
    for (const s of out.services) {
      if (!s.quote || !all.includes(norm(s.quote))) continue; // must be really on the page
      if (next.services.some((e) => norm(e.value.name) === norm(s.name))) continue;
      next.services.push({ value: { name: s.name.slice(0, 40), blurb: s.quote.length <= 140 ? s.quote : '', icon: 'wrench' as ServiceIcon }, source: 'read from the site (AI-assisted)', sure: false });
    }
  }
  return next;
}

export async function importFromUrl(url: string): Promise<ImportSummary & { skipped: string[]; root: string }> {
  const { pages, skipped, root } = await fetchSite(url);
  const x = await fillGaps(extractAll(pages), pages);
  return { ...buildProfile(x, root.toString()), skipped, root: root.toString() };
}
