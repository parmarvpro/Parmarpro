/**
 * Integration: the real server data-access layer -> supabase-js -> PostgREST
 * -> PostgreSQL RLS. Only Clerk's auth() is replaced, returning locally minted
 * tokens with Clerk-shaped claims. Also exercises direct Data API calls that
 * bypass the app layer entirely (what an attacker holding their own token
 * could do).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { admin, claimsFor, closePool, createClinicFixture, deleteClinicFixture, type ClinicFixture, type Persona } from "../helpers/db";
import { mintToken } from "../helpers/jwt";
import { startRestProxy } from "../helpers/rest-proxy";
import { loadTestEnv } from "../helpers/test-env";

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

const dal = {
  leads: await import("@/server/dal/leads"),
  patients: await import("@/server/dal/patients"),
  appointments: await import("@/server/dal/appointments"),
  tasks: await import("@/server/dal/tasks"),
  dashboard: await import("@/server/dal/dashboard"),
  team: await import("@/server/dal/team"),
  context: await import("@/server/auth/context"),
};

beforeAll(async () => {
  proxy = await startRestProxy();
  process.env.SUPABASE_URL = proxy.url;
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_local_integration_tests";
  A = await createClinicFixture("IntA");
  B = await createClinicFixture("IntB");
});

afterAll(async () => {
  await deleteClinicFixture(A);
  await deleteClinicFixture(B);
  await closePool();
  await proxy.close();
});

beforeEach(async () => {
  await actAs(null);
});

describe("app layer rejects unauthenticated and unauthorized callers", () => {
  it("no session -> unauthenticated", async () => {
    await expect(dal.leads.listLeads({})).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("session without active organization -> no_active_clinic", async () => {
    await actAs(A.staff, undefined);
    current.orgId = null;
    await expect(dal.leads.listLeads({})).rejects.toMatchObject({ code: "no_active_clinic" });
  });

  it("member of A whose session claims Clinic B -> forbidden", async () => {
    await actAs(A.staff, B.orgId);
    await expect(dal.leads.listLeads({})).rejects.toMatchObject({ code: "forbidden" });
  });

  it("viewer cannot create; staff cannot delete", async () => {
    await actAs(A.viewer);
    await expect(dal.leads.createLead({ fullName: "Synthetic" })).rejects.toMatchObject({ code: "forbidden" });
    await actAs(A.staff);
    await expect(dal.tasks.deleteTask(A.taskId)).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("tenant isolation through the DAL", () => {
  it("lists only own clinic's leads, patients, appointments and tasks", async () => {
    await actAs(A.staff);
    const leads = await dal.leads.listLeads({});
    const patients = await dal.patients.listPatients({});
    const appointments = await dal.appointments.listAppointments({ range: "all" });
    const tasks = await dal.tasks.listTasks({ view: "all" });
    expect(leads.rows.map((r) => r.id)).toContain(A.leadId);
    expect(leads.rows.map((r) => r.id)).not.toContain(B.leadId);
    expect(patients.rows.map((r) => r.id)).not.toContain(B.patientId);
    expect(appointments.rows.map((r) => r.id)).not.toContain(B.appointmentId);
    expect(tasks.rows.map((r) => r.id)).not.toContain(B.taskId);
  });

  it("guessing a Clinic B id returns not_found (no existence leak)", async () => {
    await actAs(A.owner);
    await expect(dal.leads.getLead(B.leadId)).rejects.toMatchObject({ code: "not_found" });
    await expect(dal.patients.getPatient(B.patientId)).rejects.toMatchObject({ code: "not_found" });
  });

  it("updating or deleting a Clinic B record returns not_found and changes nothing", async () => {
    await actAs(A.owner);
    await expect(dal.leads.updateLead(B.leadId, { fullName: "Hijacked" })).rejects.toMatchObject({ code: "not_found" });
    await expect(dal.tasks.deleteTask(B.taskId)).rejects.toMatchObject({ code: "not_found" });
    await expect(dal.appointments.setAppointmentStatus(B.appointmentId, { status: "cancelled" })).rejects.toMatchObject({
      code: "not_found",
    });
    const lead = await admin<{ full_name: string }>("select full_name from public.leads where id = $1", [B.leadId]);
    expect(lead.rows[0]!.full_name).not.toBe("Hijacked");
  });

  it("creates records in the caller's clinic even if a clinicId is smuggled in", async () => {
    await actAs(A.staff);
    await expect(dal.leads.createLead({ fullName: "Synthetic Lead", clinicId: B.id })).rejects.toMatchObject({
      code: "invalid_input",
    });
    const created = await dal.leads.createLead({ fullName: "Synthetic Lead Created", source: "website" });
    const row = await admin<{ clinic_id: string; created_by: string }>("select clinic_id, created_by from public.leads where id = $1", [
      created.id,
    ]);
    expect(row.rows[0]).toEqual({ clinic_id: A.id, created_by: A.staff.userId });
  });

  it("cannot link a Clinic B patient or assign a Clinic B member", async () => {
    await actAs(A.staff);
    await expect(
      dal.appointments.createAppointment({ patientId: B.patientId, startsAt: "2030-01-15T10:30" }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    await expect(
      dal.leads.createLead({ fullName: "Synthetic", assignedTo: B.staff.memberId }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("dashboard counts only own clinic", async () => {
    await actAs(A.viewer);
    const dashboard = await dal.dashboard.getDashboard({ range: "30d" });
    const own = await admin<{ n: string }>("select count(*)::text n from public.patients where clinic_id = $1 and archived_at is null", [A.id]);
    expect(dashboard.summary.patients_total).toBe(Number(own.rows[0]!.n));
    expect(dashboard.recentLeads.every((lead) => lead.id !== B.leadId)).toBe(true);
  });

  it("search input cannot inject filters", async () => {
    await actAs(A.staff);
    for (const q of ["%", "_", "a,clinic_id.eq.x", "x)or(full_name.ilike.*", "' or 1=1 --", "\\"]) {
      const result = await dal.leads.listLeads({ q });
      expect(result.rows.every((row) => row.id !== B.leadId)).toBe(true);
    }
  });

  it("switching the active organization switches the clinic", async () => {
    const userId = `user_switcher${Date.now()}`;
    await admin("insert into public.clinic_members (clinic_id, clerk_user_id, role) values ($1, $2, 'staff'), ($3, $2, 'viewer')", [
      A.id,
      userId,
      B.id,
    ]);
    const persona: Persona = { userId, memberId: "", role: "staff", claims: claimsFor(userId, A.orgId) };
    await actAs(persona, A.orgId);
    expect((await dal.context.getAuthContext()).clinicId).toBe(A.id);
    await actAs(persona, B.orgId);
    const ctxB = await dal.context.getAuthContext();
    expect(ctxB).toMatchObject({ clinicId: B.id, role: "viewer" });
    await expect(dal.leads.createLead({ fullName: "Viewer in B" })).rejects.toMatchObject({ code: "forbidden" });
    await admin("delete from public.clinic_members where clerk_user_id = $1", [userId]);
  });

  it("team role changes follow the rules end to end", async () => {
    await actAs(A.admin);
    await expect(dal.team.changeMemberRole({ memberId: A.owner.memberId, role: "viewer" })).rejects.toMatchObject({ code: "forbidden" });
    await actAs(A.staff);
    await expect(dal.team.changeMemberRole({ memberId: A.viewer.memberId, role: "staff" })).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("direct Data API calls with a user's own token (bypassing the app)", () => {
  async function rest(path: string, persona: Persona, init: RequestInit = {}) {
    const token = await mintToken(persona.claims);
    return fetch(`${loadTestEnv().postgrestUrl}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", prefer: "return=representation", ...init.headers },
    });
  }

  it("viewer POST /leads is rejected by RLS", async () => {
    const response = await rest("/leads", A.viewer, { method: "POST", body: JSON.stringify({ full_name: "Direct write" }) });
    expect(response.status).toBe(403);
  });

  it("staff PATCH of a Clinic B lead changes nothing", async () => {
    const response = await rest(`/leads?id=eq.${B.leadId}`, A.staff, { method: "PATCH", body: JSON.stringify({ notes: "x" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it("owner cannot grant itself a paid period", async () => {
    const response = await rest(`/clinic_entitlements?clinic_id=eq.${A.id}`, A.owner, {
      method: "PATCH",
      body: JSON.stringify({ paid_through: "2099-01-01T00:00:00Z" }),
    });
    expect([401, 403]).toContain(response.status);
    const row = await admin<{ paid_through: Date | null }>("select paid_through from public.clinic_entitlements where clinic_id = $1", [A.id]);
    expect(row.rows[0]!.paid_through).toBeNull();
  });

  it("owner cannot call service-only RPCs", async () => {
    const response = await rest("/rpc/apply_verified_payment", A.owner, {
      method: "POST",
      body: JSON.stringify({
        p_billing_order_id: "00000000-0000-4000-8000-000000000000",
        p_provider_order_id: "order_x",
        p_provider_payment_id: "pay_x",
        p_amount_paise: 1,
        p_currency: "INR",
      }),
    });
    expect([401, 403, 404]).toContain(response.status);
  });

  it("expired tokens are rejected", async () => {
    const token = await mintToken(A.owner.claims, { expiresIn: "-1m" });
    const response = await fetch(`${loadTestEnv().postgrestUrl}/leads`, { headers: { authorization: `Bearer ${token}` } });
    expect(response.status).toBe(401);
  });

  it("tokens signed with another key are rejected", async () => {
    const { SignJWT } = await import("jose");
    const forged = await new SignJWT({ ...A.owner.claims })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode("not-the-real-secret-not-the-real-secret"));
    const response = await fetch(`${loadTestEnv().postgrestUrl}/leads`, { headers: { authorization: `Bearer ${forged}` } });
    expect(response.status).toBe(401);
  });
});
