# Security test results (gate G5)

Recorded 2026-10-28 on branch `claude/parmarpro-mvp`. Every result below comes from a command that was actually run; nothing is inferred from a package being installed. Items that could not be run are listed in §8 rather than reported as passing.

## 1. Summary

| Check | Where | Result |
|---|---|---|
| ESLint (`--max-warnings=0`, security rules included) | local + CI | ✅ pass |
| TypeScript strict (`next typegen && tsc --noEmit`) | local + CI | ✅ pass |
| Unit tests (`pnpm test`) | local + CI | ✅ 186 / 186 |
| SQL-level RLS, tenant-isolation and billing tests (`pnpm test:db`) | local + CI (`supabase/postgres:17.11.0.006` + PostgREST v16.5) | ✅ 94 / 94 |
| DAL → PostgREST → RLS integration tests (`pnpm test:integration`) | local (24 / 24) + CI at c70d0c2 (23 / 23; the extra test was added afterwards, §6 F-08) | ✅ |
| Generated database types match the migrations | CI | ✅ |
| Production build (`next build`) | local + CI | ✅ |
| Client bundle and public-env secret check (`scripts/check-public-env.mjs`) | local + CI | ✅ no secret values or non-allowlisted `NEXT_PUBLIC_` names |
| No-bypass check (`scripts/check-no-bypass.sh`) | local + CI | ✅ no test bypasses, no privileged credentials outside `env.ts` and `src/server/privileged/` |
| End-to-end (Playwright, Chromium) | local + CI | ✅ 18 passed, 2 skipped (the authenticated journeys need Clerk test credentials, §8) |
| gitleaks 8.30.1 over the full git history | local + CI | ✅ no leaks (4 reviewed false positives, §5) |
| `pnpm audit --prod --audit-level high` | local + CI | ✅ no known vulnerabilities |
| CodeQL (`security-extended`, JavaScript/TypeScript) | GitHub | ✅ workflow succeeded at 5d35b13 and c70d0c2 |
| Supabase security advisor (staging) | `parmarpro-staging` | ✅ 0 errors; the warnings are intentional (§4) |
| Supabase performance advisor (staging) | `parmarpro-staging` | ✅ 0 warnings; INFO "unused index" only (the project holds no data yet) |
| SQL tenant-isolation smoke test on staging | `parmarpro-staging` | ✅ 7 / 7 expected results; synthetic data rolled back and verified gone |

**GitHub Actions evidence.** CI run [40699595694](https://github.com/parmarvpro/Parmarpro/actions/runs/40699595694) at commit c70d0c2: all four jobs succeeded.
- Lint, types, unit tests, build.
- RLS, tenant isolation and integration tests.
- End-to-end.
- Secret scan and dependency audit.

CodeQL run [40699595915](https://github.com/parmarvpro/Parmarpro/actions/runs/40699595915) also succeeded at c70d0c2.

The previous CI run (40698005140 at 5d35b13) **failed** in two jobs, both fixed in c70d0c2:
- **E2E:** GitHub passes unset secrets as empty strings, and `??` did not fall back to the placeholder Clerk key.
- **gitleaks:** found the placeholder Clerk publishable key (§5).

## 2. Tenant-isolation matrix (`docs/security-plan.md` §4)

Fixtures: Clinic A and Clinic B, each with an owner, admin, staff and viewer. Tokens are minted with Clerk-shaped claims (`sub`, `role`, `o.id`, `o.rol`).

| ID | Test location | Result |
|---|---|---|
| TI-01 … TI-17, TI-19 … TI-24 | `tests/db/tenant-isolation.test.ts` | ✅ pass |
| TI-18 | `tests/db/tenant-isolation.test.ts`, `tests/db/billing.test.ts` | ✅ pass |
| TI-01, TI-02, TI-04 (through the application code) | `tests/integration/dal-tenant-isolation.test.ts` | ✅ pass |
| Cross-tenant via direct PostgREST calls with a user's own token (bypassing the app) | `tests/integration/dal-tenant-isolation.test.ts` | ✅ pass |

Two expectations were adjusted during G2, each with a written justification in the test:
1. **Cross-tenant foreign key (TI-06):** the assignee validation trigger rejects the row with `23514` before the composite foreign key can raise `23503`. Either code means "rejected"; the test asserts the rejection and that no row was written.
2. **Permission denied (PostgREST):** PostgREST returns HTTP 403, not 401, for `42501`. The test asserts the status and that the row is unchanged.

No security assertion was removed or weakened.

## 3. Billing matrix (`docs/security-plan.md` §5)

| ID | Test location | Result |
|---|---|---|
| BL-01 invalid or missing webhook signature | `unit/billing-signatures`, `unit/billing-webhook`, E2E `api-security` | ✅ |
| BL-02 valid captured payment extends the period | `unit/billing-reconcile`, `unit/billing-webhook`, `db/billing`, `integration/billing-webhook` | ✅ |
| BL-03 duplicate event id is a no-op | `unit/billing-webhook`, `db/billing` | ✅ |
| BL-04 webhook + verify route for the same payment apply once | `db/billing` | ✅ |
| BL-05 amount or currency mismatch | `unit/billing-reconcile`, `unit/billing-webhook`, `db/billing` | ✅ |
| BL-06 unknown order | `unit/billing-reconcile`, `db/billing` | ✅ |
| BL-07 failed payment leaves the entitlement unchanged | `unit/billing-reconcile`, `db/billing` | ✅ |
| BL-08 authorized but not captured stays pending | `unit/billing-reconcile` | ✅ |
| BL-09 unknown event type is ignored | `unit/billing-webhook` | ✅ |
| BL-10 verify route with a bad signature | `unit/billing-checkout` | ✅ |
| BL-11 another clinic's order | `unit/billing-checkout`, `unit/billing-reconcile` | ✅ |
| BL-12 client-supplied amount ignored | `unit/billing-checkout` | ✅ |
| BL-13 only owners can create orders | `unit/billing-checkout`, plus the permission matrix in `unit/permissions` | ✅ |

The Razorpay API is mocked in these tests. **No real Razorpay test-mode payment has been made yet** (§8).

## 4. Supabase advisors (staging, re-run 2026-10-28)

**Security**
- 0 errors.
- **WARN `anon_security_definer_function_executable` (1):** `submit_contact_request`. *Intentional.* This is the public contact form. It inserts only into `contact_requests`, which `anon` can't read. Inputs are length- and format-checked by table constraints. The function has a global cap of 200 requests per 10 minutes, and the Next.js route adds per-IP rate limiting and a honeypot. Residual risk is recorded as F-07.
- **WARN `authenticated_security_definer_function_executable` (7):** `create_clinic_for_active_org`, `create_invitation`, `attach_clerk_invitation`, `revoke_invitation`, `change_member_role`, `remove_member`, `submit_contact_request`. *Intentional.* These RPCs exist to enforce role rules that RLS alone can't express: no self-promotion, admins can't touch owners or admins, last-owner protection, and one clinic per organization. Each one:
  - has `set search_path = ''`;
  - derives the clinic and role from the verified JWT plus `clinic_members`, never from parameters;
  - is covered by TI-08, TI-09, TI-10 and TI-23.

  Privileged functions (`apply_verified_payment`, `accept_invitation_membership`, `record_payment_attempt`, and the Clerk lifecycle functions) are granted to `service_role` only and do **not** appear in this list.
- **INFO `rls_enabled_no_policy` (2):** `webhook_events` and `contact_requests`. *Intentional deny-all.* There are no client policies and no grants. They are written only by `service_role` or the contact RPC.

**Performance**
- INFO `unused_index` (22). The staging project has no traffic yet, so every index is unused. Review after launch.
- The earlier `unindexed_foreign_keys` findings were fixed by migration `20261028120600_fk_indexes.sql`.

## 5. Secret scanning: reviewed false positives

| Finding | Evidence it is not a secret | Handling |
|---|---|---|
| `jwt` in `tests/unit/scrub.test.ts` (commit 24d89f1) | Synthetic token built to test that the Sentry scrubber redacts JWTs. Its claims are `{"sub":"user_123"}` and its signature segment is the base64 of the literal text `signaturesignature`, so it is not signed with any key | Inline `gitleaks:allow`, plus a fingerprint in `.gitleaksignore` for the historical commit |
| `stripe-access-token` in `tests/unit/scrub.test.ts` (24d89f1) | A synthetic `sk_test_` prefix followed by the word FAKE repeated, used to test redaction. ParmarPro does not use Stripe | Same |
| `generic-api-key` in `.github/workflows/ci.yml` and `tests/e2e/fixtures.ts` (48fb8a0) | `pk_test_ZXhh…` base64-decodes to `example.clerk.accounts.dev$`. It is a placeholder **publishable** key (public by design) that points at no real Clerk instance | Same |
| `generic-api-key` in `tests/unit/email-send.test.ts`, `notifications-claim.test.ts` and `jobs-handler.test.ts` (368bb38) | Literal test strings `re_test_0123456789abcdef` and `cron_test_secret_0123456789abcdef0123456789`, made of sequential digits and hex; used only to exercise the Resend sender and the job endpoint's bearer check. No Resend account or deployment uses them | Same |

`.gitleaksignore` lists fingerprints only, never directories or rules. A new finding anywhere still fails CI.

## 6. Manual security code review (checklist in `docs/security-plan.md` §7)

The source was read file by file. Findings and outcomes:

| # | Finding | Severity | Status |
|---|---|---|---|
| F-01 | `AppError` kept the raw database or provider error as `cause`. Logging it could write patient data (for example a constraint message quoting a value) to logs or Sentry | Medium | ✅ Fixed: only `{name, code}` is kept (`summarizeCause`). Unit test in `tests/unit/errors.test.ts` |
| F-02 | PostHog could send URL, referrer or UTM properties nested inside `$set` / `$set_once`, and URLs can contain search terms | Medium | ✅ Fixed: `sanitizeCapture` strips them and drops any event not in the schema. Unit tests in `tests/unit/analytics.test.ts` |
| F-03 | The rate limiter keyed on the first `x-forwarded-for` value, which a client can set | Medium | ✅ Fixed: it prefers `x-real-ip`, which Vercel sets |
| F-04 | Pages a role may not see (for example Billing for staff) showed a generic error instead of a clear "no access" state | Low | ✅ Fixed: a `NoAccess` component, and authorization is still enforced on the server |
| F-05 | Onboarding events were tracked before PostHog was initialised on that route, so events were lost | Low | ✅ Fixed: `AnalyticsProvider` wraps onboarding |
| F-06 | `my_membership()` was `SECURITY DEFINER` but needs no elevated rights | Low | ✅ Fixed: changed to `SECURITY INVOKER` (migration `20261028120500`) |
| F-07 | The global cap on `submit_contact_request` means an attacker calling PostgREST directly with the public key could fill it and block real contact submissions for up to 10 minutes. No data is exposed | Low | Accepted for the MVP. Follow-up: add Vercel Firewall / WAF rate limiting, or move the contact insert behind the privileged server path only. Owner: product owner |
| F-08 | `getPatient` used `select("*")`. Every column is currently readable by every role, but a future sensitive column would leak by default | Low | ✅ Fixed: explicit column list. Integration test asserts `clinic_id` and `created_by` are not returned |
| F-09 | The legal pages (privacy, terms) are drafts | — (compliance) | Shown with a "draft — under legal review" banner (`LEGAL_TEXT_REVIEWED = false`). Blocks production (G7 checklist) |

Checklist items with no findings:
- **Authorization on every action and handler:** every exported DAL function begins with `requirePermission` (32 exported functions, 33 checks). Route handlers authenticate or verify signatures.
- **IDOR:** all lookups go through RLS with the user's own token, and a guessed ID returns `not_found`.
- **`NEXT_PUBLIC_` secrets:** none. Allowlist and bundle scan in CI.
- **Privileged client outside `src/server/privileged/`:** blocked by ESLint and the no-bypass script.
- **Tables without RLS or with leftover default grants:** none. Default privileges are revoked, and the TI-16 and TI-17 tests cover them.
- **Webhooks without signature checks:** none (BL-01 and the Clerk Svix E2E test).
- **Debug routes and test bypasses:** none.
- **Unvalidated input:** all actions and routes parse with Zod; bodies have size limits.

Severity summary: **0 critical, 0 high**. 3 medium, all fixed. 5 low: 4 fixed, 1 accepted with a follow-up. 1 compliance blocker for production.

## 7. Local runtime checks (production build, `next start`)

- **Security headers present on public pages:**
  - HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP;
  - a nonce-based CSP with `strict-dynamic`, `frame-ancestors 'none'` and `object-src 'none'`.
- **Unauthenticated `POST /api/billing/verify`:** 401.
- **Forged or unsigned Razorpay and Clerk webhooks:** 400.
- **Invalid, oversized or wrongly typed contact submissions:** 422.
- **Server actions:**
  - called without a session: redirect to sign-in, no data;
  - called cross-origin: rejected by Next.js.

## 8. Not verified (and why)

| Item | Why it is not verified | What is needed |
|---|---|---|
| Authenticated E2E journeys (2 tests skipped) | No Clerk test credentials in CI or here | Owner adds `E2E_CLERK_*` secrets and test users (`docs/deployment.md` §2.2) |
| End-to-end sign-in with real Clerk tokens against Supabase | The Clerk ↔ Supabase third-party auth is not activated yet. The connector configuration change was declined, so it is a manual owner step | `docs/deployment.md` §2.1–2.2 |
| Razorpay test-mode payment and real webhook delivery | No Razorpay keys provided yet; Razorpay is unreachable from this container | `docs/deployment.md` §2.3, staging step 10–11 |
| Sentry event delivery and server-side scrubbing | Sentry project and DSN not configured | `docs/deployment.md` §2.4 |
| PostHog event delivery | No PostHog project or key | `docs/deployment.md` §2.4 |
| Staging deployment on Vercel | Repository not yet linked; environment variables not set | `docs/deployment.md` §2.5 |
| Backup restore | Not performed | `docs/backup-and-recovery.md` §4 |
| Load and abuse testing, external penetration test | Out of scope for this build | Recommended before handling real patient data at scale |
| Legal, privacy and healthcare compliance | Not something tests can show. Using reputable providers does not make the product compliant | Legal review before launch |
