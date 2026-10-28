# 10X Customer Support Professional Assessment: handover guide

The assessment portal lives inside the existing Vercel website. It shares the build and the domain with the marketing site, but it has its own HTML entry (`assessment.html`) and no link from the main navigation.

| Address | What it is |
| --- | --- |
| `/customer-support-assessment` | Candidate landing page (share this link) |
| `/customer-support-assessment/handbook` | Study handbook (also a PDF at `/handbook/10x-customer-support-handbook.pdf`) |
| `/customer-support-assessment/register`, `/recover`, `/my-assessment` | Registration, access recovery, candidate dashboard |
| `/customer-support-assessment/privacy`, `/terms` | Privacy notice and assessment terms |
| `/customer-support-assessment/admin` | Administration (Supabase Auth sign-in, allowlisted emails only) |
| `/verify-certificate/<number>` | Public certificate check (the QR code on each certificate links here) |
| `/api/v1/*` | API, a single Vercel function (`api/v1.ts` → `server/router.ts`) |

All portal pages and the handbook PDF send `X-Robots-Tag: noindex`.

## How it works

1. **Study.** The handbook has 12 chapters, scenarios, revision questions, a glossary and a checklist. It is free and needs no registration.
2. **Register.** The candidate gives a full name, an email and an optional phone number, and accepts the terms and the privacy notice. There is no password. The browser keeps an access token, and the candidate is shown a one-time **recovery code** for use on another device.
3. **Attempt.** The server draws 30 of the 40 bank questions using a fixed category blueprint, and shuffles both the questions and their options. The candidate has 35 minutes. Answers autosave, and the timer keeps running even if the page is closed.
4. **Mark.** Marking happens only on the server, against the key in `server/questionBank.ts`. Client-sent scores are ignored. The pass mark is 70% (21 of 30). Candidates see their score per area, never the correct answers.
5. **Pay.** A candidate who passes can pay ₦1,000 through Paystack. The certificate is issued only after the server verifies the transaction with Paystack, including the amount, currency and reference. It does this either on the callback or through the signed webhook, whichever arrives first. Issuing is idempotent: one certificate per passed attempt.
6. **Certificate.** The candidate downloads a PDF with a unique number and a QR code. Anyone can check that number on the verification page, which shows the name, title, date and status, but never the email.
7. **Retake.** A candidate who fails can retake, up to 3 attempts in 24 hours (configurable). Every attempt is kept.

The answer key never leaves the server. `npm run check:leaks` scans the built `dist/` for any bank text, answer keys, source maps or secret names. Run it after every build that changes questions.

## Environment variables

See [`.env.example`](../.env.example) for the full list with notes. Set them in **Vercel → Project → Settings → Environment Variables**, separately for Preview and Production. Never paste values into code, docs or chat.

| Variable | Preview | Production |
| --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | set | set |
| `APP_SECRET` | set | set (same value if it uses the same database) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | set | set |
| `APP_BASE_URL` | leave unset | `https://<your production domain>` |
| `PAYSTACK_SECRET_KEY` | `sk_test_…` | `sk_live_…`, only when you are ready to take real payments |

A change to environment variables takes effect only on the **next** deployment.

## Database (Supabase)

The schema is in `supabase/migrations/20261028000100_assessment_platform.sql`. It covers tables, row-level security (all tables are closed to the browser, so only the server's secret key can read or write them), integrity triggers and the payment-and-issue function. It has been applied to the project.

Settings live in the `assessment_config` row (id 1): questions per attempt, duration, pass mark, fee, attempts per day, cooldown, and a payments on/off switch. Payments can also be switched on and off from the admin page.

### Admin access

1. In Supabase → **Authentication → Users**, create a user with an email listed in `public.admin_users`. That table is seeded with `10xpromotionscompany@gmail.com`. Give the user a strong password and confirm the email.
2. In **Authentication → Sign In / Providers**, turn **off** "Allow new users to sign up". The allowlist already blocks other accounts, but there is no reason to let strangers create them.
3. To add another administrator, insert their lowercase email into `admin_users` (SQL editor) and create their Auth user.

The admin page shows:
- totals, pass rate and gross payments received, which is *not* profit because Paystack fees and refunds are not deducted;
- attempts, searchable and filterable;
- a CSV export;
- the security audit log;
- certificate revocation;
- the payments switch.

## Paystack

1. In the Paystack dashboard (**Settings → API Keys & Webhooks**), copy the **test** secret key into the Vercel `PAYSTACK_SECRET_KEY` variable for Preview.
2. Set the webhook URL to `https://<domain>/api/v1/paystack/webhook`. Paystack signs each webhook with your secret key. The server rejects any webhook without a valid HMAC-SHA512 signature, and records duplicate deliveries without acting on them twice.
3. Redeploy, then pay with a Paystack test card on the preview. Check that the certificate appears, that the admin page shows the payment, and that the verification page works.
4. Only after that, put the **live** key on Production.

The callback URL is built from `APP_BASE_URL` (or the deployment URL) as `/customer-support-assessment/payment-callback`. You do not need to set it in Paystack.

## Development and tests

```bash
npm run dev          # site + portal at http://localhost:5173 (proxies /api to 8787)
npm run api:dev      # local API on 8787, reads .env.local
npm test             # unit tests (bank, selection, scoring, identifiers, validation, routing)
npm run build        # client + server type checks, then the production build
npm run check:leaks  # after building: no answer key in public assets
npx tsx tests/e2e/scenarios.mts   # after building: scenarios A–G
```

The E2E scenarios run against the real Supabase project from `.env.local`, with Paystack replaced by a local mock, so no real payment is ever attempted. Every candidate they create uses a `csp-e2e-…@example.com` address, and these are deleted at the end of the run. They need a Chromium for playwright-core: set `CHROMIUM_PATH`, or install one with `npx playwright-core install chromium`.

To regenerate the handbook PDF after editing `src/assessment/pages/Handbook.tsx`:

```bash
npm run build
npx vite preview --host 127.0.0.1 --port 4173
node scripts/handbook-pdf.mjs http://127.0.0.1:4173
```

## Deploying

The project is linked to Vercel (`.vercel/project.json`).

- **Preview:** `vercel deploy`. Preview URLs are behind Vercel's login (deployment protection), so share them only with people on your Vercel team, or turn protection off for a test.
- **Production:** `vercel deploy --prod`, or push to `main` if the Git integration is connected (Vercel → Settings → Git). Once it is connected, every push to `main` deploys to production. Before you do this, set the Production variables listed above and test a payment on the preview.

### Rollback

If a production deploy misbehaves, go to Vercel → **Deployments**, choose the previous production deployment and select **Promote** (or **Instant Rollback**). The marketing site is static, so rolling back restores it exactly. The database migration only added new tables; it did not touch anything that already existed. To take the assessment offline without a redeploy, switch payments off on the admin page, or remove the portal rewrites from `vercel.json`.

## Things to know

- **Cheating.** A remote, unproctored multiple-choice test cannot fully prevent cheating. The protections are randomised draws and order, a time limit, server-only marking, no answer reveal, attempt limits and audit logging. The certificate is a professional certificate from 10X Marketing Solutions attesting to the candidate's result. The terms page notes that it is not a government or regulatory licence; don't describe it as one.
- **Data.** The portal collects only name, email, optional phone, attempt data and payment references. Card details stay with Paystack. There is no automatic deletion yet. To erase a candidate, delete their `assessment_candidates` row, which cascades to their tokens, attempts and responses. Payment records and certificates are kept on purpose and block that delete. Remove or anonymise those first if the law allows it.
- **Retention and refunds.** The wording in the privacy notice and terms is general. Confirm it, and add a privacy contact or legal entity details if you have them, before going live.
- **Vercel plan.** The Hobby plan is for non-commercial use. Taking payments is commercial use, so move to Pro before going live.
- **Question bank.** If you edit `server/questionBank.ts`, bump `QUESTION_BANK_VERSION`, keep each category's `bankCount` in `CATEGORIES` accurate (the unit tests check it), and run the tests and `check:leaks`.
