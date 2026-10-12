# Bluerig

Websites for HVAC and plumbing shops in Canada. The crew can update the site from the truck in under a minute.

Each shop has one **business profile**. The website, the Google data and every promo design are generated from it. Owners edit facts, never layout, so the design can't break.

## What's in here

| For | Where |
|---|---|
| The shop's public site | `/s/[slug]`, or their own domain via `middleware.ts` → `/d/[host]` |
| Desktop editor (tap the words on the page, quick panels, team presence, publish, history) | `/edit/[id]` |
| **Phone quick actions**: emergency mode, job photos, towns, prices, review requests, deals | `/edit/[id]/quick` |
| **Promote**: social media, flyers, business cards, magnets (fridge and truck), yard signs | `/edit/[id]/promote` |
| **Admin importer**: paste a shop's current website → draft site + private preview link | `/admin` |
| Private preview the owner can claim (code texted or phoned to the listed number) | `/p/[token]` |

### Pain points the product is built around

1. **Emergency mode.** One tap shows a red "Taking emergency calls right now · Tap to call" bar. It always has an end time (midnight, 7am or 24 hours), so it never says "call now" at 3am by accident.
2. **Service areas.** Owners add towns or postal codes (stored as the 3-character area, e.g. `V3B`). Each one goes into the schema.org `areaServed` data and the page description, so Google sees it.
3. **Before and after photos.** Owners pick a photo from the camera roll and type a one-line caption. The photo is shrunk on the phone before upload, which also drops its location data. A checkbox confirms there's no customer face, house number or licence plate in the shot.
4. **Prices.** A short price list (diagnostic fee, service call). Owners tap the number, change it and save. Every changed price needs a "Is that right?" tick before it goes live.
5. **Reviews.** Owners text a customer the shop's Google review link after a job. The site shows Google's own rating and reviews through the Places API, credited to Google. Two things are deliberately *not* built:
   - **Hand-copied reviews.** Reviews are never pasted into the site.
   - **"Only ask happy customers" filtering.** Google's policies prohibit it.

   Each text names the shop and says "Reply STOP to opt out" (CASL). STOP replies are honoured across every shop.

## Stack

- **Next.js 15** (App Router) on Vercel. Public pages use ISR (`revalidate = 60`) and `revalidatePath` on publish.
- **Supabase** (Postgres, Auth magic links, Storage, Realtime).
- **Twilio** (texts and voice calls) and **Resend** (email). Both are optional: without keys, messages are logged to the server console.
- **Language model** (optional): any OpenAI-compatible endpoint, e.g. an open-weight model at a provider with no data retention. It is only used when the rule-based parser gives up, and only to fill gaps in imports.
  - Its output is constrained to a JSON schema and re-validated.
  - For imports, anything it claims must appear word for word on the source site.

The core logic in `src/lib` (profile, time rules, parser, checks, importer extraction, SEO, promo designs) has no dependencies and is fully unit-tested.

## Set up

1. **Install.**
   ```bash
   npm install
   cp .env.example .env.local
   ```
2. **Supabase project.**
   - Create a project and run `supabase/migrations/0001_init.sql`, either in the SQL editor or with `supabase db push`.
   - Under **Auth → URL configuration**, add `http://localhost:3000/auth/callback` and your production `/auth/callback` URL.
   - Fill in the three Supabase values in `.env.local`.
3. **Admin access.** Set `ADMIN_EMAILS` to the emails that can use `/admin`.
4. **Optional services.** Add keys for `TWILIO_*`, `RESEND_API_KEY`, `GOOGLE_PLACES_API_KEY` and `LLM_*`. In Twilio, point the number's incoming-message webhook at `/api/sms/inbound` and set `TWILIO_WEBHOOK_URL` to that same URL.
5. **Run it.** `npm run dev`, then sign in at `/login` and paste a website at `/admin`.

## Commands

```bash
npm test          # unit tests (node:test via tsx)
npm run typecheck
npm run build
```

CI (`.github/workflows/ci.yml`) runs all three on every push.

## Decisions worth knowing

- **Claims stay off until the owner confirms them.** The importer may find "24/7", "licensed & insured" or a founding year on the old site. These become "Check this" items and are never published automatically.
- **Publish checks.** Any new price, claim word (licensed, certified, warranty, guarantee, 24/7, best) or photo without a rights tick asks for confirmation before it goes live.
- **Quick actions publish only the field they touch.** Turning on emergency mode from the phone never pushes someone else's half-finished edit.
- **Field-level saving.** Two people editing different fields never overwrite each other. On the same field, the last write wins.
- **History.** Every publish is a version, and History restores any of them.
- **Polite importer.**
  - It identifies itself and obeys `robots.txt`.
  - It reads at most 5 pages from the same host and refuses private network addresses.
  - It doesn't copy photos or reviews; the shop's logo URL and colours are used so the preview looks like *their* brand.
- **Agencies are backlogged.** `businesses.org_id` is nullable, so agencies can be added later without a schema rewrite.
- **Print files.** Promo downloads are SVG at real size with 1/8" bleed, with the logo and photos embedded. PDF export with embedded fonts is a natural next step.
