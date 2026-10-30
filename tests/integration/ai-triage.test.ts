/**
 * Integration: the AI triage of leads against the local database. The real data-access functions,
 * the website intake and the privileged writes all run through supabase-js, PostgREST and RLS.
 * Only Clerk's auth() is replaced, with locally minted tokens. The sorter is a fake in every test,
 * so no request reaches Google.
 */
import { randomBytes } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Triage } from "@/lib/ai-triage";
import { CONSENT_NOTE } from "@/lib/enquiry";
import type { EnquirySortInput, EnquirySortResult } from "@/server/ai/features/enquiry-sort";

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

// Synthetic values only. The model name is one the lead_ai_triage check accepts.
const MODEL = "gemini-3.5-flash-lite";
const TRIAGE: Triage = {
  treatment: "pain_emergency",
  urgency: "call_today",
  language: "en",
  best_time: "after 6 pm",
  summary: "Asks about tooth pain.",
  confidence: "high",
};
const newKey = () => randomBytes(32).toString("hex");
const tag = () => randomBytes(6).toString("hex");

let A: ClinicFixture;
let B: ClinicFixture;
let proxy: Awaited<ReturnType<typeof startRestProxy>>;
let dal: typeof import("@/server/dal/ai-triage");
let leadsDal: typeof import("@/server/dal/leads");
let intake: typeof import("@/server/enquiry/website-intake");

beforeAll(async () => {
  proxy = await startRestProxy();
  process.env.SUPABASE_URL = proxy.url;
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_local_integration_tests";
  // Locally minted service_role token stands in for the Supabase secret key.
  process.env.SUPABASE_SECRET_KEY = await mintToken({ role: "service_role" }, { expiresIn: "1h" });
  dal = await import("@/server/dal/ai-triage");
  leadsDal = await import("@/server/dal/leads");
  intake = await import("@/server/enquiry/website-intake");
  A = await createClinicFixture("AiA");
  B = await createClinicFixture("AiB");
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

/** Switches the clinic's AI help on or off, as the settings page does. */
async function setAiHelp(clinicId: string, on: boolean) {
  await admin("update public.clinic_automation_settings set ai_enquiry_help = $2 where clinic_id = $1", [clinicId, on]);
}

/** Adds a lead of the given source and notes to a clinic, and returns its id. */
async function insertLead(clinicId: string, notes: string | null, source = "whatsapp", fullName = `Synthetic Lead ${tag()}`) {
  const { rows } = await admin<{ id: string }>(
    "insert into public.leads (clinic_id, full_name, source, notes) values ($1, $2, $3, $4) returning id",
    [clinicId, fullName, source, notes],
  );
  return rows[0]!.id;
}

async function triageRows(leadId: string) {
  const { rows } = await admin<{ urgency: string; model: string; summary: string; clinic_id: string }>(
    "select urgency, model, summary, clinic_id from public.lead_ai_triage where lead_id = $1",
    [leadId],
  );
  return rows;
}

/** A sorter that answers with TRIAGE and records what it was given. */
function fakeSorter(result: EnquirySortResult | null = { triage: TRIAGE, model: MODEL }) {
  return vi.fn<(input: EnquirySortInput) => Promise<EnquirySortResult | null>>(async () => result);
}

describe("saving a lead's triage as a signed-in member", () => {
  it("an owner saves the triage and reads it back, with the model that produced it", async () => {
    const lead = await insertLead(A.id, "Synthetic question about pain.");
    await actAs(A.owner);
    await dal.saveLeadTriage(lead, TRIAGE, MODEL);

    expect(await dal.getLeadTriage(lead)).toMatchObject({ treatment: "pain_emergency", urgency: "call_today", model: MODEL });
  });

  it("a second save updates the same row rather than adding one", async () => {
    const lead = await insertLead(A.id, null);
    await actAs(A.staff);
    await dal.saveLeadTriage(lead, TRIAGE, MODEL);
    await dal.saveLeadTriage(lead, { ...TRIAGE, urgency: "routine", summary: "Asks about a check-up." }, MODEL);

    const rows = await triageRows(lead);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ urgency: "routine", summary: "Asks about a check-up." });
  });

  it("a viewer is refused, and reads what is stored", async () => {
    const lead = await insertLead(A.id, null);
    await actAs(A.staff);
    await dal.saveLeadTriage(lead, TRIAGE, MODEL);

    await actAs(A.viewer);
    await expect(dal.saveLeadTriage(lead, { ...TRIAGE, urgency: "routine" }, MODEL)).rejects.toMatchObject({ code: "forbidden" });
    expect(await dal.getLeadTriage(lead)).toMatchObject({ urgency: "call_today" });
  });

  it("a user of clinic B cannot read A's triage, and a save for A's lead is not found and writes nothing", async () => {
    const lead = await insertLead(A.id, null);
    await actAs(A.owner);
    await dal.saveLeadTriage(lead, TRIAGE, MODEL);

    await actAs(B.owner);
    expect(await dal.getLeadTriage(lead)).toBeNull();
    await expect(dal.saveLeadTriage(lead, { ...TRIAGE, urgency: "routine" }, MODEL)).rejects.toMatchObject({ code: "not_found" });

    const rows = await triageRows(lead);
    expect(rows).toEqual([expect.objectContaining({ urgency: "call_today", clinic_id: A.id })]);
  });
});

describe("the website enquiry path", () => {
  it("with AI help on and the paid key configured, sorts the visitor's message and stores the triage for the new lead", async () => {
    await setAiHelp(A.id, true);
    const key = newKey();
    await admin("update public.clinic_automation_settings set enquiry_form_key = $2, enquiry_form_enabled = true where clinic_id = $1", [A.id, key]);
    const name = `Synthetic Visitor ${tag()}`;
    const sort = fakeSorter();
    const pending: Promise<void>[] = [];

    const outcome = await intake.storeWebsiteEnquiry(
      key,
      { fullName: name, phone: "+919800000078", email: null, message: "Synthetic question about a check-up" },
      { ...intake.productionWebsiteIntakeDeps, sortEnquiry: sort, paidLaneConfigured: () => true, schedule: (task) => void pending.push(task()) },
    );
    await Promise.all(pending);

    expect(outcome).toBe("sent");
    expect(sort).toHaveBeenCalledWith({
      text: "Synthetic question about a check-up",
      source: "website",
      clinicName: "Synthetic Clinic AiA",
      contact: { fullName: name, phone: "+919800000078", email: null },
      clinicId: A.id,
    });
    const { rows: leads } = await admin<{ id: string }>("select id from public.leads where full_name = $1 and clinic_id = $2", [name, A.id]);
    expect(leads).toHaveLength(1);
    expect(await triageRows(leads[0]!.id)).toEqual([expect.objectContaining({ urgency: "call_today", model: MODEL, clinic_id: A.id })]);
    await setAiHelp(A.id, false);
  });

  it("with AI help off, stores the lead and sorts nothing", async () => {
    await setAiHelp(A.id, false);
    const key = newKey();
    await admin("update public.clinic_automation_settings set enquiry_form_key = $2, enquiry_form_enabled = true where clinic_id = $1", [A.id, key]);
    const name = `Synthetic Visitor ${tag()}`;
    const sort = fakeSorter();
    const pending: Promise<void>[] = [];

    await intake.storeWebsiteEnquiry(
      key,
      { fullName: name, phone: "+919800000079", email: null, message: "Synthetic question" },
      { ...intake.productionWebsiteIntakeDeps, sortEnquiry: sort, paidLaneConfigured: () => true, schedule: (task) => void pending.push(task()) },
    );
    await Promise.all(pending);

    expect(sort).not.toHaveBeenCalled();
    expect(pending).toHaveLength(0);
    const { rows: leads } = await admin<{ id: string }>("select id from public.leads where full_name = $1", [name]);
    expect(leads).toHaveLength(1);
    expect(await triageRows(leads[0]!.id)).toEqual([]);
  });

  it("with the paid key not configured, or no message, stores the lead and sorts nothing", async () => {
    await setAiHelp(A.id, true);
    const key = newKey();
    await admin("update public.clinic_automation_settings set enquiry_form_key = $2, enquiry_form_enabled = true where clinic_id = $1", [A.id, key]);
    const sort = fakeSorter();
    const pending: Promise<void>[] = [];
    const deps = { ...intake.productionWebsiteIntakeDeps, sortEnquiry: sort, schedule: (task: () => Promise<void>) => void pending.push(task()) };

    const unconfigured = `Synthetic Visitor ${tag()}`;
    await intake.storeWebsiteEnquiry(key, { fullName: unconfigured, phone: "+919800000080", email: null, message: "Synthetic" }, { ...deps, paidLaneConfigured: () => false });
    const noMessage = `Synthetic Visitor ${tag()}`;
    await intake.storeWebsiteEnquiry(key, { fullName: noMessage, phone: "+919800000081", email: null, message: null }, { ...deps, paidLaneConfigured: () => true });
    await Promise.all(pending);

    expect(sort).not.toHaveBeenCalled();
    const { rows: leads } = await admin<{ id: string }>("select id from public.leads where full_name = any($1::text[])", [[unconfigured, noMessage]]);
    expect(leads).toHaveLength(2);
    for (const lead of leads) expect(await triageRows(lead.id)).toEqual([]);
    await setAiHelp(A.id, false);
  });

  it("when no model answers, the lead is stored and no triage is written", async () => {
    await setAiHelp(A.id, true);
    const key = newKey();
    await admin("update public.clinic_automation_settings set enquiry_form_key = $2, enquiry_form_enabled = true where clinic_id = $1", [A.id, key]);
    const name = `Synthetic Visitor ${tag()}`;
    const pending: Promise<void>[] = [];

    await intake.storeWebsiteEnquiry(
      key,
      { fullName: name, phone: "+919800000082", email: null, message: "Synthetic question" },
      { ...intake.productionWebsiteIntakeDeps, sortEnquiry: fakeSorter(null), paidLaneConfigured: () => true, schedule: (task) => void pending.push(task()) },
    );
    await Promise.all(pending);

    const { rows: leads } = await admin<{ id: string }>("select id from public.leads where full_name = $1", [name]);
    expect(leads).toHaveLength(1);
    expect(await triageRows(leads[0]!.id)).toEqual([]);
    await setAiHelp(A.id, false);
  });
});

describe("sorting a lead on request", () => {
  it("is refused, and sends nothing, when the clinic has AI help off", async () => {
    await setAiHelp(A.id, false);
    const lead = await insertLead(A.id, `Synthetic question about pain.\n\n${CONSENT_NOTE}`);
    const sort = fakeSorter();
    await actAs(A.owner);
    await expect(dal.sortLeadWithAi(lead, { sort, paidLaneConfigured: () => true })).rejects.toMatchObject({ code: "ai_disabled" });
    expect(sort).not.toHaveBeenCalled();
    expect(await triageRows(lead)).toEqual([]);
  });

  it("is refused when the paid key is not configured, even with AI help on", async () => {
    await setAiHelp(A.id, true);
    const lead = await insertLead(A.id, "Synthetic question about pain.");
    const sort = fakeSorter();
    await actAs(A.owner);
    await expect(dal.sortLeadWithAi(lead, { sort, paidLaneConfigured: () => false })).rejects.toMatchObject({ code: "ai_not_configured" });
    expect(sort).not.toHaveBeenCalled();
    await setAiHelp(A.id, false);
  });

  it("sends the notes without the consent line, the lead's source and the clinic name, and stores the triage", async () => {
    await setAiHelp(A.id, true);
    const lead = await insertLead(A.id, `Synthetic question about pain.\n\n${CONSENT_NOTE}`, "referral", "Synthetic Caller");
    const sort = fakeSorter();
    await actAs(A.owner);
    await dal.sortLeadWithAi(lead, { sort, paidLaneConfigured: () => true });

    expect(sort).toHaveBeenCalledWith({
      text: "Synthetic question about pain.",
      source: "referral",
      clinicName: "Synthetic Clinic AiA",
      contact: { fullName: "Synthetic Caller", phone: null, email: null },
      clinicId: A.id,
    });
    expect(await dal.getLeadTriage(lead)).toMatchObject({ urgency: "call_today", model: MODEL });
    await setAiHelp(A.id, false);
  });

  it("reports ai_unavailable when no model answers, and stores nothing", async () => {
    await setAiHelp(A.id, true);
    const lead = await insertLead(A.id, "Synthetic question.");
    await actAs(A.owner);
    await expect(dal.sortLeadWithAi(lead, { sort: fakeSorter(null), paidLaneConfigured: () => true })).rejects.toMatchObject({
      code: "ai_unavailable",
    });
    expect(await triageRows(lead)).toEqual([]);
    await setAiHelp(A.id, false);
  });

  it("refuses a lead whose notes hold only the consent line", async () => {
    await setAiHelp(A.id, true);
    const lead = await insertLead(A.id, CONSENT_NOTE);
    const sort = fakeSorter();
    await actAs(A.owner);
    await expect(dal.sortLeadWithAi(lead, { sort, paidLaneConfigured: () => true })).rejects.toMatchObject({ code: "nothing_to_sort" });
    expect(sort).not.toHaveBeenCalled();
    await setAiHelp(A.id, false);
  });

  it("is refused for a viewer, and for another clinic's user the lead is not found", async () => {
    await setAiHelp(A.id, true);
    const lead = await insertLead(A.id, "Synthetic question.");
    const sort = fakeSorter();

    await actAs(A.viewer);
    await expect(dal.sortLeadWithAi(lead, { sort, paidLaneConfigured: () => true })).rejects.toMatchObject({ code: "forbidden" });

    await actAs(B.owner);
    await expect(dal.sortLeadWithAi(lead, { sort, paidLaneConfigured: () => true })).rejects.toMatchObject({ code: "not_found" });
    expect(sort).not.toHaveBeenCalled();
    await setAiHelp(A.id, false);
  });
});

describe("the leads list and the AI switch", () => {
  it("lists each lead's triage urgency through the composite foreign key", async () => {
    await setAiHelp(A.id, true);
    const urgent = await insertLead(A.id, "Synthetic question about pain.", "whatsapp", "Synthetic Urgent");
    const plain = await insertLead(A.id, "Synthetic question about a check-up.", "whatsapp", "Synthetic Plain");
    await actAs(A.owner);
    await dal.saveLeadTriage(urgent, TRIAGE, MODEL);
    await dal.saveLeadTriage(plain, { ...TRIAGE, urgency: "routine" }, MODEL);

    const { rows } = await leadsDal.listLeads({ q: "Synthetic" });
    const byId = new Map(rows.map((row) => [row.id, row.lead_ai_triage]));
    expect(byId.get(urgent)).toEqual([{ urgency: "call_today" }]);
    expect(byId.get(plain)).toEqual([{ urgency: "routine" }]);
    expect(byId.get(A.leadId)).toEqual([]);
    await setAiHelp(A.id, false);
  });

  it("tells every member whether AI help is on, and tells another clinic nothing about it", async () => {
    await setAiHelp(A.id, true);
    await actAs(A.viewer);
    expect(await dal.isAiEnquiryHelpOn()).toBe(true);
    await actAs(B.viewer);
    expect(await dal.isAiEnquiryHelpOn()).toBe(false);
    await setAiHelp(A.id, false);
  });
});
