# ParmarPro — Security Plan

Written at gate G0. It defines the roles, the permissions, the release criteria, and the security tests, all before implementation. `docs/security-test-results.md` records the results that are actually observed.

## 1. Roles

| Role | Clerk role | Intent |
|---|---|---|
| `owner` | `org:admin` | Full control of the clinic, including team management |
| `admin` | `org:member` | Runs clinic operations and manages staff and viewers. Cannot touch owners or other admins, and cannot pay |
| `staff` | `org:member` | Day-to-day operations: create and update leads, patients, appointments, tasks |
| `viewer` | `org:member` | Read-only access to operational records |

## 2. Permission matrix

The canonical implementation is `src/server/auth/permissions.ts`. Unit tests cover every cell. The database enforces the same rules independently.

| Permission | owner | admin | staff | viewer |
|---|:-:|:-:|:-:|:-:|
| `dashboard:read`, `lead:read`, `patient:read`, `appointment:read`, `task:read`, `activity:read`, `team:read`, `clinic:read` | ✅ | ✅ | ✅ | ✅ |
| `lead:create`, `lead:update` | ✅ | ✅ | ✅ | ❌ |
| `patient:create`, `patient:update` | ✅ | ✅ | ✅ | ❌ |
| `appointment:create`, `appointment:update` (reschedule, cancel, status) | ✅ | ✅ | ✅ | ❌ |
| `task:create`, `task:update` (assign, complete) | ✅ | ✅ | ✅ | ❌ |
| `lead:delete`, `patient:archive`, `appointment:delete`, `task:delete` | ✅ | ✅ | ❌ | ❌ |
| `clinic:update` (name, settings) | ✅ | ✅ | ❌ | ❌ |
| `team:invite`, `team:change_role`, `team:remove` | ✅ | ✅ (staff and viewer targets only) | ❌ | ❌ |

**Role-assignment rules**, enforced in both the RPCs and the server:

- Nobody can change their own role or remove themselves through these operations.
- An owner may assign `admin`, `staff`, or `viewer`. Owner transfer is out of scope for the MVP.
- An admin may assign only `staff` or `viewer`, and may only act on members who are currently staff or viewers.
- The last active owner can never be demoted or removed.


## 3. Release criteria (per gate)

- **G1:**
  - every Server Action and Route Handler begins with `requirePermission`, or is a signature-verified webhook or the public contact endpoint;
  - unit tests prove 401 or 403 for no session, no organization, a non-member, and an insufficient role.
- **G2 (hard blocker):**
  - every table has RLS enabled and explicit grants;
  - the whole tenant matrix (section 4) passes against real PostgreSQL with the actual migrations, through both SQL-level and DAL → PostgREST tests;
  - the Supabase security advisors show no errors (staging).
- **G3:** core journeys work against the database; authorization is enforced on every operation; no fabricated metrics.
- **G4:**
  - telemetry scrubber tests pass;
  - integrations either verified in staging or explicitly marked "awaiting credentials".
- **G5:**
  - lint, typecheck, unit, DB, integration, E2E, build, audit, and secret-scan results are recorded;
  - no unresolved critical or high findings;
  - medium findings fixed, or mitigated with documentation.
- **G6:** the 16-step staging flow is executed and recorded.
- **G7:** explicit human approval before production.

## 4. Tenant-isolation test matrix

Fixtures: **Clinic A** and **Clinic B**, each with an owner, an admin, a staff member, and a viewer, plus a signed-in user with no organization and an anonymous caller. Every row runs at the SQL level (`set role authenticated` plus `request.jwt.claims`) and, where a DAL function exists, through DAL → PostgREST.

| ID | Case | Expected |
|---|---|---|
| TI-01 | A-staff lists patients, leads, appointments, tasks, members, activity | Only Clinic A rows |
| TI-02 | A-staff selects a B record by its exact ID | 0 rows (not an error that leaks existence) |
| TI-03 | A-staff inserts a lead with `clinic_id = B` | Rejected by RLS |
| TI-04 | A-staff updates or deletes a B record by ID | 0 rows affected |
| TI-05 | A-staff updates own record, setting `clinic_id = B` | Rejected (column grant / trigger) |
| TI-06 | A-staff links an A lead to a B patient or a B member (assignee) | Rejected by the composite foreign key |
| TI-07 | A-viewer inserts, updates, or deletes any operational record | Rejected |
| TI-08 | A-staff calls `change_member_role` on self → owner, or updates `clinic_members` directly | Rejected |
| TI-09 | A-admin changes the A-owner's role, or removes the A-owner | Rejected |
| TI-10 | A-owner demotes or removes self as the last owner | Rejected |
| TI-11 | Dashboard aggregates or views for A-staff | Count only Clinic A rows |
| TI-12 | JWT without `o` (no active organization) | Sees nothing; writes rejected |
| TI-13 | JWT with `o.id = A` but `sub` has no membership row in A | Sees nothing |
| TI-14 | JWT with `o.id = B` for a user who is a member of A only (forged or mismatched claim) | Sees nothing |
| TI-15 | Membership row deactivated while the JWT still carries `o.id = A` | Sees nothing |
| TI-16 | Anonymous role selects from every table | Nothing / permission denied |
| TI-17 | Payment tables and functions | Not present in the database (removed 30 October 2026) |
| TI-21 | `activity_events`: an authenticated user inserts, updates, or deletes | Rejected |
| TI-22 | Anonymous inserts into `contact_requests` and selects it back | Insert OK; select denied |
| TI-23 | Staff of A calls `create_clinic_for_active_org` for an org where they are `org:member`, or for an org that already has a clinic | Rejected |
| TI-24 | After switching the active org from A to B (user is a member of both), the user sees only B | Only B rows |

## 5. OWASP Top 10:2025 mapping

| OWASP 2025 | Controls |
|---|---|
| A01 Broken Access Control | Permission matrix, `requirePermission`, RLS, column grants, composite foreign keys, RPC role rules, tenant matrix tests |
| A02 Security Misconfiguration | Explicit revokes over Supabase default grants; security headers and CSP; Vercel environment scoping; preview deployment protection; no debug routes |
| A03 Software Supply Chain Failures | Lockfile, minimal dependencies, Dependabot, `pnpm audit`, pinned Action SHAs, CodeQL, gitleaks |
| A04 Cryptographic Failures | TLS everywhere (HSTS); HMAC-SHA256 with timing-safe comparison; no custom crypto; secrets only in managed stores |
| A05 Injection | Parameterized queries, escaped `ilike`, no user input in `.or()` strings, Zod validation, no `eval` or shell |
| A06 Insecure Design | Threat model at G0; least data collected |
| A07 Authentication Failures | Clerk (MFA available, bot protection, session management); server-side session verification on every request |
| A08 Software or Data Integrity Failures | Webhook signature verification; idempotent processing; activity log that cannot be changed |
| A09 Security Logging & Alerting Failures | Sentry with scrubbing; `webhook_events` status; activity events; incident runbook |
| A10 Mishandling of Exceptional Conditions | Typed errors mapped to 401/403/404/422; fail-closed authorization; error boundaries |

## 6. AI-generated code review checklist

The reviewer reads the actual source and test output and looks for:

- authorization missing from any action or handler;
- insecure direct object references (IDOR);
- `NEXT_PUBLIC_` secrets or environment variables leaked into the client bundle;
- privileged Supabase client imported outside `src/server/privileged/`;
- tables without RLS, permissive policies, or leftover default grants;
- webhook acceptance without a signature check;
- debug routes or test bypasses;
- PII in Sentry, PostHog, or logs;
- unvalidated input;
- over-broad `select('*')` returning fields a role should not see.

## 7. Severity policy

- **Critical or high:** blocks production.
- **Medium:** fix before release, or document a mitigation the owner specifically approves.
- **Low:** record with a follow-up action and an owner.
- **False positive:** record the written evidence.
- Security tests are never deleted or skipped to get a green build.
