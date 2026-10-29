/**
 * Integration: the public enquiry lookups and the website lead insert against
 * the local database (service role -> PostgREST -> PostgreSQL). The lookup must
 * say "no clinic" for every case that is not a live form, and the insert must
 * record where the lead came from.
 */
import { randomBytes } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { admin, closePool, createClinicFixture, deleteClinicFixture, type ClinicFixture } from "../helpers/db";
import { mintToken } from "../helpers/jwt";
import { startRestProxy } from "../helpers/rest-proxy";

const CONSENT_NOTE = "Website enquiry form: the enquirer agreed to be contacted about this enquiry.";

let A: ClinicFixture;
let UNPAID: ClinicFixture;
let proxy: Awaited<ReturnType<typeof startRestProxy>>;
let enquiry: typeof import("@/server/privileged/enquiry");

const newKey = () => randomBytes(32).toString("hex");
const tag = () => randomBytes(6).toString("hex");

beforeAll(async () => {
  proxy = await startRestProxy();
  process.env.SUPABASE_URL = proxy.url;
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_local_integration_tests";
  // Locally minted service_role token stands in for the Supabase secret key.
  process.env.SUPABASE_SECRET_KEY = await mintToken({ role: "service_role" }, { expiresIn: "1h" });
  enquiry = await import("@/server/privileged/enquiry");
  A = await createClinicFixture("Enquiry");
  UNPAID = await createClinicFixture("EnquiryUnpaid", { entitled: false });
});

afterAll(async () => {
  await deleteClinicFixture(UNPAID);
  await deleteClinicFixture(A);
  await closePool();
  await proxy.close();
});

/** Sets the clinic's enquiry key and switch, as the settings page does. */
async function setForm(clinicId: string, key: string, enabled: boolean) {
  await admin("update public.clinic_automation_settings set enquiry_form_key = $2, enquiry_form_enabled = $3 where clinic_id = $1", [
    clinicId,
    key,
    enabled,
  ]);
}

describe("finding the clinic behind an enquiry key", () => {
  it("returns the clinic when the form is on, the key matches and the clinic is in its trial", async () => {
    const key = newKey();
    await setForm(A.id, key, true);
    await expect(enquiry.findEnquiryClinic(key)).resolves.toEqual({ clinicId: A.id, clinicName: "Synthetic Clinic Enquiry" });
  });

  it("returns null when the form is switched off, even with the right key", async () => {
    const key = newKey();
    await setForm(A.id, key, false);
    await expect(enquiry.findEnquiryClinic(key)).resolves.toBeNull();
    await setForm(A.id, key, true);
  });

  it("returns null for a key that matches no clinic, and for a malformed key", async () => {
    await expect(enquiry.findEnquiryClinic(newKey())).resolves.toBeNull();
    await expect(enquiry.findEnquiryClinic("not-a-key")).resolves.toBeNull();
    await expect(enquiry.findEnquiryClinic(newKey().toUpperCase())).resolves.toBeNull();
  });

  it("returns null when the clinic has no running trial or paid period", async () => {
    const key = newKey();
    await setForm(UNPAID.id, key, true);
    await expect(enquiry.findEnquiryClinic(key)).resolves.toBeNull();
  });

  it("returns null when the clinic is archived", async () => {
    const key = newKey();
    await setForm(A.id, key, true);
    await admin("update public.clinics set archived_at = now() where id = $1", [A.id]);
    try {
      await expect(enquiry.findEnquiryClinic(key)).resolves.toBeNull();
    } finally {
      await admin("update public.clinics set archived_at = null where id = $1", [A.id]);
    }
  });
});

describe("recording a website enquiry", () => {
  it("stores a new website lead for the clinic, created by the system, with the consent note", async () => {
    const leadId = await enquiry.createWebsiteLead({
      clinicId: A.id,
      fullName: `Synthetic Enquirer ${tag()}`,
      phone: "+919800000077",
      email: `enquirer.${tag()}@example.test`,
      message: "Synthetic question about cleaning",
    });
    const { rows } = await admin<{
      clinic_id: string;
      source: string;
      status: string;
      created_by: string;
      notes: string;
      phone_e164: string;
    }>("select clinic_id, source, status, created_by, notes, phone_e164 from public.leads where id = $1", [leadId]);
    expect(rows[0]).toMatchObject({
      clinic_id: A.id,
      source: "website",
      status: "new",
      created_by: "system",
      phone_e164: "+919800000077",
      notes: `Synthetic question about cleaning\n\n${CONSENT_NOTE}`,
    });
  });

  it("stores only the consent note when the enquiry has no message", async () => {
    const leadId = await enquiry.createWebsiteLead({
      clinicId: A.id,
      fullName: `Synthetic Enquirer ${tag()}`,
      phone: null,
      email: `enquirer.${tag()}@example.test`,
      message: null,
    });
    const { rows } = await admin<{ notes: string }>("select notes from public.leads where id = $1", [leadId]);
    expect(rows[0]?.notes).toBe(CONSENT_NOTE);
  });

  it("counts the clinic's website leads, and no leads from other sources", async () => {
    const before = await enquiry.websiteEnquiriesToday(A.id);
    await enquiry.createWebsiteLead({ clinicId: A.id, fullName: `Synthetic Enquirer ${tag()}`, phone: "+919800000078", email: null, message: null });
    expect(await enquiry.websiteEnquiriesToday(A.id)).toBe(before + 1);

    // The audit trigger fixes created_at to now(), so earlier days cannot be seeded here; the IST day window is unit-tested in ist.test.ts.
    await admin("insert into public.leads (clinic_id, full_name, source) values ($1, $2, 'whatsapp')", [A.id, `Synthetic WhatsApp ${tag()}`]);
    expect(await enquiry.websiteEnquiriesToday(A.id)).toBe(before + 1);
  });
});
