# Setting up a staging copy of Bluerig

A staging copy is a private, working Bluerig on the internet: a real database, real logins and real texts, used for testing before any shop sees it. You do these steps by hand once; they take about an hour. Nothing here was run for you.

You'll need accounts at **Supabase** (database and logins), **Vercel** (hosting), **Resend** (email) and **Twilio** (texts and calls). All have free or pay-as-you-go plans that are enough for staging.

Follow the steps in order. Each one names the values you'll need later; keep them in a password manager, never in the code.

---

## 1. Database and logins (Supabase)

1. In Supabase, create a new project.
   - **Region:** Canada (Central). Shops and their customers are Canadian, so keep their data in Canada.
   - Save the database password somewhere safe.
2. Apply the migrations, in order. Either:
   - **Easiest:** open **SQL Editor**, paste the whole of `supabase/migrations/0001_init.sql`, click **Run**; then do the same with `0002_one_owner.sql`.
   - **Or with the CLI:** `supabase link --project-ref <your-ref>` then `supabase db push`.
3. Check it worked: **Table Editor** should list `businesses`, `members`, `claims`, `site_versions`, `leads`, `review_requests` and `sms_opt_outs`, and **Storage** should show a bucket called `media`.
4. Go to **Project Settings → API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (secret: it can read everything)

## 2. Hosting (Vercel), first pass

You need the site's address before you can finish the login settings, so deploy once now.

1. In Vercel: **Add New → Project**, import `nweinberg97/Bluerig`. Framework: Next.js (detected).
2. Add the environment variables from the table in step 6. For this first deploy you need at least the **required** ones; use a placeholder for `NEXT_PUBLIC_APP_URL`.
3. Deploy. Note the address, e.g. `https://bluerig-staging.vercel.app`.
4. Set `NEXT_PUBLIC_APP_URL` to that address and **redeploy**.

> **Note:** Vercel runs preview deployments in production mode too, so every environment (Production *and* Preview) needs `CLAIM_SECRET`, or the server refuses to start.

## 3. Login links (Supabase Auth URLs)

In Supabase: **Authentication → URL Configuration**.

- **Site URL:** your Vercel address, e.g. `https://bluerig-staging.vercel.app`
- **Redirect URLs:** add
  - `https://bluerig-staging.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback` (for running it on your own computer)
  - If you use Vercel preview links: `https://*-<your-vercel-team>.vercel.app/auth/callback`

Without these, the sign-in email links will fail.

## 4. Email that actually arrives (custom SMTP)

Supabase's built-in email is for trying things out only: it sends very few emails an hour and often lands in spam. Send login emails through Resend instead.

1. In Resend: add and verify a domain you own (e.g. `mail.bluerig.ca`). This means adding the DNS records Resend shows you at your domain registrar. Wait until Resend says **Verified**.
2. Create an API key → `RESEND_API_KEY`. Decide the sender → `EMAIL_FROM`, e.g. `Bluerig <hello@mail.bluerig.ca>`.
3. In Supabase: **Authentication → Emails → SMTP Settings**, turn on custom SMTP:
   - Host `smtp.resend.com`, port `465`
   - Username `resend`, password = your Resend API key
   - Sender email and name = the same as `EMAIL_FROM`
4. Optionally raise the email rate limit under **Authentication → Rate Limits**.
5. Test: sign in at `/login` with your own email. The link should arrive within a minute.

## 5. Texts and calls (Twilio)

Bluerig texts claim codes to shops, texts new customer requests to owners, sends review requests, and can phone landlines with a code.

1. In Twilio, buy a **Canadian** number with SMS and Voice (a local number in the shop's area code is fine to start).
   - Twilio's Canada rules (checked October 2026): local long codes don't need a registration step, but Canadian carriers filter business texts strictly. Twilio recommends a **verified toll-free number** (or a short code, which takes 12–16 weeks) for the best delivery. If test texts go missing, switch to a toll-free number and complete Twilio's **toll-free verification**.
   - Canadian numbers don't support alphanumeric sender names, so texts come from the number.
   - Source: [Twilio – Canada SMS guidelines](https://www.twilio.com/en-us/guidelines/ca/sms)
2. Copy into Vercel:
   - Account SID → `TWILIO_ACCOUNT_SID`
   - Auth Token → `TWILIO_AUTH_TOKEN`
   - The number, in `+1…` format → `TWILIO_FROM_NUMBER`
3. **Replies and STOP (inbound webhook).** In Twilio: **Phone Numbers → your number → Messaging configuration → A message comes in**:
   - Webhook, `HTTP POST`, URL `https://bluerig-staging.vercel.app/api/sms/inbound`
   - Put the exact same URL in Vercel as `TWILIO_WEBHOOK_URL`. Bluerig uses it to check that requests really come from Twilio.
4. Test: text **STOP** to the number from your phone; a row should appear in the `sms_opt_outs` table. Text **START** to undo it.

## 6. Every environment variable

Set these in Vercel → **Settings → Environment Variables**, for both Production and Preview. "Required" means the site won't work properly without it.

| Variable | Required? | What it's for |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Required** | Database address (step 1) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Required** | Public database key (step 1) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Required** | Server-only database key (step 1). Never share it. |
| `NEXT_PUBLIC_APP_URL` | **Required** | The site's own address (step 2), used in links we send |
| `CLAIM_SECRET` | **Required** | Protects claim codes. Any long random string, e.g. from `openssl rand -hex 32`. The server **won't start** without it. |
| `ADMIN_EMAILS` | **Required** | Comma-separated emails that can use `/admin` (yours) |
| `TWILIO_ACCOUNT_SID` | **Required to claim** | Without Twilio, claiming returns "We can't send codes right now" |
| `TWILIO_AUTH_TOKEN` | **Required to claim** | |
| `TWILIO_FROM_NUMBER` | **Required to claim** | `+1…` format |
| `TWILIO_WEBHOOK_URL` | Recommended | Exact inbound URL from step 5; needed to honour STOP replies securely |
| `RESEND_API_KEY` | Recommended | Lead alerts, invites and takeover-attempt emails. Without it those emails fail. |
| `EMAIL_FROM` | Recommended | Sender for those emails, on your verified domain |
| `GOOGLE_PLACES_API_KEY` | Optional | Shows the shop's Google rating and reviews |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | Optional | Smarter "Something changed? Tell us." and importer. Without them, the built-in rules are used. |

In production, a missing Twilio or Resend key means the message **fails** (and says so). It never pretends to send.

## 7. Check the whole thing

1. Sign in at `/login` with an email listed in `ADMIN_EMAILS`.
2. Go to `/admin`, paste a website, open the preview link.
3. In a private browser window, sign in as a different email, open the preview link, choose **This is my business**, enter the code texted to the shop's number. **Use a test business with your own phone number** while testing; real shops would get a text.
4. In the editor, click **Put my website live**. Then change something (for example a price) and save. Open `/s/<slug>` and check the change shows.
5. Send a request from the form at the bottom of the public page; the owner's phone should get a text and it should appear in the `leads` table.

If anything fails, Vercel → **Logs** shows the server's error messages; claim problems are prefixed `[claim]`.
