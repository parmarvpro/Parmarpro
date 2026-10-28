# Operations and maintenance (gate G8)

## Every change

1. Work on a branch and open a PR. CI must be green: lint, typecheck, unit tests, the RLS and tenant-isolation suite, integration, E2E, build, bundle secret check, gitleaks, audit and CodeQL.
2. Review the diff. Look in particular at:
   - new or changed Server Actions and Route Handlers: each must call `requirePermission()` or verify a signature;
   - any import of `src/server/privileged/*`;
   - SQL migrations: RLS enabled, explicit grants, no `security definer` without `set search_path = ''` and an explicit `grant execute`;
   - anything sent to Sentry, PostHog or logs.
3. A database change ships as a **new migration**. Add tenant-isolation tests for new tables. Regenerate the types with `pnpm db:local:start && pnpm db:types`.
4. Permission changes: update `src/server/auth/permissions.ts`, the RLS policies, `docs/security-plan.md` §2, and the matrix tests together.
5. Test the affected business flows on staging before promoting.
6. Keep changes recoverable: small commits, no history rewrites on shared branches.

## Weekly

- Review Dependabot PRs and alerts. Update vulnerable dependencies, re-run the full CI, and read changelogs for auth, database and payment SDKs.
- Review Sentry issues, especially `webhook.*`, `billing.*` and spikes of `forbidden`.
- Review `webhook_events` rows with status `failed`, and Razorpay webhook delivery logs.

## Monthly

- Supabase security and performance advisors: no new errors.
- Review access:
  - team members in GitHub, Vercel, Clerk, Supabase, Razorpay, Sentry and PostHog;
  - remove people who have left;
  - confirm MFA is on everywhere.
- Spot-check that Sentry events and PostHog events contain no personal data.
- Reconcile Razorpay payments against `payments` and `billing_orders`.
- Review Vercel environment-variable scopes. Remove unused credentials and integrations.

## Quarterly

- Backup restore test (`docs/backup-and-recovery.md` §4) and record the result.
- Rotate the long-lived secrets: Supabase secret key, Razorpay key secret and webhook secret, Clerk secret, Sentry token.
- Re-read the threat model and update it for new features.
- Review the privacy notice against what the product actually does.

## Useful commands

```bash
pnpm db:local:start        # disposable supabase/postgres + PostgREST with all migrations
pnpm test:db               # SQL-level RLS / tenant isolation / billing tests
pnpm test:integration      # DAL -> PostgREST -> RLS tests
pnpm test                  # unit tests
pnpm test:e2e              # Playwright (builds must exist: pnpm build)
pnpm db:local:stop
```
