# Automations and scheduled jobs

ParmarPro sends a few emails and creates some follow-up tasks without anyone pressing a button. This page lists each automation: what it does, when it runs, where it runs, who receives it, and how to switch it off. It also covers how the scheduler is set up, how to test a job without sending anything, and the owner setup checklist.

All times are India Standard Time (IST, UTC+05:30). Cron expressions in the repository are written in UTC.

## Privacy rules

These rules apply to every automation.

- **Staff summaries contain counts only.** The morning digest and the weekly summary never name a patient, a lead or a colleague.
- **Patient emails need consent.** A reminder goes only to a patient who has agreed to email contact and has not opted out. It carries the patient's first name, the clinic name and the appointment time. It contains no clinical information, and it always includes a "Stop appointment emails" link.
- **Links are signed and expire.** Each stop or action link is signed with `LINK_SIGNING_SECRET`. The digest link expires after 60 days, the patient opt-out link after 14 days, and the founder's enquiry link after 30 days. An expired link shows the same "invalid or has expired" message as a forged one.
- **Sending is capped.** See [Limits](#limits).

## At a glance

| Automation | When (IST) | Runs in | Who receives it | How a clinic switches it off |
|---|---|---|---|---|
| Morning digest | 08:00 daily | App job `staff-digest` (pg_cron) | Each active owner, admin and staff member who has not opted out | Settings: *Morning digest* |
| Weekly owner summary | Monday 09:15 | App job `weekly-summary` (pg_cron) | Active clinic owners | Settings: *Weekly owner summary* |
| Follow-up task for untouched inquiries | 07:30 daily | SQL function (pg_cron) | Creates a task in the clinic's task list | Settings: *Follow-up task for untouched inquiries* |
| Call-back task after a missed appointment | Instant (on no-show) | Database trigger | Creates a task due 10:00 the next day | Settings: *Call-back task after a missed appointment* |
| Recall tasks | 07:35 daily | SQL function (pg_cron) | Creates recall tasks in the task list | Settings: *Recall patients* (off by default) |
| Round-robin assignment | Instant (on new inquiry) | Database trigger | Assigns new unassigned inquiries in turn | Settings: *Share new inquiries in turn* (off by default) |
| Appointment reminder email | 10:00 daily (for the next day) | App job `patient-reminders` (pg_cron) | Patients who agreed to email contact | Settings: *Appointment reminder email* (off by default) |
| Website enquiry form | Instant (on submit) | App action | Creates a lead; sends no email | Settings: *Accept enquiries through the form* (off by default) |
| Trial and renewal notices | 09:00 daily | App job `trial-renewal` (pg_cron) | Active clinic owners | Not switchable: account notices |
| Welcome email and payment receipts | Instant | App, after onboarding or payment | The clinic's owner or owners | Not switchable: account and billing notices |
| Founder alerts and digest | Instant, and 09:30 daily | App, and job `founder-digest` | ParmarPro's founder, not clinics | Unset `FOUNDER_ALERT_EMAIL` |
| Payment reconciliation | Every 15 minutes | App job `reconcile-payments` (pg_cron) | No email: checks unpaid orders with Razorpay | Not switchable |
| Invitation expiry | 01:30 daily | App job `expire-invitations` (pg_cron) | No email: revokes stale invitations | Not switchable |
| Retention cleanup | Monday 02:30 | SQL function (pg_cron) | No email: deletes old records | Not switchable |

## Clinic automations

Everyone in the clinic can see these settings at **Dashboard → Settings → Automations** (`/dashboard/settings/automations`). Only owners and admins can change them.

### Morning digest

- **What:** for each member, the number of open tasks due today, overdue tasks, follow-ups due today and overdue, and today's appointments. Owners and admins also see unassigned open tasks and unassigned follow-ups. A digest with every count at zero is not sent.
- **When:** 08:00 IST, every day.
- **Where:** pg_cron calls `POST /api/jobs/staff-digest`.
- **Who:** each active owner, admin and staff member who has not opted out.
- **Stop:** an owner turns off *Morning digest* for the clinic. A member turns off *Send me the morning summary* on the same page, or uses the "Stop these emails" link in the email, which opens a page with a *Stop daily summary emails* button.

### Weekly owner summary

- **What:** counts for the previous week, Monday to Sunday (IST): new leads, leads converted, appointments, tasks completed, overdue tasks now, follow-ups due now, and patients on record.
- **When:** Monday 09:15 IST.
- **Where:** pg_cron calls `POST /api/jobs/weekly-summary`.
- **Who:** active clinic owners.
- **Stop:** an owner turns off *Weekly owner summary* for the clinic. The email has no personal stop link.

### Follow-up task for untouched inquiries

- **What:** one task, "Follow up new inquiry", for each lead that is still *New*, has no follow-up time, and is older than the chosen number of hours (12 to 168, default 48). A lead gets this task once, ever.
- **When:** 07:30 IST, every day.
- **Where:** the SQL function `private.job_untouched_lead_tasks()`, run by pg_cron.
- **Who:** the task goes to the lead's assignee if that person is still active. Otherwise it is unassigned.
- **Stop:** turn off *Follow-up task for untouched inquiries*, or change the hours under it.

### Call-back task after a missed appointment

- **What:** when an appointment is marked *no-show*, a task "Call back after missed appointment" is created, due at 10:00 IST the next day.
- **When:** instantly, through a database trigger.
- **Who:** the appointment's assignee if still active, otherwise unassigned.
- **Stop:** turn off *Call-back task after a missed appointment*.

### Recall tasks

- **What:** a task "Recall due: invite for a check-up" for patients whose last completed visit is older than the chosen number of months (1 to 24, default 6). Patients with a booked future appointment, patients who have opted out, and archived patients are skipped. Oldest visit first, at most 20 per clinic per run.
- **When:** 07:35 IST, every day.
- **Where:** the SQL function `private.job_recall_tasks()`, run by pg_cron.
- **Stop:** *Recall patients* (off by default).

### Round-robin assignment of new inquiries

- **What:** a new lead with no assignee goes to the next active owner, admin or staff member, in turn.
- **When:** instantly, through a database trigger on insert.
- **Stop:** *Share new inquiries in turn* (off by default).

### Appointment reminder emails

- **What:** an email to each patient with a *scheduled* or *confirmed* appointment on the next IST day, when the patient has an email address, has agreed to email contact, has not opted out and is not archived. Subject: "Reminder: your appointment at *clinic name*". The body gives the first name, the clinic, the date and time, and asks the patient to contact the clinic to change it.
- **When:** 10:00 IST, every day.
- **Where:** pg_cron calls `POST /api/jobs/patient-reminders`.
- **Stop, clinic:** *Appointment reminder email* (off by default).
- **Stop, patient:** the email's "Stop appointment emails" link opens a page with a *Stop appointment reminders* button. Pressing it sets that patient's email consent to *no*.
- **Requirement:** no reminder is sent unless the signed opt-out link can be created (`LINK_SIGNING_SECRET` must be set), because every reminder must carry one.

### Website enquiry form

- **What:** a public form at `/enquire/<key>`. Once the clinic turns it on, the link appears under *Accept enquiries through the form*. Each submission creates a lead. This path sends no email.
- **Limit:** 50 submissions per clinic per IST day. Further submissions see a "busy" message.
- **Stop:** turn off *Accept enquiries through the form*. Creating a new link also stops the old one at once.

### Trial and renewal notices

- **What, to clinic owners, once per period:**
  - trial reminder, 3 to 7 days before the trial ends;
  - trial ending, 0 to 2 days before;
  - trial ended, within 3 days after;
  - renewal reminder, 2 to 5 days before the paid period ends;
  - renewal due, 0 to 1 day before;
  - access lapsed, within 3 days after.
- **When:** 09:00 IST, every day.
- **Where:** pg_cron calls `POST /api/jobs/trial-renewal`.
- **Stop:** not switchable. These are account notices.

### Welcome email and payment receipts

- **Welcome:** sent once, after a clinic is set up, to the person who set it up. It is sent only when a trial end date exists.
- **Receipt:** sent after a payment is confirmed, to each active owner with an email address.
- **Stop:** not switchable. These are account and billing notices.

## Founder alerts and digest

These go to ParmarPro's operator, not to clinics.

- **Alert:** each enquiry sent through the marketing contact form at `/contact` sends the founder an alert. If the enquirer gave an email address, they also get an auto-reply: "Thanks for contacting ParmarPro". Auto-replies are capped at 50 per IST day. Founder alerts do not count against that cap.
- **Digest:** 09:30 IST, every day, to `FOUNDER_ALERT_EMAIL`. It lists enquiries received in the last 24 hours, enquiries whose follow-up time has passed, and unanswered enquiries from 1 to 14 days ago. On Mondays it also gives the previous week's platform counts. Every digest has an *Operations (last 24 hours)* section of counts only: job runs, failed or missing jobs, email failures, failed webhooks, unpaid orders and AI calls. A day with no enquiries gets a digest only when one of those counts needs attention. The *Suggested focus (AI)* line is written from those counts alone by the free Gemini key (`GEMINI_FREE_API_KEY`). It is left out when that key is not set or no model answers, and a dry run never asks for it.
- The clinic website form (`/enquire/<key>`) does not send founder alerts.
- **Stop:** unset `FOUNDER_ALERT_EMAIL` in Vercel. Without it, no founder email is sent.

## Platform jobs

These run without any clinic setting.

- **Payment reconciliation** (every 15 minutes, `POST /api/jobs/reconcile-payments`). Checks unpaid orders against Razorpay, so a payment whose callback or webhook never arrived still grants access. An order that stays unpaid for 48 hours expires. An authorised payment that is never captured is expired after 7 days.
- **Invitation expiry** (01:30 IST, `POST /api/jobs/expire-invitations`). An invitation not accepted within 7 days is revoked in Clerk and marked expired.
- **Retention cleanup** (Monday 02:30 IST, the SQL function `private.job_cleanup()`). Deletes webhook records after 90 days, contact-form enquiries after 12 months, the email send log after 180 days, and the activity history after 24 months.

## Scheduled checks (GitHub Actions)

- **Backup** (03:00 IST, `.github/workflows/backup.yml`). Dumps the `public` and `private` schemas, restores the dump into an empty PostgreSQL 17 container to prove it can be read, encrypts it with age, and uploads the encrypted file as a workflow artifact kept for 7 days. It runs only when `SUPABASE_DB_URL` and `BACKUP_AGE_RECIPIENT` are set. Otherwise it prints a notice and takes no backup. This supplements Supabase's own backups and point-in-time recovery; it does not replace them. See [backup and recovery](backup-and-recovery.md).
- **Nightly E2E** (03:30 IST, `.github/workflows/nightly-e2e.yml`). Runs the Playwright suite against the staging deployment. It runs only when `STAGING_URL` is set. The authenticated journey stays skipped there, because the Clerk test secrets are not passed to that workflow.
- **Lighthouse** (after each successful preview deployment, `.github/workflows/lighthouse.yml`). Measures `/` and `/pricing` on mobile emulation, three runs each, and uploads the reports. It is report-only: it never fails and never runs for the Production environment. Lighthouse copies the bypass header into every report, so the workflow removes the secret from the reports before uploading them and uploads nothing if a copy remains.
- **Bypass secret and test reports.** Playwright traces record request headers, so when `VERCEL_AUTOMATION_BYPASS_SECRET` is set (the nightly run), traces are off and a failed test keeps a screenshot instead. The uploaded report never contains the secret.

## Limits

| Limit | Value | Notes |
|---|---|---|
| Emails per IST day, all automations | 90 | `EMAIL_DAILY_BUDGET`. Once used up, further emails that day are skipped. |
| Enquiry auto-replies per IST day | 50 | `AUTO_REPLY_DAILY_CAP`. Founder alerts do not count. |
| Website enquiries per clinic per IST day | 50 | `WEBSITE_DAILY_CAP`. Further submissions see a "busy" message. |
| Resend free tier | 100 emails a day, 3,000 a month | Plan limits at the time of writing. Check Resend's pricing page before launch. |

## Testing a job safely

Every job endpoint accepts `?dryRun=1`. A dry run reads the data and reports what would happen. It sends no email, records no send, and revokes no invitation.

```bash
curl -X POST -H "Authorization: Bearer <CRON_SECRET>" "https://<app>/api/jobs/staff-digest?dryRun=1"
```

Replace `<app>` with the environment's address, and `<CRON_SECRET>` with that environment's secret. Type the secret in; never paste it into chat, an issue or a commit. The response has the form `{"job":"staff-digest","ok":true,"dryRun":true,"result":{...}}`, where the result counts each outcome.

Other checks:

- A request without the bearer token gets `401`. The endpoint only accepts `POST`, so `GET` gets `405`.
- A **real** run is not a dry run. `select private.call_job('staff-digest');` in the Supabase SQL editor sends the real emails for that job. Dry-run first.

## Checking the scheduler

List the schedules. There should be ten rows.

```sql
select jobname, schedule, command from cron.job where jobname like 'parmarpro\_%' order by jobname;
```

Check whether each run happened, and what the app answered:

```sql
select * from cron.job_run_details order by start_time desc limit 20;
select * from net._http_response order by created desc limit 20;
```

`cron.job_run_details` shows whether pg_cron ran each command and whether the command failed. `net._http_response` shows the HTTP status and the response body of each app job call. Check both: a call can succeed in pg_cron and still fail in the app.

The setup itself is in [`supabase/ops/schedules.sql`](../supabase/ops/schedules.sql). Its header explains the Vault secrets and how to re-run it.

## Deferred: fully automatic WhatsApp

Fully automatic WhatsApp messages are not built. They need Meta business verification, and each message costs about ₹0.115 in India. Instead, the lead and appointment screens show an **Open WhatsApp** link. It opens a chat with a prefilled message, and staff send it themselves.

## Owner setup checklist

Do these once per environment, in this order where it matters.

- [ ] **Resend:** create an account, verify your sending domain by adding the DNS records Resend shows, and create an API key.
- [ ] **Secrets:** generate `CRON_SECRET` and `LINK_SIGNING_SECRET` with `openssl rand -hex 32`. Run the command twice, once for each. Keep each value only in Vercel and in the Vault secret described below.
- [ ] **Vercel:** add `RESEND_API_KEY`, `EMAIL_FROM`, `FOUNDER_ALERT_EMAIL`, `CRON_SECRET` and `LINK_SIGNING_SECRET`. Start with the Preview scope, mark each one Sensitive, and redeploy. See [environment variables](environment-variables.md).
- [ ] **Supabase Vault and schedules:** create the Vault secrets (`parmarpro_app_url`, `parmarpro_cron_secret`, and optionally `parmarpro_vercel_bypass`) and run `supabase/ops/schedules.sql` in the SQL editor. The header of that file has the exact statements, with placeholders.
- [ ] **Uptime monitoring:** create two free UptimeRobot HTTP monitors, for the home page and for `/api/health`. Check every 5 minutes, with email alerts on.
- [ ] **GitHub secrets for backup:** `SUPABASE_DB_URL` (the session pooler connection string) and `BACKUP_AGE_RECIPIENT` (an age public key). Keep the matching private key offline, with the owner. Never store it in GitHub, Vercel or the repository.
- [ ] **GitHub secrets for nightly E2E:** `STAGING_URL`, and `VERCEL_AUTOMATION_BYPASS_SECRET` from Vercel → Settings → Deployment Protection → *Protection Bypass for Automation*. The same bypass secret also lets Lighthouse measure protected previews.
- [ ] **Dependabot:** turn on Dependabot alerts in GitHub under Settings → Code security.
- [ ] **Sentry:** set `NEXT_PUBLIC_SENTRY_DSN` for each environment.
- [ ] **Default branch:** scheduled workflows (backup and nightly E2E) run only from the default branch. They start running after this work is merged to `main`. Lighthouse is different: GitHub runs it from the deployed commit, so it already runs for previews of any branch that contains `lighthouse.yml`.
