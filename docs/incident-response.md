# Incident response

Applies to any suspected security, privacy or availability incident affecting ParmarPro or its providers. The owner of the ParmarPro accounts is the incident lead until someone else is named.

## 1. Identify

Signals to watch:
- **Sentry:**
  - spikes in errors;
  - `webhook.razorpay` events tagged `razorpay_webhook_invalid_signature` or `razorpay_webhook_mismatch_*`;
  - `billing.verify` events with code `order` / `amount` / `currency`.
- **Supabase:**
  - API and Postgres logs (unexpected `42501` bursts, unusual RPC calls);
  - security advisor findings.
- **`webhook_events` table:** rows with status `failed`.
- **Clerk:** dashboard events (sign-in anomalies, new organization admins).
- **GitHub:** secret-scanning, Dependabot and CodeQL alerts.
- **Reports:** from clinics, for example "I can see another clinic's data". Treat this as **critical** until disproven.

Severity:
- **Critical:** cross-tenant data exposure, leaked privileged secret, payment manipulation.
- **High:** account takeover, PII in third-party telemetry.
- **Medium:** service outage, failed webhooks.
- **Low:** anything else.

## 2. Contain (first hour)

| Situation | Action |
|---|---|
| Leaked Supabase secret key | Supabase → Settings → API keys → **revoke/rotate the secret key** immediately. Update `SUPABASE_SECRET_KEY` in Vercel (Production and Preview separately) and redeploy |
| Leaked Clerk secret key | Clerk → API keys → roll the secret key. Update Vercel and redeploy. Review Clerk users, organizations and memberships for changes |
| Leaked Razorpay key secret or webhook secret | Razorpay → regenerate the API key and/or webhook secret. Update Vercel and redeploy. Review recent orders and payments against `billing_orders` and `payments` |
| Leaked Sentry or PostHog token | Revoke the token in the provider and create a new one |
| Compromised user account | Clerk → user → revoke all sessions, reset the password, enforce MFA. If they are a member of a clinic, remove them through the Team page (this ends access immediately) |
| Compromised owner account | As above, then verify `clinic_members` roles with SQL (read-only) and correct them through a reviewed migration or the support process |
| Suspected cross-tenant exposure | Put the app into maintenance: Vercel → set the previous known-good deployment, or enable Vercel password protection on Production. Keep RLS on and never disable it. Take a snapshot of logs (see §3) |
| Forged or abusive webhooks | Disable the endpoint in the provider dashboard. Webhook processing is idempotent, so replay is safe once fixed |
| Malicious dependency | Pin back to the last good lockfile commit, redeploy, and rotate any secret the build could read |

## 3. Preserve evidence safely

- Export the relevant Vercel runtime logs, Supabase logs and Sentry events for the incident window, and store them in a restricted location.
- Do not copy patient data into tickets, chats or AI tools.
- Note the timeline in UTC and IST: what was observed, when, by whom, and actions taken.
- Do not delete rows or logs during an investigation unless containment requires it.

## 4. Assess exposure

- Which tenants? Use the Supabase logs and the `activity_events` table (actor, entity, action, time).
- Which data categories? Use the inventory in `docs/threat-model.md` §1.
- Was patient contact data involved? If so, the affected **clinics** (data fiduciaries) must be informed so they can meet their obligations.

## 5. Notify

- Inform affected clinics without undue delay, with facts, scope and the actions taken.
- Personal-data breaches can create legal notification duties for ParmarPro and/or the clinic, for example under India's DPDP Act 2023 and rules, and CERT-In directions (6-hour reporting for certain incidents). **Get legal advice immediately** for any incident involving personal data or credentials.
- Payment-related incidents: contact Razorpay support.

## 6. Recover

- Deploy the fix through the normal CI pipeline. Add a regression test, for example a new row in the tenant-isolation matrix.
- Restore data from backups if needed (`docs/backup-and-recovery.md`).
- Re-run the full security test suite and the Supabase advisors.

## 7. Learn

Within 5 working days, write a short post-incident review:
- timeline;
- root cause;
- what worked and what didn't;
- follow-up actions with owners and dates.

Then update the threat model and this runbook.

## Contacts (fill in before launch)

| Role | Name | Contact |
|---|---|---|
| Incident lead / owner | | |
| Legal counsel | | |
| Supabase support | Dashboard → Support | |
| Clerk support | Dashboard → Support | |
| Razorpay support | Dashboard → Support | |
