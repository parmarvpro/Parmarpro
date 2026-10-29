/**
 * Integration: the automation settings DAL against the local database. The real
 * data-access functions run through supabase-js, PostgREST and RLS. Only Clerk's
 * auth() is replaced, with locally minted tokens that carry Clerk-shaped claims.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { admin, claimsFor, closePool, createClinicFixture, deleteClinicFixture, type ClinicFixture, type Persona } from "../helpers/db";
import { mintToken } from "../helpers/jwt";
import { startRestProxy } from "../helpers/rest-proxy";

type Session = { userId: string | null; orgId: string | null; orgRole: string | null; token: string | null };
let current: Session = { userId: null, orgId: null, orgRole: null, token: null };

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({
    userId: current.userId,
    orgId: current.orgId,
    orgRole: current.orgRole,
    getToken: async () => current.token,
  }),
  clerkClient: async () => {
    throw new Error("Clerk Backend API is not available in integration tests");
  },
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T,>(fn: T) => fn,
}));

let A: ClinicFixture;
let B: ClinicFixture;
let proxy: Awaited<ReturnType<typeof startRestProxy>>;
let dal: typeof import("@/server/dal/automations");

async function actAs(persona: Persona | null, orgId?: string) {
  if (!persona) {
    current = { userId: null, orgId: null, orgRole: null, token: null };
    return;
  }
  const org = orgId ?? persona.claims.o?.id ?? null;
  const rol = persona.claims.o?.rol ?? "member";
  current = {
    userId: persona.userId,
    orgId: org,
    orgRole: org ? `org:${rol}` : null,
    token: await mintToken(org ? claimsFor(persona.userId, org, rol) : claimsFor(persona.userId)),
  };
}

beforeAll(async () => {
  proxy = await startRestProxy();
  process.env.SUPABASE_URL = proxy.url;
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_local_integration_tests";
  dal = await import("@/server/dal/automations");
  A = await createClinicFixture("AutoDalA");
  B = await createClinicFixture("AutoDalB");
});

afterAll(async () => {
  await deleteClinicFixture(B);
  await deleteClinicFixture(A);
  await closePool();
  await proxy.close();
});

beforeEach(async () => {
  await actAs(null);
});

async function settingsRow(clinicId: string) {
  const { rows } = await admin<{ untouched_lead_hours: number; recall_tasks: boolean; enquiry_form_key: string | null }>(
    "select untouched_lead_hours, recall_tasks, enquiry_form_key from public.clinic_automation_settings where clinic_id = $1",
    [clinicId],
  );
  return rows[0];
}

describe("changing the clinic's automation settings", () => {
  it("a staff member is refused, and nothing changes", async () => {
    const before = await settingsRow(A.id);
    await actAs(A.staff);
    await expect(dal.updateAutomationSettings({ untouched_lead_hours: 96 })).rejects.toMatchObject({ code: "forbidden" });
    expect(await settingsRow(A.id)).toEqual(before);
  });

  it("an owner changes the settings and reads them back", async () => {
    await actAs(A.owner);
    await dal.updateAutomationSettings({ untouched_lead_hours: 36, recall_tasks: true, recall_months: 9 });
    const { settings, role } = await dal.getAutomationSettings();
    expect(role).toBe("owner");
    expect(settings).toMatchObject({ untouched_lead_hours: 36, recall_tasks: true, recall_months: 9 });
    await dal.updateAutomationSettings({ untouched_lead_hours: 48, recall_tasks: false, recall_months: 6 });
  });

  it("an owner's change never reaches another clinic's settings", async () => {
    const before = await settingsRow(B.id);
    await actAs(A.owner);
    await dal.updateAutomationSettings({ untouched_lead_hours: 72 });
    expect(await settingsRow(B.id)).toEqual(before);
    await dal.updateAutomationSettings({ untouched_lead_hours: 48 });
  });

  it("a viewer can read the settings and cannot change them", async () => {
    await actAs(A.viewer);
    const { role } = await dal.getAutomationSettings();
    expect(role).toBe("viewer");
    await expect(dal.updateAutomationSettings({ recall_tasks: true })).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("the public enquiry link", () => {
  it("a staff member cannot replace it; an admin can, and the old link stops matching", async () => {
    const before = await settingsRow(A.id);
    await actAs(A.staff);
    await expect(dal.regenerateEnquiryFormKey()).rejects.toMatchObject({ code: "forbidden" });
    expect((await settingsRow(A.id))?.enquiry_form_key).toBe(before?.enquiry_form_key ?? null);

    await actAs(A.admin);
    await dal.regenerateEnquiryFormKey();
    const after = (await settingsRow(A.id))?.enquiry_form_key;
    expect(after).toMatch(/^[0-9a-f]{64}$/);
    expect(after).not.toBe(before?.enquiry_form_key ?? null);
  });
});

describe("the staff morning digest is each member's own choice", () => {
  it("a viewer turns their own summary off, and no one else's changes", async () => {
    await actAs(A.viewer);
    await dal.setMyDigestOptOut(true);
    expect(await dal.getMyDigestOptOut()).toBe(true);

    const { rows } = await admin<{ id: string; clerk_user_id: string; digest_opt_out: boolean }>(
      "select id, clerk_user_id, digest_opt_out from public.clinic_members where clinic_id = $1",
      [A.id],
    );
    const optedOut = rows.filter((row) => row.digest_opt_out).map((row) => row.clerk_user_id);
    expect(optedOut).toEqual([A.viewer.userId]);

    await dal.setMyDigestOptOut(false);
    expect(await dal.getMyDigestOptOut()).toBe(false);
  });

  it("a user from another clinic's organization cannot change this clinic's member row", async () => {
    await actAs(A.viewer, B.orgId);
    await expect(dal.setMyDigestOptOut(true)).rejects.toMatchObject({ code: "forbidden" });
  });
});
