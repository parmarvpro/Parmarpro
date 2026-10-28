# Environment variables

Placeholders live in `.env.example`. Real values are kept only in:
- Vercel project environment variables, scoped per environment;
- GitHub Actions secrets;
- a developer's own `.env.local`, which is gitignored.

**Rules**
- Any variable prefixed `NEXT_PUBLIC_` ships in the browser bundle and must be safe to publish. `scripts/check-public-env.mjs` enforces an allowlist of public names. After every build, CI also scans the client bundle for the values of server secrets.
- Server code reads secrets only through `src/lib/env.ts`, which validates them with Zod on first use and reports variable names, never values. ESLint forbids reading `process.env.*SECRET*` anywhere else.
- Production values exist only in the Vercel **Production** scope. Preview and Development scopes use separate development and staging credentials.

| Variable | Public? | Used by | Development | Preview / staging | Production | Notes |
|---|---|---|---|---|---|---|
| `NEXT_PUBLIC_APP_ENV` | yes | app, Sentry environment, Razorpay key guard | `development` | `staging` | `production` | A live Razorpay key is refused outside `production`, and a test key is refused in `production` |
| `NEXT_PUBLIC_APP_URL` | yes | metadata, invitation redirect | `http://localhost:3000` | staging URL | `https://parmarpro.in` (after cutover) | |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | yes | Clerk | ParmarPro **dev** instance key | dev instance key | **prod** instance key | Publishable by design |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `_SIGN_UP_URL` | yes | Clerk | `/sign-in` / `/sign-up` | same | same | |
| `CLERK_SECRET_KEY` | **secret** | server (auth, Backend API) | dev | dev | prod | |
| `CLERK_WEBHOOK_SIGNING_SECRET` | **secret** | `/api/webhooks/clerk` | — | dev webhook | prod webhook | One per webhook endpoint |
| `SUPABASE_URL` | server only | Supabase clients | local or staging | `https://nhuwxiffckuhasbvesmr.supabase.co` | production project URL | |
| `SUPABASE_PUBLISHABLE_KEY` | server only (public by design) | user-scoped and anonymous clients | staging | staging publishable key | prod publishable key | Not exposed to the browser because the browser doesn't need it |
| `SUPABASE_SECRET_KEY` | **secret, privileged** | `src/server/privileged/*` only | staging | staging | prod | Bypasses RLS. Never `NEXT_PUBLIC_`. Rotate on any suspicion |
| `RAZORPAY_KEY_ID` | server only | billing | `rzp_test_…` | `rzp_test_…` | `rzp_live_…` | Sent to the browser per order, for Checkout |
| `RAZORPAY_KEY_SECRET` | **secret** | billing | test | test | live | |
| `RAZORPAY_WEBHOOK_SECRET` | **secret** | `/api/webhooks/razorpay` | test | test | live | Set in the Razorpay dashboard webhook settings |
| `NEXT_PUBLIC_SENTRY_DSN` | yes | Sentry SDKs | optional | staging DSN | prod DSN | Empty disables Sentry |
| `SENTRY_ORG`, `SENTRY_PROJECT` | build | source-map upload | — | `parmarpro` / project | same | |
| `SENTRY_AUTH_TOKEN` | **secret (build)** | source-map upload | — | optional | yes | Scope it to `project:releases` only |
| `NEXT_PUBLIC_POSTHOG_KEY` | yes | PostHog (in-app only) | optional | staging project | prod project | Empty disables analytics |
| `NEXT_PUBLIC_POSTHOG_HOST` | yes | `/ingest` rewrite target | `https://us.i.posthog.com` | same | same, or the EU host | |

**CI-only secrets** (GitHub Actions; optional): `E2E_CLERK_PUBLISHABLE_KEY`, `E2E_CLERK_SECRET_KEY`, `E2E_OWNER_EMAIL`, `E2E_VIEWER_EMAIL`. They enable the authenticated Playwright journey against the Clerk **development** instance. Never use production keys in CI.

**Local test stack:** `scripts/local-db/start.sh` generates a random database password and JWT secret for each run and writes them to `.env.test.local`, which is gitignored and disposable.
