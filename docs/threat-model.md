# ParmarPro — Threat Model

Written at gate G0 and reviewed again at G5. The method is STRIDE per actor and asset, with the OWASP Top 10:2025 as a cross-check.

## 1. Data inventory

| Category | Data | Where stored | Sensitivity | Notes |
|---|---|---|---|---|
| Authentication | Passwords, MFA factors, sessions, emails of ParmarPro users | **Clerk only** | High | ParmarPro never stores passwords. The app sees only Clerk user IDs and, for invitations, the invitee's email |
| Staff identity | Clerk user ID, display name, app role, invitation email | Supabase `clinic_members`, `clinic_invitations` | Medium | Display name is optional |
| Clinic | Clinic name, city, timezone, Clerk organization ID | Supabase `clinics` | Low–medium | |
| Patient contact (personal data) | Name, phone (E.164), email, communication consent and opt-out | Supabase `patients`, `leads` | **High**: personal data of patients. Under India's DPDP Act 2023 the clinic is the data fiduciary and ParmarPro is a processor | No diagnoses, prescriptions, or clinical notes by design. Operational notes are length-limited and the UI warns against clinical content |
| Operational | Appointment times, appointment type (coarse enum), status, tasks, follow-up dates | Supabase | Medium | An appointment at a dental clinic is itself mildly health-adjacent. It is treated as sensitive |
| Audit | Activity events (actor ID, entity ID, action, changed field names) | Supabase `activity_events` | Low–medium | No field values or PII in metadata |
| Payment | Razorpay order and payment IDs, amount, status, method type | Supabase `billing_orders`, `payments` | Medium | **No card numbers, CVV, UPI PINs, or bank credentials ever reach ParmarPro.** Razorpay Checkout collects them |
| Webhook | Event ID, type, hash of the payload, processing status | Supabase `webhook_events` | Low | Raw payloads are not stored |
| Secrets | Clerk secret key, Supabase secret key, Razorpay key secret and webhook secret, Clerk webhook signing secret, Sentry auth token | Vercel environment variables and GitHub Actions secrets only | **Critical** | Never in the repo, never prefixed `NEXT_PUBLIC_` |
| Telemetry | Error stack traces (scrubbed), product events (enums and counts) | Sentry, PostHog | Low after scrubbing | Must not contain patient or contact data |
| Marketing contact | Prospective clinic contact name, phone, email, message | Supabase `contact_requests` | Medium | Anonymous users can insert only; they cannot read anything back |

## 2. Actors

1. **Anonymous internet user.** Can reach marketing pages, the contact form, sign-up, webhook endpoints, and the Supabase Data API with the publishable key.
2. **Authenticated user without a clinic.** Signed up but belongs to no organization.
3. **Malicious member of Clinic A.** Wants Clinic B's data, or wants to escalate within Clinic A. This could be a staff member trying to become owner, or a viewer trying to write.
4. **Compromised account.** An attacker has a valid session for a real user (phishing, stolen device).
5. **Former member.** Removed from a clinic but still holding a browser session.
6. **Holder of a stolen secret.** An attacker with a leaked Supabase secret key, Razorpay secret, or webhook secret.
7. **Forged webhook sender.** Posts fake Razorpay or Clerk events.
8. **Malicious or compromised dependency.** A supply-chain attack through npm or GitHub Actions.
9. **Insider at a third-party service**, or over-collection by one (Sentry, PostHog).

## 3. Threats and mitigations

| # | Threat (STRIDE) | Actor | Mitigation | Verified by |
|---|---|---|---|---|
| T1 | **Cross-tenant read** (I) by substituting a record ID or clinic ID | 3, 4 | RLS on every tenant table requires the JWT `o.id` to match the clinic and an active membership. The server derives the clinic from verified claims, never from input | DB and integration tenant matrix |
| T2 | **Cross-tenant write/move** (T): inserting under Clinic B, updating `clinic_id`, or linking a Clinic B patient to a Clinic A lead | 3 | RLS `WITH CHECK`; column-level UPDATE grants that exclude `clinic_id`; a trigger that blocks `clinic_id` changes; composite foreign keys `(clinic_id, ref_id)` | DB tests |
| T3 | **Privilege escalation** (E): staff sets self to owner, admin demotes owner, viewer writes | 3 | `clinic_members` has no direct write grants. Role changes go only through SECURITY DEFINER RPCs that enforce the rules: no self-change; admins manage only staff and viewers; the last owner is protected. Write policies require owner, admin, or staff | DB tests and unit tests |
| T4 | **Direct Data API abuse** (E/I): user calls PostgREST with their own JWT, bypassing UI rules | 3, 4 | The database enforces every rule: RLS, grants, triggers, RPCs, and entitlement checks for writes. Billing, webhook, and entitlement tables are read-only or invisible to users | DB tests (they *are* direct calls) |
| T5 | **Broken authentication at server endpoints** (S): calling a Server Action or Route Handler without a session | 1, 2 | `requirePermission()` runs at the start of every action and handler and returns 401 or 403. Middleware is not relied on | Unit tests with `auth()` mocked; E2E direct calls |
| T6 | **Stale access after removal** (E) | 5 | Clerk stops issuing the org claim after removal (tokens last about 60 seconds). RLS requires both the org claim and an active membership. The Clerk webhook deactivates membership | DB test: membership row present but no org claim → denied |
| T7 | **Forged Razorpay webhook** (S/T) granting paid access | 7 | HMAC-SHA256 over the raw body with a timing-safe compare; event-type allowlist; the order must exist in `billing_orders`; amount, currency, and clinic must match; payment status must be `captured` | Unit tests |
| T8 | **Payment replay or duplication** (T/R) extending access twice | 7, 3 | Unique `(provider, event_id)`, unique `provider_payment_id`, and a conditional `created → paid` transition inside a single transaction | DB and unit tests (including a race) |
| T9 | **Client-side payment spoofing** (S): faking a Checkout success callback, or tampering with the amount | 3 | The amount is computed on the server from config. The verify route checks the signature **and** fetches the payment from Razorpay on the server. A browser callback alone never grants access | Unit tests |
| T10 | **Forged Clerk webhook** (S) | 7 | Svix signature verification. Handlers only deactivate or archive data, or look up facts through the Clerk Backend API before granting anything | Unit tests |
| T11 | **Leaked privileged secret** (E/I) | 6 | Secrets live only in Vercel and GitHub encrypted variables, scoped per environment. A build-time guard prevents secrets under `NEXT_PUBLIC_`. `server-only` imports. Gitleaks runs in CI, with GitHub push protection. A rotation runbook is in `incident-response.md` | CI secret scan; build guard test |
| T12 | **Injection** (T/I): SQL, or a PostgREST filter injected through search strings | 1, 3 | Parameterized supabase-js queries. Search terms are escaped for `ilike`, and no user input is placed in `.or()` filter strings. No dynamic SQL in RPCs (`format()` with `%L`/`%I` only if ever needed). Zod validates every input | Unit tests; code review |
| T13 | **XSS / unsafe rendering** (T/I) | 1, 3 | React escaping. No `dangerouslySetInnerHTML` with user data. Strict CSP, `frame-ancestors 'none'`, and `X-Content-Type-Options` | Code review; header test |
| T14 | **Open redirect** (S) after sign-in | 1 | Only relative redirects on an allowlist; Clerk redirect URLs configured | Unit test |
| T15 | **CSRF** on Server Actions and route handlers | 1 | Next.js Server Actions check Origin against Host. Route handlers that change state require a Clerk session, and Clerk's cookies are `SameSite=Lax`. Webhooks use signatures instead of cookies | E2E; code review |
| T16 | **PII leakage into telemetry** (I) | 9 | Sentry `sendDefaultPii: false`, scrubbing in `beforeSend` and `beforeBreadcrumb`, no Replay. PostHog runs with no autocapture or recording, allowlisted typed events, and route-template URLs | Unit tests on the scrubbers and the event schema |
| T17 | **PII in logs** (I) | 9 | Structured logger with redaction. Request bodies are never logged | Code review |
| T18 | **Supply-chain compromise** (T/E) | 8 | Lockfile with `--frozen-lockfile`; minimal dependencies; Dependabot; `pnpm audit`; GitHub Actions pinned to commit SHAs; CodeQL | CI |
| T19 | **Denial of wallet / spam** through the contact form or sign-up | 1 | Honeypot field, size limits, per-IP rate limit (best effort, in memory, documented as limited), and Clerk bot protection on sign-up | Unit tests |
| T20 | **Mass assignment** (T): extra fields such as `role`, `clinic_id`, or `status` in a request body | 3 | Zod `.strict()` schemas with explicit field mapping, plus column-level grants | Unit and DB tests |
| T21 | **Information disclosure through errors** (I) | 1, 3 | Generic messages to users; details only in scrubbed Sentry events. A missing record and a forbidden record return the same "not found" | Unit tests |
| T22 | **Organization-switch confusion** (E): an action runs against the wrong clinic after the user switches organizations | 3 | Every request re-derives the clinic from the current token's `o.id`; nothing is cached across requests | Integration test |
| T23 | **Invitation hijack** (E): accepting an invitation meant for someone else | 1 | Clerk binds invitations to the invitee's verified email. Reconciliation reads membership and invitation metadata from the Clerk Backend API, never from the client | Unit test of the reconciliation logic |
| T24 | **Test or debug bypass left in production** (E) | — | No auth-bypass flags exist in application code. Test doubles live only under `tests/`. A CI grep check looks for bypass patterns | CI check; code review |

## 4. Residual risks and assumptions

- **Clerk and Supabase are trusted** for JWT signing and verification. A compromise of either is out of scope for the app but covered by the incident runbook.
- **A compromised owner account** has full control of its own clinic. Mitigation: encourage MFA (Clerk). Enforcing MFA for owners is a G7 decision.
- **In-memory rate limiting** is per serverless instance. It is a deterrent, not a guarantee. A production rate limiter (for example Upstash or Vercel Firewall rules) is a follow-up.
- **Legal compliance** (DPDP Act 2023, any health-information obligations, GST invoicing) is **not** claimed. The privacy notice and terms need legal review before launch.
