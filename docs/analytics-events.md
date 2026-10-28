# Product analytics (PostHog): event schema and privacy

**Purpose.** To understand which features clinics use, so the product can be improved. Analytics are never used for advertising, never sold, and never combined with clinic records.

**Where it runs.** Only inside the authenticated app (`/dashboard`, `/onboarding`). Public marketing pages load no analytics at all, so anonymous visitors are not tracked.

**Identity.**
- The person identifier is `sha256("parmarpro-analytics:" + clerkUserId)`, truncated. It is pseudonymous: not an email address and not a name.
- The group is `clinic` = the internal clinic UUID, which is opaque.

## Configuration (`src/components/providers/analytics-provider.tsx`)

| Setting | Value | Why |
|---|---|---|
| `autocapture` | off | Clicks and inputs could contain patient data |
| `capture_pageview` / `capture_pageleave` | off | Replaced by `page_viewed`, which carries only a route template |
| `disable_session_recording` | true | Screen recordings would capture patient data |
| `capture_heatmaps`, `capture_dead_clicks`, `capture_performance`, surveys | off | Not needed |
| `mask_all_text`, `mask_all_element_attributes` | true | Defense in depth |
| `respect_dnt` | true | Honors Do-Not-Track |
| `property_denylist` | `$current_url`, `$pathname`, `$referrer`, … | URLs can contain search terms |
| `before_send` | `sanitizeCapture` | Drops any event not in the schema. Strips URL, referrer and UTM properties, including those inside `$set` and `$set_once` |
| `api_host` | `/ingest`, reverse-proxied to PostHog | Keeps the CSP at `'self'` |

## Events (`src/lib/analytics/events.ts`)

Each schema is a strict Zod object, so unknown properties cause the event to be dropped.

| Event | Properties | When |
|---|---|---|
| `registration_completed` | — | A signed-in user without a clinic first reaches onboarding (once per browser) |
| `onboarding_completed` | — | A clinic workspace was created |
| `clinic_created` | — | Same moment as above. Kept separate for funnels |
| `lead_created` | `source` (enum) | The server action succeeded |
| `patient_created` | — | The server action succeeded |
| `appointment_created` | `appointment_type` (enum), `from_lead` (bool) | The server action succeeded |
| `task_completed` | — | A task was marked done |
| `team_member_invited` | `role` (admin, staff or viewer) | Invitation sent |
| `billing_page_viewed` | — | Billing page opened |
| `checkout_initiated` | `plan` | Razorpay Checkout opened. **This is not a payment** |
| `payment_verified` | `plan` | Sent only after `/api/billing/verify` returns `paid`, meaning the server verified the payment with Razorpay |
| `page_viewed` | `route` (route template such as `/dashboard/leads/[id]`) | On navigation |

Naming convention: `object_action`, in snake_case and past tense.

## Never sent

Patient, lead or staff names, phone numbers, email addresses, notes, free-text input, search terms, record IDs in URLs, tokens, and payment details. Unit tests in `tests/unit/analytics.test.ts` enforce this.

## Consent and opt-out

- In-app product analytics is pseudonymous and limited to the events above.
- Any user can switch it off from the sidebar with **Product analytics: on/off**. This calls `posthog.opt_out_capturing()`, which is stored in that browser.
- Do-Not-Track is respected.
- The privacy notice describes this.
- Before launch, legal review should confirm whether explicit opt-in is required for staff accounts under DPDP rules. If it is, flip the default with `opt_out_capturing_by_default: true`.
