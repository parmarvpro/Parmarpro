# Deployment, staging and production launch

Status markers used in this document:
- ✅ done and verified
- 🟡 configured but not yet verified end-to-end
- ⬜ to do (owner action needed)

## 1. Environments

| | Development (local) | Staging | Production |
|---|---|---|---|
| Hosting | `pnpm dev` | Vercel project `parmarpro`, **Preview** environment | Vercel project `parmarpro`, **Production** environment (after G7 approval) |
| Clerk | ParmarPro app, dev instance (`app_3LKFyhuULQSdi6fW0SqOIQ5ioAq`) | same dev instance | ParmarPro **production** instance (to create at G7) |
| Supabase | local stack, or the staging project | `parmarpro-staging` (`nhuwxiffckuhasbvesmr`, ap-south-1) | separate production project (to create at G7; Pro plan recommended for backups and PITR) |
| Sentry | disabled or staging | project `parmarpro-web`, env `staging` | same project, env `production` |
| PostHog | disabled | staging project | production project |

Production credentials are never placed in Preview or Development scopes.

### 1.1 Keys at a glance: what, where to get it, where to keep it

Never paste a key into chat, an issue, a commit or a screenshot. Each one goes in exactly one place. Anything marked **secret** is stored as a *Sensitive* variable in Vercel (Preview scope for staging, Production scope only at launch) and, where noted, as a GitHub Actions secret. Full per-variable detail is in `docs/environment-variables.md`.

| What | Where to get it | Where to keep it |
|---|---|---|
| Clerk publishable key (`pk_test_…`) | Clerk dashboard → your ParmarPro app → **API keys** | Vercel `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (public by design) |
| Clerk secret key (`sk_test_…`) **secret** | Same page | Vercel `CLERK_SECRET_KEY`; GitHub secret `E2E_CLERK_SECRET_KEY` for authenticated tests |
| Clerk webhook signing secret (`whsec_…`) **secret** | Clerk → **Webhooks** → add the endpoint `/api/webhooks/clerk` → *Signing secret* | Vercel `CLERK_WEBHOOK_SIGNING_SECRET` |
| Supabase URL and publishable key | Supabase dashboard → project → **Project settings → API keys** | Vercel `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` |
| Supabase secret key **secret, bypasses RLS** | Same page, *Secret keys* | Vercel `SUPABASE_SECRET_KEY` only. Never in the browser, the repo or CI logs |
| Sentry DSN | Sentry → project `parmarpro-web` → **Settings → Client Keys (DSN)** | Vercel `NEXT_PUBLIC_SENTRY_DSN` (public by design) |
| Sentry auth token **secret** | Sentry → **Settings → Developer settings**, scope `project:releases` only | Vercel `SENTRY_AUTH_TOKEN` (build) |
| PostHog project key and host | PostHog → **Project settings → Project API key** | Vercel `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` (public by design) |
| Resend API key (`re_…`) **secret** | Resend → **API Keys**, after verifying your sending domain | Vercel `RESEND_API_KEY` |
| Sender address | Your domain, verified in Resend, in the form `ParmarPro <hello@your-domain>` | Vercel `EMAIL_FROM` |
| Founder alert address | The founder's own mailbox | Vercel `FOUNDER_ALERT_EMAIL` |
| Cron secret **secret** | Generate with `openssl rand -hex 32` | Vercel `CRON_SECRET`, and the same value in Supabase Vault as `parmarpro_cron_secret` (see `docs/automations.md`) |
| Link signing secret **secret** | Generate with `openssl rand -hex 32` | Vercel `LINK_SIGNING_SECRET` only |
| Gemini API key, free lane **secret** | Google AI Studio, an API key in a Google Cloud project **without billing**. Non-personal data only | Vercel `GEMINI_FREE_API_KEY` (Sensitive). See [`docs/ai.md`](ai.md) |
| Gemini API key, paid lane **secret** | Google AI Studio, an API key in a **separate** project **with billing** and a budget alert | Vercel `GEMINI_PAID_API_KEY` (Sensitive). See [`docs/ai.md`](ai.md) |
| Vercel access for deploys from your computer | Vercel → **Account settings → Tokens**, or `vercel login` | Your own machine only (never the repo) |
| Local development values | Copy `.env.example` to `.env.local` and fill in dev values | `.env.local` (gitignored) |

Production keys are different keys from different places (a Clerk production instance, a separate Supabase production project). They are created at gate G7 and live only in Vercel's **Production** scope.

The scheduler (pg_cron schedules, Vault secrets, and the GitHub secrets for the backup and nightly E2E workflows) is set up per environment as described in [`docs/automations.md`](automations.md), using `supabase/ops/schedules.sql`.

## 2. One-time provider setup

### 2.1 Supabase (staging)

| Step | Status |
|---|---|
| Project `parmarpro-staging` created in ap-south-1 | ✅ |
| Migrations `20261028120000` … `20261028120600` applied through the Supabase MCP connector | ✅ |
| Security advisor reviewed: no errors. The remaining warnings are intentional and justified in `security-test-results.md` | ✅ |
| SQL-level tenant-isolation smoke test, with synthetic data rolled back | ✅ |
| **Authentication → Sign In / Providers:** disable email sign-ups and every other Supabase Auth provider. ParmarPro uses Clerk only | ⬜ owner |
| **Authentication → Third-party Auth → Add provider → Clerk:** enter the Clerk Frontend API domain of the dev instance (shown in Clerk → Configure → Domains, `upright-dog-4755.clerk.accounts.dev`) | ⬜ owner |
| **Database → Extensions:** disable `pg_graphql` (not used; reduces the API surface) | ⬜ owner (optional) |
| **Settings → API keys:** copy the **secret** key into Vercel (Preview) as `SUPABASE_SECRET_KEY`. Never paste it anywhere else | ⬜ owner |

### 2.2 Clerk (development instance used for staging)

The application was created through the Clerk connector with the B2B template:
- Organizations are enabled.
- The creator role is `org:admin`.
- Organization selection is forced.

Configuration changes through the connector were **declined**, so the following must be done in the Clerk dashboard:

| Step | Why | Status |
|---|---|---|
| **Integrations → Supabase → Activate** (or Sessions → Customize session token: add `"role": "authenticated"`) | Supabase must map Clerk tokens to the `authenticated` role | ⬜ owner, **required** |
| Sessions: keep **session token v2** (the `o` claim with `id` and `rol`) | RLS reads `o.id` and `o.rol`. v1 `org_id` and `org_role` are also accepted as a fallback | ⬜ verify |
| Billing → **turn off** Clerk Billing. The template's sample plans (Free/Starter/Pro in USD) are not used, because ParmarPro has no payment system | Avoids a confusing pricing table | ⬜ owner |
| Organizations → Settings: allow users to create organizations; limit organizations per user (for example 3); members per organization as needed | Onboarding and trial-abuse control | ⬜ owner |
| Multi-factor: enable authenticator app and backup codes. Require MFA for owners before launch | Account takeover protection | ⬜ owner |
| Paths: sign-in `/sign-in`, sign-up `/sign-up`, after sign-up `/onboarding` | Routing | ⬜ owner |
| Webhooks → add endpoint `https://<staging-url>/api/webhooks/clerk` with events `organizationMembership.created`, `organizationMembership.deleted`, `organization.deleted`. Copy the signing secret to `CLERK_WEBHOOK_SIGNING_SECRET` | Lifecycle sync | ⬜ owner |
| Create synthetic test users with `+clerk_test` emails (owner, admin, staff, viewer for Clinic A; owner for Clinic B) | Staging journey and CI E2E | ⬜ owner |
| Copy the **secret** key into Vercel (Preview) and the GitHub secret `E2E_CLERK_SECRET_KEY` | | ⬜ owner |

### 2.4 Sentry and PostHog

| Step | Status |
|---|---|
| Sentry org `parmarpro` exists. Create project `parmarpro-web` (platform Next.js) and set `NEXT_PUBLIC_SENTRY_DSN`. Set `SENTRY_AUTH_TOKEN` (scope `project:releases`) for source maps | ⬜ owner |
| Sentry → Project settings → Security & Privacy: turn on **Data Scrubber** and **Scrub IP addresses**. This is a server-side second layer; the app already scrubs before sending | ⬜ owner |
| PostHog: create a project (US or EU cloud) and set `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`. In project settings, disable session replay, autocapture and heatmaps (the app disables them too) | ⬜ owner |

### 2.5 Vercel project `parmarpro`

| Step | Status |
|---|---|
| Connect the GitHub repository `parmarvpro/Parmarpro` (Settings → Git). Production branch: `main` | ⬜ owner |
| Framework preset: Next.js. Install command: `pnpm install --frozen-lockfile`. Node 22 | ⬜ |
| Environment variables: see `docs/environment-variables.md`. Preview gets staging values; Production gets production values only | ⬜ |
| Deployment Protection: **Vercel Authentication** on for Preview, which is already on for "all except custom domains". Keep it on so staging isn't public. For automated tests use a *Protection Bypass for Automation* secret | ✅ already on |
| Production custom domain `parmarpro.in`. Note: the repository previously served a GitHub Pages site on this domain (removed from `main` by this work). Update DNS to Vercel at cutover | ⬜ G7 |
| Access: restrict the team to the owner. Enable 2FA on the Vercel, GitHub, Clerk, Supabase, Sentry and PostHog accounts | ⬜ owner |
| Logs: Vercel runtime logs can contain request paths. The app never logs bodies or PII (see the threat model, T17) | ✅ by design |

### 2.6 GitHub

| Step | Status |
|---|---|
| CI (`.github/workflows/ci.yml`), CodeQL and Dependabot committed | ✅ |
| Settings → Code security: enable **secret scanning**, **push protection**, **Dependabot alerts and security updates**, and **CodeQL** results | ⬜ owner |
| Branch protection on `main`: require PRs and require the CI and CodeQL checks | ⬜ owner |
| Optional, for the authenticated E2E tests: add repository secrets named `E2E_CLERK_PUBLISHABLE_KEY`, `E2E_CLERK_SECRET_KEY`, `E2E_OWNER_EMAIL` and `E2E_VIEWER_EMAIL` | ⬜ owner |

## 3. Staging verification flow (gate G6)

Run against the staging Preview URL once sections 2.1–2.5 are done. Record results in `docs/security-test-results.md`.

| # | Step | How | Status |
|---|---|---|---|
| 1 | Register a test owner | sign up with `owner+clerk_test@…` | ⬜ |
| 2 | Create Clinic A | onboarding form | ⬜ |
| 3 | Complete onboarding | lands on `/dashboard` | ⬜ |
| 4 | Create a lead | Leads → Add lead | ⬜ |
| 5 | Create a patient (synthetic) | Patients → Add patient, or convert the lead | ⬜ |
| 6 | Schedule an appointment | from the lead or patient | ⬜ |
| 7 | Create a follow-up task | Tasks → Add task | ⬜ |
| 8 | Staff and read-only permissions | invite staff and viewer; confirm the viewer has no write controls and direct writes fail | ⬜ |
| 9 | Cross-tenant isolation with Clinic B | second owner; IDs from A return "not found" | ⬜ (✅ at SQL level on staging, see §2.1) |
| 10 | Sentry test event | trigger a synthetic error and confirm it arrives scrubbed | ⬜ |
| 11 | PostHog events | Live events show only allowlisted names and properties | ⬜ |
| 12 | Session expiry and unauthorized requests | sign out in another tab, then act; direct API calls return 401 | ⬜ (✅ locally for direct calls) |
| 13 | Broken links and failed API calls | browser console and network tab clean | ⬜ |
| 14 | Production build and automated tests | CI green on the deployed commit | ✅ CI |

## 4. Production launch checklist (gate G7: needs explicit owner approval)

**Nothing is deployed to production automatically.** Before approving:

- [ ] All staging steps (section 3) pass and are recorded.
- [ ] A production Clerk instance exists, with its domain verified, MFA required for owners, and the Supabase integration active.
- [ ] A production Supabase project exists (Pro plan, PITR enabled), migrations applied, advisors reviewed, Third-party Auth (Clerk prod) configured, Supabase Auth sign-ups disabled.
- [ ] Privacy notice and terms reviewed by a lawyer, then `LEGAL_TEXT_REVIEWED = true`.
- [ ] Sentry and PostHog production projects created with privacy settings checked (section 2.4).
- [ ] Backups understood and a restore test performed (`docs/backup-and-recovery.md`).
- [ ] Least-privilege access to every account, with MFA everywhere.
- [ ] No test-mode keys in Production scope. The env guard refuses `rzp_test_` keys in production.
- [ ] Rollback plan reviewed (section 5).
- [ ] DNS for `parmarpro.in` moved to Vercel. The old GitHub Pages setting is disabled in the repository settings.

## 5. Rollback plan

- **Application:** Vercel → Deployments → promote the previous production deployment (instant rollback). Or revert the commit on `main` and redeploy.
- **Database:**
  - Migrations are forward-only and additive. To roll back, write a new corrective migration; never edit applied ones.
  - Before any risky migration, take a manual backup (Supabase dashboard) or note the PITR timestamp.
  - Never run destructive repair statements against production to fix staging.
- **Integrations:**
  - Disable webhooks in Clerk to stop processing.
  - Rotate secrets as in `incident-response.md`.
  - Feature switches: unset `NEXT_PUBLIC_POSTHOG_KEY` or `NEXT_PUBLIC_SENTRY_DSN` to disable telemetry.
