/**
 * Integration: the privileged email helpers against the local database (service
 * role -> PostgREST -> PostgreSQL). These checks cover the writes behind the
 * email links and the lookups the automation emails use.
 */
import { randomBytes, randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { admin, closePool, createClinicFixture, deleteClinicFixture, type ClinicFixture } from "../helpers/db";
import { mintToken } from "../helpers/jwt";
import { startRestProxy } from "../helpers/rest-proxy";

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

let A: ClinicFixture;
let proxy: Awaited<ReturnType<typeof startRestProxy>>;
let email: typeof import("@/server/privileged/email-actions");
const contactIds: string[] = [];

const tag = () => randomBytes(6).toString("hex");

beforeAll(async () => {
  proxy = await startRestProxy();
  process.env.SUPABASE_URL = proxy.url;
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_local_integration_tests";
  // Locally minted service_role token stands in for the Supabase secret key.
  process.env.SUPABASE_SECRET_KEY = await mintToken({ role: "service_role" }, { expiresIn: "1h" });
  email = await import("@/server/privileged/email-actions");
  A = await createClinicFixture("Mail");
});

afterAll(async () => {
  if (contactIds.length > 0) await admin("delete from public.contact_requests where id = any($1::uuid[])", [contactIds]);
  await admin("delete from public.notification_log where subject_key like 'it-mail-%'");
  await deleteClinicFixture(A);
  await closePool();
  await proxy.close();
});

async function insertEnquiry(): Promise<string> {
  const { rows } = await admin<{ id: string }>(
    "insert into public.contact_requests (full_name, clinic_name, email, city) values ($1, $2, $3, $4) returning id",
    [`Synthetic Enquirer ${tag()}`, "Synthetic Clinic", `enquirer.${tag()}@example.test`, "Pune"],
  );
  const id = rows[0]!.id;
  contactIds.push(id);
  return id;
}

describe("patient email opt-out", () => {
  it("stops email for the appointment's patient and returns only the clinic name", async () => {
    await admin("update public.patients set email = $2, email_consent = true, consent_recorded_at = null where id = $1", [
      A.patientId,
      `synthetic.${tag()}@example.test`,
    ]);

    await expect(email.optOutPatientEmails(A.appointmentId)).resolves.toEqual({ clinicName: "Synthetic Clinic Mail" });

    const { rows } = await admin<{ email_consent: boolean; consent_recorded_at: Date | null }>(
      "select email_consent, consent_recorded_at from public.patients where id = $1",
      [A.patientId],
    );
    expect(rows[0]?.email_consent).toBe(false);
    expect(rows[0]?.consent_recorded_at).toBeInstanceOf(Date);
  });

  it("returns null for an unknown or malformed appointment id", async () => {
    await expect(email.optOutPatientEmails(randomUUID())).resolves.toBeNull();
    await expect(email.optOutPatientEmails("not-an-id")).resolves.toBeNull();
  });

  it("names the clinic for an appointment, and nothing for an unknown one", async () => {
    await expect(email.appointmentClinicName(A.appointmentId)).resolves.toBe("Synthetic Clinic Mail");
    await expect(email.appointmentClinicName(randomUUID())).resolves.toBeNull();
  });
});

describe("staff digest opt-out", () => {
  it("turns the digest off for that member only", async () => {
    await expect(email.optOutDigest(A.staff.memberId)).resolves.toBe(true);
    const { rows } = await admin<{ id: string; digest_opt_out: boolean }>(
      "select id, digest_opt_out from public.clinic_members where clinic_id = $1 order by id",
      [A.id],
    );
    const byId = new Map(rows.map((row) => [row.id, row.digest_opt_out]));
    expect(byId.get(A.staff.memberId)).toBe(true);
    expect(byId.get(A.owner.memberId)).toBe(false);
  });

  it("returns false for an unknown member", async () => {
    await expect(email.optOutDigest(randomUUID())).resolves.toBe(false);
  });
});

describe("enquiry actions", () => {
  it("a reminder sets a follow-up three days out and leaves the enquiry unhandled", async () => {
    const id = await insertEnquiry();
    const before = Date.now();
    await expect(email.remindEnquiryLater(id, 3)).resolves.toBe(true);

    const enquiry = await email.getEnquiry(id);
    expect(enquiry?.handled_at).toBeNull();
    const followUp = Date.parse(enquiry?.follow_up_at ?? "");
    expect(followUp).toBeGreaterThanOrEqual(before + 3 * DAY_MS - MINUTE_MS);
    expect(followUp).toBeLessThanOrEqual(Date.now() + 3 * DAY_MS + MINUTE_MS);
  });

  it("marking answered sets handled_at and clears the follow-up", async () => {
    const id = await insertEnquiry();
    await email.remindEnquiryLater(id, 3);
    await expect(email.markEnquiryAnswered(id)).resolves.toBe(true);

    const enquiry = await email.getEnquiry(id);
    expect(enquiry?.handled_at).not.toBeNull();
    expect(enquiry?.follow_up_at).toBeNull();
  });

  it("both return false for an unknown enquiry id", async () => {
    await expect(email.markEnquiryAnswered(randomUUID())).resolves.toBe(false);
    await expect(email.remindEnquiryLater(randomUUID(), 3)).resolves.toBe(false);
  });

  it("getEnquiry returns the enquiry's fields, and null for a malformed id", async () => {
    const id = await insertEnquiry();
    const enquiry = await email.getEnquiry(id);
    expect(enquiry).toMatchObject({ id, clinic_name: "Synthetic Clinic", city: "Pune", handled_at: null, follow_up_at: null });
    expect(enquiry?.email).toMatch(/@example\.test$/);
    await expect(email.getEnquiry("not-an-id")).resolves.toBeNull();
  });
});

describe("clinic facts for the automation emails", () => {
  it("clinicOwnersAndName lists the active owner and the clinic name", async () => {
    await expect(email.clinicOwnersAndName(A.id)).resolves.toEqual({
      clinicName: "Synthetic Clinic Mail",
      ownerUserIds: [A.owner.userId],
    });
  });

  it("clinicOwnersAndName returns null for an unknown clinic", async () => {
    await expect(email.clinicOwnersAndName(randomUUID())).resolves.toBeNull();
  });

  it("autoRepliesSentSince counts the auto-replies logged since the given time", async () => {
    const since = new Date(Date.now() - MINUTE_MS);
    const before = await email.autoRepliesSentSince(since);
    await admin(
      "insert into public.notification_log (kind, clinic_id, subject_key, period_key) values ('enquiry_auto_reply', null, $1, 'once')",
      [`it-mail-${tag()}`],
    );
    await expect(email.autoRepliesSentSince(since)).resolves.toBe(before + 1);
    // A different kind of notification is not counted.
    await admin(
      "insert into public.notification_log (kind, clinic_id, subject_key, period_key) values ('enquiry_alert', null, $1, 'once')",
      [`it-mail-${tag()}`],
    );
    await expect(email.autoRepliesSentSince(since)).resolves.toBe(before + 1);
  });
});
