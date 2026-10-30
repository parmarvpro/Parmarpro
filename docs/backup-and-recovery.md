# Backup and recovery

> **Status: NOT PROVEN.** No restore test has been performed yet. Do not describe backups as verified until §4 has been completed successfully and recorded below.

## 1. What needs backing up

| Data | Where | Backup mechanism |
|---|---|---|
| Clinic records, memberships, billing records, audit trail | Supabase PostgreSQL | Supabase automated backups (and PITR on paid plans) |
| Identity (users, organizations, MFA) | Clerk | Managed by Clerk. ParmarPro stores only Clerk IDs |
| Payments (source of truth) | Razorpay | Managed by Razorpay. `billing_orders` and `payments` can be reconciled from the Razorpay dashboard and API |
| Schema | `supabase/migrations/*.sql` in Git | Git history on GitHub |
| Application | Git, plus Vercel deployments | Instant rollback in Vercel |
| Secrets | Vercel and GitHub encrypted variables | Not backed up. Regenerate from each provider if lost |

## 2. Supabase backup options

- **Free plan** (current staging project): daily backups are limited, with no point-in-time recovery. Treat staging as disposable; it holds synthetic data only.
- **Production:** use a paid plan with **daily backups** and preferably the **Point-in-Time Recovery** add-on. Check the current retention for the chosen plan in the Supabase dashboard (Database → Backups) and record it here:
  - Plan: ________
  - Daily backup retention: ________
  - PITR window: ________
- Extra, off until you turn it on: `.github/workflows/backup.yml` takes a nightly logical export (`pg_dump` of the `public` and `private` schemas) at 03:00 IST. It restores the dump into an empty PostgreSQL 17 container and prints row counts, to show the file can be read. Then it encrypts the dump with age and keeps the encrypted file as a GitHub workflow artifact for 7 days. It runs only once the repository secrets `SUPABASE_DB_URL` and `BACKUP_AGE_RECIPIENT` are set, and only from the default branch. The dumps contain patient contact data. They are encrypted before they leave the runner, and the age private key must stay offline, with the owner. The nightly restore check does **not** replace the restore test in §4: it proves that the dump can be read, not that the application works on the restored data.

## 3. Restore procedures

**A. Full-project restore (disaster)**
1. Supabase dashboard → Database → Backups → choose a backup or PITR timestamp → Restore. This replaces the project's data.
2. Verify the migrations list matches `supabase/migrations`.
3. Run the post-restore checks (§4, steps 3–6).
4. Reconcile billing: compare Razorpay payments since the restore point with `payments`. Re-apply verified payments by replaying webhooks from the Razorpay dashboard. Processing is idempotent.

**B. Single-record recovery (operator error)**
1. Restore a backup into a **new, separate** project. Never restore over production for a partial recovery.
2. Extract only the needed rows with read-only SQL.
3. Re-insert them into production through a reviewed SQL script that preserves `clinic_id`.
4. Record the action in the incident log.

## 4. Restore test (must pass before launch)

1. Create a scratch Supabase project.
2. Restore the latest production (or staging) backup into it, using the dashboard or `pg_restore` of a dump.
3. Check that all tables exist, RLS is enabled on every table, and the row counts match the source at backup time.
4. Run the SQL tenant-isolation smoke test (`docs/deployment.md` §2.1) against the restored database.
5. Point a local build at the restored project (`SUPABASE_URL` and keys) and load the dashboard as a synthetic user.
6. Delete the scratch project.

| Date | Backup used | Result | Performed by | Notes |
|---|---|---|---|---|
| — | — | Not yet performed | — | — |

## 5. Known limitations

- Clerk and Razorpay data are outside ParmarPro's backups. Recovery depends on those providers.
- Restoring the database to an earlier point can make it disagree with Clerk (memberships created later) and with Razorpay (payments made later). Steps A4 and lazy membership reconciliation address this, but they need operator attention.
- Backups contain personal data. Access to the Supabase dashboard must be limited to authorized operators with MFA.
