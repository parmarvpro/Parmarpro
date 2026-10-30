# AI features

ParmarPro uses Google's Gemini models for three things. Each is a suggestion that staff check. Nothing is sent to a patient or an enquirer automatically.

| Feature | What it does | Lane | Switched on by |
|---|---|---|---|
| Operations note | Writes up to three plain sentences on the day's operations counts, in the founder digest | Free (`GEMINI_FREE_API_KEY`) | Setting the free key. Counts only, no personal data |
| Enquiry sorting | Suggests the treatment an enquiry is about, how urgent it is, the language and a one-line summary | Paid (`GEMINI_PAID_API_KEY`) | The clinic's *AI help with enquiries* setting, and the paid key |
| Reply drafts | Drafts a short WhatsApp reply to an enquiry, which staff edit and send | Paid (`GEMINI_PAID_API_KEY`) | The same setting and key |

The code is in `src/server/ai/`. The free lane is `free-lane.ts`, the paid lane is `paid-lane.ts`, and the features are in `src/server/ai/features/`. The keys are read through `src/lib/env.ts`.

## Two lanes, and why

Google's terms treat the two kinds of key differently. The terms below were read on 30 October 2026 from the [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms), last updated 28 April 2026.

**Free lane (unpaid quota).** Google's terms say that on Unpaid Services Google uses the content you submit to improve its products and services, and that human reviewers may read it. They say: **"Do not submit sensitive, confidential, or personal information to the Unpaid Services."** The terms have no exception for India. So the free key receives only ParmarPro's own operations counts, which hold no personal data.

**Paid lane (billed quota).** Google does not use prompts or responses on Paid Services to improve its products. It logs them for a limited period, solely to detect and prevent violations of its Prohibited Use Policy and to meet legal or regulatory disclosures. That data may be stored or cached in any country where Google or its agents have facilities, so it may be processed outside India. The paid lane therefore receives enquiry text with contact details removed, and never a name, phone number or email address.

**Clinical use.** The same terms say the Services may not be used **"in clinical practice, to provide medical advice, or in any manner that is overseen by or requires clearance or approval from a medical device regulatory agency."** The paid lane is used for administrative work: sorting enquiries and drafting replies. The drafts are told not to give medical advice, and the reply check refuses medical claims. Sorting does assign an urgency to pain enquiries, though, so before AI help is offered to clinics the owner should have counsel confirm that this use is allowed. See the checklist.

**Retention.** Every request sends `store: false`, which stops Google keeping the interaction as a stored resource. Without it, Google keeps Interactions for 55 days on the paid tier and 1 day on the free tier, according to the [Interactions API documentation](https://ai.google.dev/gemini-api/docs/interactions-overview) of 15 October 2026. The paid terms' separate abuse-detection logging still applies to paid use. The transport sets the flag in `src/server/ai/transport.ts`.

## Models and roles

| Model | Role | Used for |
|---|---|---|
| `gemini-3.8-flash` | Manager | Free: the operations note, tried first. Paid: sorts the worker is unsure of (low confidence or an unclear treatment), and a reply when the worker cannot answer |
| `gemini-3.5-flash-lite` | Worker | Paid: every sort and reply draft, first. Free: the operations note, when the manager cannot answer |
| `gemini-3.1-flash-lite` | Free fallback | Free: the operations note, when the worker cannot answer |

The chains are set in `src/server/ai/models.ts`. Each chain is tried in order. A model that refuses a reservation, is rate limited, returns unusable output or fails hands over to the next.

## What is never sent

- **The free key:** nothing personal. The model input is built key by key from the fixed count names and their numbers.
- **The paid key:** the enquiry text with contact details removed (up to 2,000 characters), the lead source (sorting only), the clinic name, and the label of the treatment the stored triage gives (drafting only).
- **Never on either key:** the lead's or patient's name, phone number or email address; appointments; tasks; staff names; or anything else in the lead record, apart from the enquiry text, the lead source and the treatment label.

**How this is enforced**

- **Redaction.** `src/lib/redact.ts` replaces the lead's own name, phone and email, and any other email address or run of 10 or more digits, with `[name]`, `[phone]` or `[email]`. The same function runs on the text of each enquiry and on the model's own summary before it is stored.
- **Fixed inputs.** Each model input is a JSON object with a fixed set of keys: `{enquiry, source, clinic}` for sorting and `{enquiry, clinic, treatment}` for drafts. Nothing else is added to it.
- **Lane fence.** ESLint's `no-restricted-imports` rules in `eslint.config.mjs` allow only named feature files to import each lane. The operations note may use only the free lane; sorting and drafting may use only the paid lane. Components and shared library code may not import either. `tests/unit/ai-lane-fence.test.ts` checks these rules against the real configuration.
- **Tests.** `tests/unit/ai-enquiry-sort.test.ts` and `tests/unit/ai-reply-draft.test.ts` check exactly what the paid lane receives, including when the contact details appear in the text in other forms.
- **Output checks.** The output is validated against a strict schema. A reply must also pass `src/lib/reply-check.ts`, which refuses prices, discounts, percentages, guarantees, medical claims, medicine names, links, email addresses and phone numbers. A reply that fails is not shown, and the standard message is used instead.
- **No automatic sending.** The draft is returned to the staff member who asked for it, and is never stored. Staff copy it or open it in WhatsApp, edit it and send it themselves.

## Limits

Every call is reserved in `public.ai_calls` before it is sent, and settled afterwards. A reservation counts whatever its outcome. `public.ai_reserve()` (`supabase/migrations/20261030120000_ai.sql`) refuses a call when:

- the model is disabled in `public.ai_model_limits`;
- the requests in the last 60 seconds reach `rpm`, or their tokens reach `tpm` (a reservation's tokens are estimated from its characters until the answer arrives);
- the requests since midnight Pacific reach `rpd`;
- the clinic has made 100 calls since midnight IST (`AI_CLINIC_DAILY_CAP` in `src/server/ai/models.ts`), across all models.

The migration seeds `ai_model_limits` with deliberately **low placeholder** values. Until they are replaced, the app sends few calls and cannot overshoot a quota it does not know. Replace them with the real numbers for each project, read in Google AI Studio for each model and lane:

```sql
update public.ai_model_limits set rpm = <RPM>, tpm = <TPM>, rpd = <RPD>, updated_at = now() where lane = 'free' and model = 'gemini-3.8-flash';
update public.ai_model_limits set rpm = <RPM>, tpm = <TPM>, rpd = <RPD>, updated_at = now() where lane = 'free' and model = 'gemini-3.5-flash-lite';
update public.ai_model_limits set rpm = <RPM>, tpm = <TPM>, rpd = <RPD>, updated_at = now() where lane = 'free' and model = 'gemini-3.1-flash-lite';
update public.ai_model_limits set rpm = <RPM>, tpm = <TPM>, rpd = <RPD>, updated_at = now() where lane = 'paid' and model = 'gemini-3.8-flash';
update public.ai_model_limits set rpm = <RPM>, tpm = <TPM>, rpd = <RPD>, updated_at = now() where lane = 'paid' and model = 'gemini-3.5-flash-lite';
```

## Reading usage

Run this in the Supabase SQL editor to see the last day's calls by lane, model, feature and outcome. It shows counts and token totals only, because `ai_calls` stores no text.

```sql
select lane, model, feature, status, count(*), sum(input_tokens), sum(output_tokens), sum(thought_tokens)
from public.ai_calls
where created_at > now() - interval '1 day'
group by 1,2,3,4
order by 1,2,3,4;
```

## Kill switches

- **Stop the paid lane at once:** `update public.ai_model_limits set enabled = false where lane = 'paid';`. Every paid call is then refused before anything is sent. Use `lane = 'free'` for the free key.
- **Remove the key:** delete `GEMINI_PAID_API_KEY` in Vercel and redeploy. Without the key, nothing is reserved or sent.
- **One clinic:** an owner or administrator turns off *AI help with enquiries* in Settings → Automations.

## Cost estimate

Prices per million tokens, checked on Google's [pricing page](https://ai.google.dev/gemini-api/docs/pricing) on 30 October 2026:

| Model | Input | Output (including thinking tokens) |
|---|---|---|
| `gemini-3.5-flash-lite` | $0.30 | $2.50 |
| `gemini-3.8-flash`, until 31 December 2026 | $0.75 | $3.75 |
| `gemini-3.8-flash`, from 1 January 2027 | $1.50 | $7.50 |

Thinking tokens are billed as output. The free tier is free of charge, within its limits.

**Scenario:** 20 clinics, each with 10 enquiries a day, every one sorted and drafted. That is about 6,000 enquiries a month, or about 11 million input and 2.7 million output worker tokens:

- Worker (`gemini-3.5-flash-lite`): about **$10 a month**.
- Manager (`gemini-3.8-flash`): about **$1.35 a month** until 31 December 2026 (0.9M input tokens at $0.75 plus 0.18M output tokens at $3.75). Both prices double from 1 January 2027, so about **$2.70 a month**.

The real figures come from `ai_calls` (see *Reading usage*). Set a budget alert on the paid project, for example $10 a month, so that a surprise shows up quickly.

## Live smoke test

`tests/smoke/gemini-free.test.ts` sends one operations-note request with the real network and the free key. It prints the status, the model and the token counts, never the text. It is skipped unless the key is set:

```bash
GEMINI_FREE_API_KEY=… pnpm test:ai-smoke
```

It covers the free lane only. Nothing in the repository makes a live call to the paid lane.

## Owner setup checklist

- [ ] **Free key:** create an API key in a Google AI Studio project **without billing**. Store it in Vercel as `GEMINI_FREE_API_KEY` (Sensitive), and redeploy.
- [ ] **Paid key:** create a **separate** project **with billing** and a budget alert (for example $10 a month). Create an API key there and store it in Vercel as `GEMINI_PAID_API_KEY` (Sensitive).
- [ ] **Logs:** in AI Studio → Logs and Datasets, turn logging off for the paid project.
- [ ] **Limits:** read each model's RPM, TPM and RPD for each project in AI Studio, then run the five `update` statements under *Limits*.
- [ ] **Smoke test:** run `GEMINI_FREE_API_KEY=… pnpm test:ai-smoke` and confirm `status=ok`.
- [ ] **Clinical use:** have counsel confirm that sorting enquiries by urgency and drafting replies are not "clinical practice" or "medical advice" under the Gemini API terms, before the paid key is set in production.
- [ ] **Wording:** review the privacy notice (*AI help with enquiries*) and the wording in Settings → Automations and on the lead page.
- [ ] **Clinics:** each clinic turns on *AI help with enquiries* in Settings → Automations. It is off by default.

## Not verified

- **No real Gemini call has been made from this codebase.** The request body has never been sent to Google. The sorting, drafting, limits and storage paths have been tested only with fake transports and the local database. Run the smoke test first, and watch the first real sorts and drafts closely.
- The limits in the database are placeholders until the SQL above is run.
- The prices are those on Google's pricing page on 30 October 2026. Check the page before relying on the cost estimate.
