# ParmarPro

Patient follow-up and clinic operations for dental clinics in Mumbai. The front desk tracks inquiries (leads), patients, appointments and follow-up tasks in one workspace. Each clinic is a separate tenant with owner, admin, staff and read-only roles.

ParmarPro is **not** an electronic health record. It stores contact details and communication consent only, never clinical notes.

> **Status:** MVP built and tested; staging is partly provisioned and production is not deployed. See [`docs/security-test-results.md`](docs/security-test-results.md) for what has been verified and what has not, and [`docs/deployment.md`](docs/deployment.md) for the remaining owner steps.

## Stack

- **App:** Next.js 16 (App Router, `src/proxy.ts`), React 19, TypeScript (strict), Tailwind CSS 4, shadcn-style components, Lucide icons. Light-only visual identity described in [`docs/design-system.md`](docs/design-system.md).
- **Auth:** Clerk, where each clinic is a Clerk organization.
- **Database:** Supabase Postgres with row-level security. It receives Clerk session tokens through native third-party auth.
- **Payments:** Razorpay Orders. One plan, ₹75,000 + 18% GST per clinic per month, paid per period.
- **Observability:** Sentry for errors and PostHog for product analytics, both scrubbed of personal data before sending.
- **Hosting and CI:** Vercel hosting; GitHub Actions CI with CodeQL, gitleaks and Dependabot.
- **Tests:** Vitest (unit, database, integration) and Playwright (end-to-end).

## Quick start

Requirements: Node 22, pnpm 10, and Docker (for the database tests).

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local       # fill in development values; see docs/environment-variables.md
pnpm dev
```

Secrets never go in `NEXT_PUBLIC_` variables. Every `.env*` file except `.env.example` is git-ignored.

## Tests and checks

```bash
pnpm lint && pnpm typecheck && pnpm test      # lint, types, unit tests
pnpm db:local:start                            # disposable supabase/postgres + PostgREST with all migrations
pnpm test:db                                   # RLS, tenant isolation and billing at the SQL level
pnpm test:integration                          # application code -> PostgREST -> RLS
pnpm db:local:stop
pnpm build && pnpm test:e2e                    # Playwright against the production build
bash scripts/check-no-bypass.sh                # no test bypasses or misplaced privileged credentials
node scripts/check-public-env.mjs              # no secrets in public env or the client bundle
```

CI (`.github/workflows/ci.yml`) runs all of the above, plus gitleaks over the full history and `pnpm audit`.

## Repository layout

| Path | Contents |
|---|---|
| `src/app/` | routes: marketing pages, sign-in/up, onboarding, `/dashboard/*`, API routes and webhooks |
| `src/server/auth/` | session context, permission matrix, typed errors |
| `src/server/dal/` | data access. Every function checks permission, validates input, then queries with the user's own token |
| `src/server/privileged/` | the only code allowed to use the Supabase secret key |
| `src/server/billing/` | Razorpay provider, signature checks, payment reconciliation, webhook processing |
| `supabase/migrations/` | schema, RLS policies, grants, triggers, RPCs |
| `tests/` | `unit`, `db`, `integration`, `e2e` |
| `docs/` | design, security and operations documentation |

## Documentation

- [Architecture](docs/architecture.md)
- [Threat model](docs/threat-model.md)
- [Security plan](docs/security-plan.md) (permission matrix, test matrices)
- [Security test results](docs/security-test-results.md)
- [Environment variables](docs/environment-variables.md)
- [Deployment, staging and launch checklist](docs/deployment.md)
- [Operations and maintenance](docs/operations.md)
- [Incident response](docs/incident-response.md)
- [Backup and recovery](docs/backup-and-recovery.md)
- [Analytics events](docs/analytics-events.md)
- [Design system](docs/design-system.md)

## Data rules

- Use **synthetic data only** in development, tests and staging.
- Never load real patient information outside production.
- Production is deployed only after the G7 checklist in `docs/deployment.md` is complete and the owner approves.
