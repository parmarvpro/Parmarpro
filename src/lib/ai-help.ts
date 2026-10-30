/**
 * The AI help a clinic can use right now: the two prompts staff may give Gemini, what each one
 * receives and returns, and the state of the switch. Pure, with no server imports, so the lead
 * page, the AI help page and the settings page show the same words.
 *
 * The operations note is not here: it runs only in the founder's daily digest, never in a clinic.
 */

export type AiPromptId = "sort" | "draft";

export type AiPrompt = {
  id: AiPromptId;
  name: string;
  /** Where staff run it, and what happens automatically. */
  where: string;
  /** What Gemini is sent. Contact details are always removed first. */
  receives: string;
  /** What comes back, and what is done with it. */
  returns: string;
  runBy: string;
};

export const AI_PROMPTS: readonly AiPrompt[] = [
  {
    id: "sort",
    name: "Sort an enquiry",
    where: "On a lead, with Sort with AI. Also runs by itself on new website enquiries.",
    receives: "The enquiry text, without the name, phone number or email. The lead source. The clinic name.",
    returns:
      "The treatment it is about, how soon to call, the language, the best time if one was given, a one-line summary and a confidence. The result is stored on the lead as a suggestion.",
    runBy: "Owners, admins and staff who can edit leads.",
  },
  {
    id: "draft",
    name: "Draft a reply",
    where: "On a lead, with Draft a reply. Nothing is stored or sent.",
    receives:
      "The enquiry text, without the name, phone number or email. The clinic name. The treatment from the sort, if the lead has been sorted.",
    returns:
      "A short WhatsApp reply for staff to edit. A draft that quotes a price, makes a medical claim, includes a link or contact details is not shown; the standard follow-up message is used instead.",
    runBy: "Owners, admins and staff who can edit leads.",
  },
];

/** What is never sent to Gemini, whatever the prompt. */
export const AI_NEVER_SENT: readonly string[] = [
  "The lead's or patient's name, phone number and email address.",
  "Patient records, appointments and tasks.",
  "Staff names and anything else in the lead record, apart from the enquiry text, the lead source, the clinic name and the treatment.",
];

export type AiHelpState = "off" | "not_connected" | "on";

/**
 * The state the clinic sees. "off": the clinic has not turned AI help on. "not_connected": it is on,
 * but the Gemini service is not set up for ParmarPro, so nothing runs. "on": prompts can run.
 */
export function aiHelpState({ enabled, configured }: { enabled: boolean; configured: boolean }): AiHelpState {
  if (!enabled) return "off";
  return configured ? "on" : "not_connected";
}
