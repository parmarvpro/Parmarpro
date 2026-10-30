import { describe, expect, it } from "vitest";

import { redactContact, type Contact } from "@/lib/redact";

// Synthetic contact only. No real person, number or address appears here.
const LEAD: Contact = { fullName: "Synthetic Enquirer", phone: "+919800000077", email: "enquirer@example.test" };
const NONE: Contact = { fullName: "", phone: null, email: null };

describe("redactContact: phone numbers", () => {
  it.each([
    "+91 98000 00077",
    "+91-98000-00077",
    "+919800000077",
    "098000-00077",
    "9800000077",
    "98000 00077",
    "(022) 2345 6789",
    "022-23456789",
    "+44 20 7946 0958",
    "+1 (202) 555-0143",
    "91 9800000077",
    "+91.98000.00077",
  ])("removes %s", (number) => {
    expect(redactContact(`Please call ${number} after six.`, NONE)).toBe("Please call [phone] after six.");
  });

  it("removes the lead's own number written in another format", () => {
    expect(redactContact("ring 98-0-0-0-0-0-0-7-7 today", LEAD)).toBe("ring [phone] today");
  });

  it.each(["Booked for 12 Mar 2026", "on 2026-10-30 at 10 am", "Tooth 36 and 37", "Rs 2500 advance"])("leaves %s alone", (text) => {
    expect(redactContact(text, NONE)).toBe(text);
  });
});

describe("redactContact: email addresses", () => {
  it.each(["a@b.co.in", "Rahul.Sharma@Example.COM", "x+tag@mail.example.org", "o'neil@x.org"])("removes %s", (address) => {
    expect(redactContact(`write to ${address} please`, NONE)).toBe("write to [email] please");
  });

  it("removes the lead's own address even where the pattern would not", () => {
    expect(redactContact("mail enquirer@example.test", LEAD)).toBe("mail [email]");
    expect(redactContact("mail O'Neil@X.org", { fullName: "", phone: null, email: "o'neil@x.org" })).toBe("mail [email]");
  });
});

describe("redactContact: names", () => {
  it("removes each name token of three or more letters, in any case, as a whole word", () => {
    expect(redactContact("Synthetic Enquirer called. Ask for SYNTHETIC. Enquirer's aunt.", LEAD)).toBe(
      "[name] [name] called. Ask for [name]. [name]'s aunt.",
    );
  });

  it("does not replace a token inside another word", () => {
    expect(redactContact("Ravindra and Ravi and Kumari", { fullName: "Ravi Kumar", phone: null, email: null })).toBe(
      "Ravindra and [name] and Kumari",
    );
  });

  it("ignores tokens shorter than three letters", () => {
    expect(redactContact("Al and Ng", { fullName: "Al Ng", phone: null, email: null })).toBe("Al and Ng");
  });

  it("splits a name at an apostrophe, so each part of three or more letters is removed", () => {
    expect(redactContact("O'Brien is here", { fullName: "Mary O'Brien", phone: null, email: null })).toBe("O'[name] is here");
  });
});

describe("redactContact: combinations", () => {
  it("replaces every kind in one text", () => {
    expect(redactContact("Synthetic Enquirer, +91 98000 00077, enquirer@example.test", LEAD)).toBe("[name] [name], [phone], [email]");
  });

  it("does not let a name that spells a placeholder break the others", () => {
    expect(redactContact("email a@b.co.in", { fullName: "Email Phone", phone: null, email: null })).toBe("[name] [email]");
  });

  it("prefers the email when a name sits inside it", () => {
    expect(redactContact("enquirer@example.test", LEAD)).toBe("[email]");
  });

  it("returns the text unchanged when there is nothing to remove", () => {
    expect(redactContact("Two teeth need a check-up", NONE)).toBe("Two teeth need a check-up");
  });

  it("does not treat a blank contact field as a pattern that matches everywhere", () => {
    expect(redactContact("Two teeth", { fullName: "  ", phone: "", email: "   " })).toBe("Two teeth");
  });
});
