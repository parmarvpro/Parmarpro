# Environment variables

Placeholders live in `.env.example`. Real values are kept only in:
- Vercel project environment variables, scoped per environment;
- GitHub Actions secrets;
- a developer's own `.env.local`, which is gitignored.

**Rules**
- Any variable prefixed `NEXT_PUBLIC_` ships in the browser bundle and must be safe to publish. `scripts/check-public-env.mjs` enforces an allowlist of public names. After every build, CI also scans the client bundle for the values of server secrets.
- Server code reads secrets only through `src/lib/env.ts`, which validates them with Zod on first use and reports variable names, never values. ESLint forbids reading `process.env.*SECRET*` anywhere else.
- Production values exist only in the Vercel **Production** scope.

| Variable | Public? | Used by | Development | Preview / staging | Production | Notes |
|---|---|---|---|---|---|---|
| `NEXT_PUBLIC_APP_ENV` | yes | app, Sentry environment | `development` | `staging` | `production` | |
| `NEXT_PUBLIC_APP_URL` | yes | metadata, invitation redirect | `http://localhost:3000` | staging URL | `https://parmarpro.in` (after cutover) | |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | yes | Clerk | ParmarPro **dev** instance key | dev instance key | **prod** instance key | Publishable by design |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `_SIGN_UP_URL` | yes | Clerk | `/sign-in` / `/sign-up` | same | same | |
| `CLERK_SECRET_KEY` | **secret** | server (auth, Backend API) | dev | dev | prod | |
| `CLERK_WEBHOOK_SIGNING_SECRET` | **secret** | `/api/webhooks/clerk` | — | dev webhook | prod webhook | One per webhook endpoint |
| `SUPABASE_URL` | server only | Supabase clients | local or staging | `https://nhuwxiffckuhasbvesmr.supabase.co` | production project URL | |
| `SUPABASE_PUBLISHABLE_KEY` | server only (public by design) | user-scoped and anonymous clients | staging | staging publishable key | prod publishable key | Not exposed to the browser because the browser doesn't need it |
| `SUPABASE_SECRET_KEY` | **secret, privileged** | `src/server/privileged/*` only | staging | staging | prod | Bypasses RLS. Never `NEXT_PUBLIC_`. Rotate on any suspicion |
| `NEXT_PUBLIC_SENTRY_DSN` | yes | Sentry SDKs | optional | staging DSN | prod DSN | Empty disables Sentry |
| `SENTRY_ORG`, `SENTRY_PROJECT` | build | source-map upload | — | `parmarpro` / project | same | |
| `SENTRY_AUTH_TOKEN` | **secret (build)** | source-map upload | — | optional | yes | Scope it to `project:releases` only |
| `NEXT_PUBLIC_POSTHOG_KEY` | yes | PostHog (in-app only) | optional | staging project | prod project | Empty disables analytics |
| `NEXT_PUBLIC_POSTHOG_HOST` | yes | `/ingest` rewrite target | `https://us.i.posthog.com` | same | same, or the EU host | |
| `RESEND_API_KEY` | **secret** | email sender (`src/server/email/send.ts`) | optional | staging Resend key | production Resend key | Starts with `re_`. Without it no email is sent, and each job reports `not_configured` |
| `EMAIL_FROM` | server only | email sender | optional | sender on the staging domain | sender on the production domain | `Name <address@domain>`, on a domain verified in Resend |
| `FOUNDER_ALERT_EMAIL` | server only (a personal address, not a credential) | enquiry alerts and the founder digest | optional | the owner's address | the owner's address | Without it, no founder email is sent |
| `CRON_SECRET` | **secret** | bearer check on `POST /api/jobs/[job]` | optional (for local `curl` tests) | staging value, equal to Vault `parmarpro_cron_secret` | production value, equal to Vault `parmarpro_cron_secret` | `openssl rand -hex 32`. Without it the job endpoints answer `503` |
| `LINK_SIGNING_SECRET` | **secret** | HMAC for signed email links | optional | staging value | production value | `openssl rand -hex 32`. Without it, links fall back to the dashboard and patient reminders are not sent |
| `GEMINI_FREE_API_KEY` | **secret** | free AI lane: the operations note in the founder digest (`src/server/ai/free-lane.ts`) | optional | a key from a Google AI Studio project **without billing** | the same project's key, Sensitive | Non-personal data only: Google's unpaid terms forbid personal data. Without it, the digest has no AI note. See [docs/ai.md](ai.md) |
| `GEMINI_PAID_API_KEY` | **secret** | paid AI lane: enquiry sorting and reply drafts (`src/server/ai/paid-lane.ts`) | optional | a key from a **separate** project **with billing** and a budget alert | that project's key, Sensitive | Without it, AI sorting and reply drafts are unavailable. See [docs/ai.md](ai.md) |

**CI-only secrets** (GitHub Actions; optional): `E2E_CLERK_PUBLISHABLE_KEY`, `E2E_CLERK_SECRET_KEY`, `E2E_OWNER_EMAIL`, `E2E_VIEWER_EMAIL`. They enable the authenticated Playwright journey against the Clerk **development** instance. Never use production keys in CI.

**Scheduler secrets, outside environment variables.** pg_cron reaches the app through `private.call_job`, which reads three values from Supabase Vault: `parmarpro_app_url`, `parmarpro_cron_secret` and, optionally for protected previews, `parmarpro_vercel_bypass`. Create them once per Supabase project, as described in `supabase/ops/schedules.sql`. Rotate `CRON_SECRET` in Vercel and in Vault together, or every job call is refused.

**GitHub Actions secrets for the scheduled checks.** Each workflow skips with a notice, and runs nothing, when its required secret is missing.

- `SUPABASE_DB_URL` **secret**: session pooler connection string, read by the nightly backup (`backup.yml`).
- `BACKUP_AGE_RECIPIENT`: age public key that encrypts the backup (`backup.yml`). Its private key stays offline, with the owner.
- `STAGING_URL`: the staging origin, read by the nightly E2E (`nightly-e2e.yml`).
- `VERCEL_AUTOMATION_BYPASS_SECRET` **secret**: Vercel's *Protection Bypass for Automation*. Optional. Read by the nightly E2E and by Lighthouse (`lighthouse.yml`) to get past Deployment Protection.

See `docs/automations.md` for what each job does and the owner setup checklist.

**Local test stack:** `scripts/local-db/start.sh` generates a random database password and JWT secret for each run and writes them to `.env.test.local`, which is gitignored and disposable.
