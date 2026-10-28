# ParmarPro — Architecture

ParmarPro is a multi-tenant SaaS for dental clinics, starting in Mumbai, India. It covers lead and inquiry follow-up, patient contact records, appointments, follow-up tasks, team roles, and operational reporting.

This document describes the intended architecture, the trust boundaries, and the data flows. It was written at gate G0, before any feature code. Later gates update it when the implementation differs from the plan.

## 1. Components

| Component | Technology | Role |
|---|---|---|
| Web app | Next.js 16 App Router (TypeScript strict), hosted on Vercel | Marketing site, authenticated dashboard, Server Actions, Route Handlers |
| Identity | Clerk | Sign-up, sign-in, sessions, MFA, organizations (one Clerk organization = one clinic), invitations |
| Database | Supabase PostgreSQL (ap-south-1) | All persistent application data. Row Level Security enforces tenant isolation and roles |
| Payments | Razorpay (Orders + Checkout) | Monthly pay-per-period billing in INR |
| Error monitoring | Sentry (`@sentry/nextjs`) | Client and server exceptions, scrubbed before sending |
| Product analytics | PostHog | Allowlisted product events only; no autocapture, no session replay |
| Source control / CI | GitHub + GitHub Actions | Lint, typecheck, tests, build, dependency audit, secret scanning, CodeQL |

## 2. Trust boundaries

```mermaid
flowchart LR
  subgraph Untrusted["Untrusted: Internet"]
    B[Browser\nclinic staff / visitors]
    ATT[Attacker\nforged requests, stolen tokens]
  end

  subgraph Vercel["Trust zone: Vercel (Next.js server)"]
    PX[proxy.ts\nClerk middleware:\nfirst-layer redirect only]
    SA[Server Actions &\nRoute Handlers]
    AUTHZ[server/auth\nrequirePermission()]
    DAL[server/dal\nZod validation +\nuser-scoped Supabase client]
    PRIV[server/privileged\nsecret key, named functions only]
    WH[api/webhooks/*\nsignature verification]
  end

  subgraph Clerk["Trust zone: Clerk"]
    CK[Clerk FAPI/BAPI\nsession JWT signer]
  end

  subgraph Supabase["Trust zone: Supabase"]
    PGRST[PostgREST / Data API\nverifies Clerk JWT]
    PG[(PostgreSQL\nRLS + grants + triggers)]
  end

  subgraph Razorpay["Trust zone: Razorpay"]
    RZ[Orders / Payments API]
    RZW[Webhook sender]
  end

  SEN[Sentry]
  PH[PostHog]

  B -- HTTPS + Clerk session cookie --> PX --> SA --> AUTHZ --> DAL
  DAL -- Clerk session JWT --> PGRST --> PG
  B -. "could call directly with own JWT" .-> PGRST
  ATT -.-> PX
  ATT -.-> PGRST
  ATT -.-> WH
  B <-- sign-in UI --> CK
  SA -- verify session --> CK
  RZW -- HMAC-signed webhook --> WH --> PRIV --> PG
  SA -- create order / fetch payment (key secret) --> RZ
  B -- Checkout.js --> RZ
  SA -- scrubbed errors --> SEN
  B -- scrubbed errors --> SEN
  B -- allowlisted events --> PH
```

**Boundary rules**

1. **Browser → Next.js server.** Nothing from the browser is trusted. That includes form fields, IDs, organization IDs, roles, amounts, and redirect targets. Every Server Action and Route Handler verifies the Clerk session on the server and validates input with Zod.
2. **The route-protection middleware (`proxy.ts`) is not a security boundary.** It only redirects signed-out browsers. Authorization runs again inside every action and handler through `requirePermission()`.
3. **Next.js server → Supabase.** Ordinary operations use the **publishable key plus the user's Clerk session JWT**. PostgreSQL then enforces RLS as that user. The server never passes a client-supplied clinic ID as an authorization fact. The clinic is derived from the verified JWT claim `o.id`.
4. **The browser can reach the Supabase Data API directly** with its own Clerk JWT, because the publishable key is public. The database is therefore designed to be safe against direct calls. RLS, column grants, triggers, and SECURITY DEFINER RPCs enforce every rule that matters, including roles, tenant isolation, immutable tenant IDs, and entitlement for writes.
5. **The privileged path** (Supabase secret key) is used only in `src/server/privileged/`. It is reachable only from:
   - signature-verified webhook handlers;
   - billing verification after authentication, authorization, and server-side reconciliation with Razorpay;
   - invitation reconciliation after a Clerk Backend API lookup.
   The module exposes named operations, not a generic query interface. An ESLint rule blocks imports from anywhere else.
6. **Razorpay → webhook.** A webhook is accepted only after an HMAC-SHA256 check of the raw body against `RAZORPAY_WEBHOOK_SECRET`, an event-type allowlist, a de-duplication check on the event ID, and a match against an order we created.
7. **Clerk → webhook.** A webhook is accepted only after Svix signature verification.
8. **Telemetry.** Data sent to Sentry and PostHog is reduced inside the app before it is sent: scrubbing hooks, allowlisted event properties, and no patient or contact data.

## 3. Identity, tenancy and roles

- **One clinic = one Clerk organization.** `clinics.clerk_org_id` holds the Clerk organization ID.
- **The active organization comes from Clerk.** The Clerk session token carries `o.id` (the active organization ID) and `o.rol` (the Clerk role) whenever the user has an active organization. Clerk signs the token, and Supabase verifies it through its native third-party-auth integration with Clerk. The token also carries `role: "authenticated"` so that PostgREST uses the `authenticated` Postgres role.
- **App roles live in `clinic_members`, not in Clerk.** The roles are `owner`, `admin`, `staff`, and `viewer`.
  - Reason: Clerk's free plan offers only `org:admin` and `org:member`. Custom roles are a paid add-on, and keeping roles in Postgres lets RLS enforce them directly.
  - Clerk mapping: owner → `org:admin`; admin, staff, viewer → `org:member`. Only owners can change Clerk-level membership through Clerk's own UI or API. Admins manage staff through ParmarPro server actions, which apply ParmarPro's rules.
- **RLS needs both conditions.** A row is visible to a user only when:
  - the JWT's `o.id` equals the row's clinic `clerk_org_id`, **and**
  - an active `clinic_members` row exists for the JWT's `sub` in that clinic.
- **Removal takes effect quickly.** When someone is removed from the Clerk organization, Clerk stops issuing that org claim. Session tokens live about 60 seconds, so access ends within about a minute, even if the `clinic_members` row has not been cleaned up yet.

## 4. Data flows

### 4.1 Ordinary authenticated operation (for example, creating a lead)

1. The browser submits a form, which calls a Server Action.
2. The action runs `requirePermission('lead:create')`:
   - `auth()` returns `userId` and `orgId`; missing values raise 401 or 403;
   - it loads the clinic and member role through the user-scoped Supabase client, so RLS applies;
   - it checks the permission matrix.
3. Zod validates the input. The `clinic_id` is taken from the auth context, never from the form.
4. The insert goes through the user-scoped client. RLS `WITH CHECK` verifies the clinic, the role, and the entitlement. Composite foreign keys keep related rows (patient, assignee) in the same clinic. A trigger writes an `activity_events` row with no PII.
5. The action sends a PostHog `lead_created` event. Its properties are enums and counts only.

### 4.2 Clinic creation (onboarding)

1. A signed-in user without a clinic submits the clinic name.
2. The server creates the Clerk organization through the Backend API, with `createdBy` set to the user, so the user becomes `org:admin`. It then sets that organization active on the session.
3. The server calls the `create_clinic_for_active_org(name)` RPC with the user's JWT. This SECURITY DEFINER function checks that:
   - `o.id` is present;
   - `o.rol` is `admin`;
   - no clinic exists yet for that organization.
   It then creates the clinic, the owner membership, and the trial entitlement in one transaction.

### 4.3 Team invitation

1. An owner or admin invites someone by email and role.
2. The server action checks the permission and the role-assignment rules: admins can invite only staff or viewers.
3. It creates the Clerk organization invitation through the Backend API, with `publicMetadata.invitation_id`.
4. It records `clinic_invitations` through the `create_invitation` RPC.
5. The invitee accepts in Clerk, which creates the membership. Membership reconciliation then runs, either from the `organizationMembership.created` Clerk webhook or lazily on the invitee's first dashboard visit.
6. Reconciliation looks up the membership through the Clerk Backend API, matches the pending invitation, and inserts `clinic_members` with the invited role.

### 4.4 Billing (pay per period)

The single plan, "ParmarPro Clinic", costs ₹75,000 per month plus 18% GST, so ₹88,500 is charged.

1. The owner clicks "Pay for next month". The Server Action runs `requirePermission('billing:pay')`. The server computes the amount from config; the client never supplies it. The server creates a Razorpay Order (`receipt` = our `billing_orders.id`, `notes.clinic_id`) and stores a `billing_orders` row with status `created`.
2. The browser opens Razorpay Checkout. On success, it posts `{order_id, payment_id, signature}` to `/api/billing/verify`.
3. `/api/billing/verify` authenticates and authorizes the user. It verifies `HMAC_SHA256(order_id + "|" + payment_id, key_secret)` with a timing-safe compare. It then **fetches the payment from Razorpay on the server** and checks:
   - the status is `captured`;
   - the order ID is one of ours and belongs to the user's clinic;
   - the amount and currency are as expected.
   Only then does it call `apply_verified_payment()`.
4. `/api/webhooks/razorpay` verifies `X-Razorpay-Signature` over the raw body and de-duplicates on `x-razorpay-event-id`. For allowlisted events (`payment.captured`, `order.paid`, `payment.failed`), it runs the same reconciliation and the same idempotent apply.
5. `apply_verified_payment()` runs in one transaction. Uniqueness on `payments.provider_payment_id` and a conditional `billing_orders` transition from `created` to `paid` mean a paid period is applied exactly once, even if the verify route and the webhook race.

### 4.5 Errors and analytics

- **Sentry.** The SDK runs with `sendDefaultPii: false`. `beforeSend` and `beforeBreadcrumb` remove request bodies, cookies, headers, query strings, emails, phone numbers, and token-like strings. Session Replay is off.
- **PostHog.**
  - Autocapture, session recording, and automatic pageviews are disabled.
  - Events go through a typed allowlist (`src/lib/analytics/events.ts`) that accepts only enums, counts, and opaque IDs.
  - Dashboard URLs are reduced to route templates, so `/dashboard/leads/[id]` is sent instead of the real ID.

## 5. Environments

| Environment | Clerk | Supabase | Razorpay | Vercel |
|---|---|---|---|---|
| Local / CI | ParmarPro development instance; tests use a local Supabase/Postgres stack with locally minted JWTs | Local stack (`supabase start`, or Postgres plus PostgREST in the dev container) | Mocked API; signature logic tested with test secrets | — |
| Staging | ParmarPro development instance | `parmarpro-staging` project | Test mode | Preview environment of the `parmarpro` project |
| Production | ParmarPro production instance (G7) | Separate production project (G7) | Live mode (G7) | Production environment |

Secrets are scoped per environment in Vercel. Production secrets are never placed in Preview or Development.

## 6. Key source locations

- `src/proxy.ts`: Clerk middleware; redirects only.
- `src/server/auth/`: auth context, permission matrix, typed errors.
- `src/server/db/user-client.ts`: user-scoped Supabase client using the Clerk JWT.
- `src/server/privileged/`: the only module allowed to use the Supabase secret key.
- `src/server/dal/`: data-access functions. Each one authorizes, validates, and queries.
- `src/server/billing/`: the provider interface, the Razorpay implementation, plans, and webhook processing.
- `supabase/migrations/`: schema, RLS, grants, triggers, RPCs.
- `tests/`: unit, database (RLS), integration (DAL → PostgREST → RLS), and end-to-end tests.

## 7. Implementation notes

- **Content Security Policy.** `clerkMiddleware` in `src/proxy.ts` sets a strict CSP with a per-request nonce and `'strict-dynamic'`. Extra origins are allowed only for Razorpay Checkout. Other headers come from `next.config.ts`: HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy and COOP.
- **Same-origin telemetry proxies.** PostHog traffic goes through `/ingest/*`, a rewrite in `next.config.ts`. Sentry events go through `/monitoring` (`tunnelRoute`). As a result the CSP `connect-src` needs no analytics origins, and ad blockers do not silently drop error reports. Both payloads are scrubbed in the browser before sending.
- **Organization selection.** The Clerk application forces an active organization. A signed-in user without one is sent to `/onboarding`. The database denies everything when the `o.id` claim is missing (TI-12).
- **`my_membership()`** runs as `SECURITY INVOKER`. It needs no elevated rights because RLS already limits `clinic_members` to the caller's own active clinic.
- **Local test stack.** `scripts/local-db/start.sh` runs `supabase/postgres` and PostgREST in Docker and applies every migration. It writes `.env.test.local`, which contains a JWT secret generated for that run. Tests mint Clerk-shaped tokens with that secret, so the RLS tests use the same policies, grants and roles as the Supabase platform. CI uses the same script.
- **Generated types.** `scripts/gen-db-types.mjs` introspects the local database. CI fails if `src/server/db/database.types.ts` differs from the migrations.
