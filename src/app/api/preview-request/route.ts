import { body, clientIp, fail, limited, ok, str } from '@/lib/server/http';
import { sendEmail } from '@/lib/server/notify';

/** "Get my free preview" from the landing page: emails the Bluerig team. */
export async function POST(req: Request) {
  if (limited(`preview-req:${clientIp(req)}`, 5, 60 * 60 * 1000)) return fail('Too many requests. Please try again later.', 429);
  const b = await body(req);
  const website = str(b.website, 200);
  const contact = str(b.contact, 120);
  if (!website || !/\./.test(website)) return fail('Please add your current website, like yourshop.ca.');
  if (!contact || (!/@/.test(contact) && contact.replace(/\D/g, '').length < 10)) return fail('Please add a mobile number or email so we can send your link.');
  const team = (process.env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!team.length) return fail('We can’t take requests right now. Please try again later.', 503);
  const results = await Promise.all(team.map((to) => sendEmail(to, `Preview request: ${website}`, `Website: ${website}\nContact: ${contact}\n\nBuild it at /admin, then send them the preview link.`)));
  if (!results.some((r) => r.ok)) return fail('That didn’t go through. Please try again.', 502);
  return ok();
}
