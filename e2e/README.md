# End-to-end journey test

`npm run test:e2e` drives the real app in a browser: admin import → preview → claim
with a texted code → put live → edit → public page → customer request → server
restart. It uses a **local** Supabase and a mock for Twilio and Resend, so nothing
real is ever sent.

## Run it on your computer

Needs Docker and the Supabase CLI.

```bash
supabase start                      # local database with the migrations applied
eval "$(supabase status -o env)"
export SUPABASE_URL=$API_URL SUPABASE_ANON_KEY=${ANON_KEY:-$PUBLISHABLE_KEY} SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY:-$SECRET_KEY}
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY NEXT_PUBLIC_APP_URL=http://localhost:3100 npm run build
npx playwright install chromium     # once
npm run test:e2e
```

The test starts the app on port 3100 and the mock on 4010 itself, and wipes the
local `businesses` table first.

`BLUERIG_E2E=1` (set only by the test) points texts and email at the mock and lets
the importer read the fake shop site on 127.0.0.1. It is ignored on Vercel.
