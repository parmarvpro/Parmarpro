import "server-only";

import { TREATMENT_LABELS, TREATMENTS, triageRow, type Treatment, type Triage } from "@/lib/ai-triage";
import { enquiryTextFromNotes } from "@/lib/enquiry";
import { firstNameOf, inquiryFollowUpText } from "@/lib/whatsapp";
import { uuidField } from "@/lib/validation/common";
import { paidLaneConfigured } from "@/server/ai/configured";
import { sortEnquiry, type EnquirySortInput, type EnquirySortResult } from "@/server/ai/features/enquiry-sort";
import { draftReply, type ReplyDraftInput, type ReplyDraftResult } from "@/server/ai/features/reply-draft";
import { type AuthContext, requirePermission } from "@/server/auth/context";
import { AppError } from "@/server/auth/errors";
import { throwIfDbError } from "@/server/db/errors";
import { parseInput } from "@/server/validation";

/**
 * The AI triage of a lead, read and written by signed-in members under RLS, the on-demand sort
 * that an owner or staff member asks for, and the suggested reply to an enquiry. The website's
 * automatic sort writes through the privileged path instead (src/server/privileged/ai-triage.ts).
 */

const TRIAGE_COLUMNS = "treatment, urgency, language, best_time, summary, model, updated_at";
const LEAD_COLUMNS = "id, full_name, phone_e164, email, source, notes";

async function readAiEnquiryHelp(ctx: AuthContext): Promise<boolean> {
  const { data, error } = await ctx.db
    .from("clinic_automation_settings")
    .select("ai_enquiry_help")
    .eq("clinic_id", ctx.clinicId)
    .maybeSingle();
  throwIfDbError(error);
  return data?.ai_enquiry_help === true;
}

/** Whether the clinic has turned on AI help with enquiries. Every member may read it. */
export async function isAiEnquiryHelpOn(): Promise<boolean> {
  return readAiEnquiryHelp(await requirePermission("lead:read"));
}

/** The triage of one lead, or null when it has not been sorted. RLS limits it to the caller's clinic. */
export async function getLeadTriage(rawLeadId: unknown) {
  const ctx = await requirePermission("lead:read");
  const leadId = parseInput(uuidField, rawLeadId);
  const { data, error } = await ctx.db.from("lead_ai_triage").select(TRIAGE_COLUMNS).eq("lead_id", leadId).maybeSingle();
  throwIfDbError(error);
  return data;
}

/** Stores the triage of a lead the caller can see. Requires lead:update. */
export async function saveLeadTriage(rawLeadId: unknown, triage: Triage, model: string): Promise<void> {
  const ctx = await requirePermission("lead:update");
  await writeTriage(ctx, parseInput(uuidField, rawLeadId), triage, model);
}

export type SortDeps = {
  sort: (input: EnquirySortInput) => Promise<EnquirySortResult | null>;
  paidLaneConfigured: () => boolean;
};

const PRODUCTION_SORT_DEPS: SortDeps = { sort: sortEnquiry, paidLaneConfigured };

/**
 * Sorts one lead on the caller's request. Refused, with nothing sent, when the clinic has AI help
 * off, the paid key is not configured, or the lead has no enquiry text. When no model answers the
 * error code is "ai_unavailable", which the UI shows as "AI is busy, try again later".
 */
export async function sortLeadWithAi(rawLeadId: unknown, deps: SortDeps = PRODUCTION_SORT_DEPS): Promise<void> {
  const ctx = await requirePermission("lead:update");
  const lead = await readLead(ctx, parseInput(uuidField, rawLeadId));

  if (!(await readAiEnquiryHelp(ctx))) throw new AppError("ai_disabled");
  if (!deps.paidLaneConfigured()) throw new AppError("ai_not_configured");

  const text = enquiryTextFromNotes(lead.notes);
  if (text === "") throw new AppError("nothing_to_sort");

  const result = await deps.sort({
    text,
    source: lead.source,
    clinicName: ctx.clinicName,
    contact: { fullName: lead.full_name, phone: lead.phone_e164, email: lead.email },
    clinicId: ctx.clinicId,
  });
  if (!result) throw new AppError("ai_unavailable");
  await writeTriage(ctx, lead.id, result.triage, result.model);
}

/** The lead, read under RLS, so a lead of another clinic is reported as not found. */
async function readLead(ctx: AuthContext, leadId: string) {
  const { data: lead, error } = await ctx.db.from("leads").select(LEAD_COLUMNS).eq("id", leadId).maybeSingle();
  throwIfDbError(error);
  if (!lead) throw new AppError("not_found");
  return lead;
}

export type DraftDeps = {
  draft: (input: ReplyDraftInput) => Promise<ReplyDraftResult | null>;
  paidLaneConfigured: () => boolean;
};

/**
 * A suggested reply: from the AI, or the standard message, with the reason it was used: the lead
 * has no enquiry text to answer, or no model gave a usable draft.
 */
export type LeadReplyDraft =
  | { text: string; source: "ai"; model: string }
  | { text: string; source: "template"; reason: "no_enquiry" | "ai_unavailable" };

const PRODUCTION_DRAFT_DEPS: DraftDeps = { draft: draftReply, paidLaneConfigured };

/**
 * Suggests a reply to a lead's enquiry, for the caller to edit and send. Nothing is stored or sent
 * here. Refused, like the sort, when AI help is off or the paid key is not configured. The standard
 * message is returned, with no AI call, when the lead has no enquiry text, and when no model answers
 * or the draft fails its check.
 */
export async function draftLeadReply(rawLeadId: unknown, deps: DraftDeps = PRODUCTION_DRAFT_DEPS): Promise<LeadReplyDraft> {
  const ctx = await requirePermission("lead:update");
  const leadId = parseInput(uuidField, rawLeadId);
  const lead = await readLead(ctx, leadId);

  if (!(await readAiEnquiryHelp(ctx))) throw new AppError("ai_disabled");
  if (!deps.paidLaneConfigured()) throw new AppError("ai_not_configured");

  const template = (reason: "no_enquiry" | "ai_unavailable"): LeadReplyDraft => ({
    text: inquiryFollowUpText({ firstName: firstNameOf(lead.full_name), clinicName: ctx.clinicName }),
    source: "template",
    reason,
  });
  const text = enquiryTextFromNotes(lead.notes);
  if (text === "") return template("no_enquiry");

  const draft = await deps.draft({
    text,
    clinicName: ctx.clinicName,
    contact: { fullName: lead.full_name, phone: lead.phone_e164, email: lead.email },
    clinicId: ctx.clinicId,
    treatmentLabel: await storedTreatmentLabel(ctx, lead.id),
  });
  return draft ? { text: draft.reply, source: "ai", model: draft.model } : template("ai_unavailable");
}

/** The label of the stored treatment. Null when the lead has no triage, or when the treatment is unclear. */
async function storedTreatmentLabel(ctx: AuthContext, leadId: string): Promise<string | null> {
  const { data, error } = await ctx.db.from("lead_ai_triage").select("treatment").eq("lead_id", leadId).maybeSingle();
  throwIfDbError(error);
  const treatment = data?.treatment;
  if (!treatment || treatment === "unclear" || !isTreatment(treatment)) return null;
  return TREATMENT_LABELS[treatment];
}

function isTreatment(value: string): value is Treatment {
  return (TREATMENTS as readonly string[]).includes(value);
}

/**
 * Updates the lead's triage row, or inserts it. Reads the lead first, through RLS, so a lead
 * of another clinic is reported as not found. The insert races are settled by updating the row
 * that won.
 */
async function writeTriage(ctx: AuthContext, leadId: string, triage: Triage, model: string): Promise<void> {
  const { data: lead, error: leadError } = await ctx.db.from("leads").select("id").eq("id", leadId).maybeSingle();
  throwIfDbError(leadError);
  if (!lead) throw new AppError("not_found");

  const values = triageRow(triage, model);
  const { data: existing, error: existingError } = await ctx.db
    .from("lead_ai_triage")
    .select("lead_id")
    .eq("lead_id", leadId)
    .maybeSingle();
  throwIfDbError(existingError);
  if (existing) {
    await updateTriage(ctx, leadId, values);
    return;
  }

  const { error } = await ctx.db.from("lead_ai_triage").insert({ lead_id: leadId, ...values });
  if (error?.code === "23505") {
    await updateTriage(ctx, leadId, values);
    return;
  }
  throwIfDbError(error);
}

async function updateTriage(ctx: AuthContext, leadId: string, values: ReturnType<typeof triageRow>): Promise<void> {
  const { data, error } = await ctx.db.from("lead_ai_triage").update(values).eq("lead_id", leadId).select("lead_id");
  throwIfDbError(error);
  if (!data?.length) throw new AppError("not_found");
}
