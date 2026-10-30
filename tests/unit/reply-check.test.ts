import { describe, expect, it } from "vitest";

import { REPLY_MAX_CHARS, checkReplyDraft } from "@/lib/reply-check";

// Synthetic clinic name. No real clinic, person, number or address appears here.
const CLINIC = "Synthetic Clinic";
const CLEAN = "Hello, thank you for your enquiry about a check-up. Please call us or reply with a convenient time.";

describe("a clean draft", () => {
  it("is accepted, trimmed, and signed with the clinic name when the draft does not carry it", () => {
    expect(checkReplyDraft(`  ${CLEAN}  `, CLINIC)).toEqual({ ok: true, text: `${CLEAN}\n\n${CLINIC}` });
  });

  it("is not signed a second time when the clinic name is already there, in any case", () => {
    const body = `${CLEAN}\n\nSYNTHETIC clinic`;
    expect(checkReplyDraft(body, CLINIC)).toEqual({ ok: true, text: body });
  });

  it("keeps a clinic name that contains a word the rules would otherwise refuse", () => {
    const body = `${CLEAN}\n\nSmile Cure Dental`;
    expect(checkReplyDraft(body, "Smile Cure Dental")).toEqual({ ok: true, text: body });
    expect(checkReplyDraft(`${CLEAN}\n\nRS Dental`, "RS Dental").ok).toBe(true);
  });

  it("still refuses a flagged word that is outside the clinic name", () => {
    expect(checkReplyDraft(`This will cure you.\n\nSmile Cure Dental`, "Smile Cure Dental").ok).toBe(false);
  });
});

describe("a draft that says something the clinic may not say", () => {
  it.each([
    ["a rupee sign", "The fee is ₹500 for a check-up."],
    ["Rs. with a dot", "A check-up costs Rs. 500."],
    ["Rs with a space", "A check-up is Rs 500."],
    ["INR", "A check-up is INR 500."],
    ["a percentage", "We can do 20% off a check-up."],
    ["the word percent after a number", "You save 10 percent on a check-up."],
    ["100%", "The result is 100% sure."],
    ["discount", "There is a discount this week."],
    ["offer", "We have an offer for you."],
    ["free of cost", "The check-up is free of cost."],
    ["guarantee", "We guarantee the result."],
    ["guaranteed", "The result is guaranteed."],
    ["cure", "This will cure the pain."],
    ["painless", "The procedure is painless."],
    ["diagnosis", "Our diagnosis is quick."],
    ["prescription", "We can write a prescription."],
    ["antibiotic", "Take an antibiotic after the visit."],
    ["painkiller", "Take a painkiller before the visit."],
    ["medicine", "Take this medicine."],
    ["tablet", "Take one tablet a day."],
    ["an https link", "See https://example.test/clinic for more."],
    ["a www link", "See www.example.test for more."],
    ["an email address", "Write to enquirer@example.test."],
    ["a ten-digit phone number", "Call 9800000077 today."],
    ["a phone number with spaces", "Call 98000 00077 today."],
    ["a phone number with the country code", "Call +91 98000 00077 today."],
  ])("refuses a draft with %s", (_label, body) => {
    const result = checkReplyDraft(`Hello, thank you for your enquiry. ${body}\n\n${CLINIC}`, CLINIC);
    expect(result.ok).toBe(false);
  });

  it("gives a reason that does not repeat the draft", () => {
    const result = checkReplyDraft("Hello, the fee is ₹500.", CLINIC);
    expect(result).toEqual({ ok: false, reason: "The draft mentions a price or a currency." });
  });

  it("does not refuse a number that is not a phone number, or a time of day", () => {
    const body = "Hello, we can see you on 5 November at 10 am or 6 pm. Please reply with a time.";
    expect(checkReplyDraft(body, CLINIC).ok).toBe(true);
  });

  it("does not refuse a word that only contains a flagged one", () => {
    const body = "Hello, your secure booking is ready. Please call us to talk about the Mrs. file.";
    expect(checkReplyDraft(body, CLINIC).ok).toBe(true);
  });
});

describe("empty and long drafts", () => {
  it("refuses an empty draft and one that is only spaces", () => {
    expect(checkReplyDraft("", CLINIC).ok).toBe(false);
    expect(checkReplyDraft("   \n ", CLINIC).ok).toBe(false);
  });

  it("accepts a reply of exactly the limit, when the clinic name is already in it", () => {
    const body = `${"a".repeat(REPLY_MAX_CHARS - CLINIC.length - 1)} ${CLINIC}`;
    expect(body).toHaveLength(REPLY_MAX_CHARS);
    expect(checkReplyDraft(body, CLINIC)).toEqual({ ok: true, text: body });
  });

  it("refuses a reply one character over the limit", () => {
    const body = `${"a".repeat(REPLY_MAX_CHARS - CLINIC.length)} ${CLINIC}`;
    expect(checkReplyDraft(body, CLINIC).ok).toBe(false);
  });

  it("counts the clinic name that is added, so the signed reply is still within the limit", () => {
    const body = "a".repeat(REPLY_MAX_CHARS);
    const result = checkReplyDraft(body, CLINIC);
    expect(result).toEqual({ ok: false, reason: `The draft is longer than ${REPLY_MAX_CHARS} characters.` });
  });
});
