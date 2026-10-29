import { describe, expect, it } from "vitest";

import { enquirySchema } from "@/lib/validation/enquiry";

// Synthetic values only.
const VALID = { fullName: "Synthetic Enquirer", phone: "98000 00077", consent: "on" };

describe("enquirySchema", () => {
  it("accepts a phone number alone, and normalises it to E.164", () => {
    const result = enquirySchema.safeParse(VALID);
    expect(result.success).toBe(true);
    expect(result.data?.phone).toBe("+919800000077");
    expect(result.data?.email).toBeNull();
  });

  it("accepts an email alone, and lower-cases it", () => {
    const result = enquirySchema.safeParse({ fullName: "Synthetic Enquirer", email: "Synthetic.Enquirer@Example.TEST", consent: "on" });
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("synthetic.enquirer@example.test");
    expect(result.data?.phone).toBeNull();
  });

  it("refuses an enquiry with neither a phone number nor an email, and says why", () => {
    const result = enquirySchema.safeParse({ fullName: "Synthetic Enquirer", consent: "on" });
    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((item) => item.path.join(".") === "phone");
    expect(issue?.message).toBe("Add a phone number or an email so the clinic can reply.");
  });

  it("refuses the form until the consent box is ticked", () => {
    expect(enquirySchema.safeParse({ ...VALID, consent: undefined }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...VALID, consent: "off" }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...VALID, consent: "true" }).success).toBe(false);
  });

  it("refuses unknown fields", () => {
    expect(enquirySchema.safeParse({ ...VALID, role: "owner" }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...VALID, clinic_id: "11111111-2222-4333-8444-555555555555" }).success).toBe(false);
  });

  it("needs a name that is not blank", () => {
    expect(enquirySchema.safeParse({ ...VALID, fullName: "   " }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...VALID, fullName: "" }).success).toBe(false);
  });

  it("refuses a phone number that is not a valid Indian or international number", () => {
    expect(enquirySchema.safeParse({ ...VALID, phone: "12345" }).success).toBe(false);
  });

  it("limits the message to 1500 characters, and turns an empty message into null", () => {
    expect(enquirySchema.safeParse({ ...VALID, message: "x".repeat(1500) }).success).toBe(true);
    expect(enquirySchema.safeParse({ ...VALID, message: "x".repeat(1501) }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...VALID, message: "   " }).data?.message).toBeNull();
  });

  it("keeps the honeypot optional, and refuses a value longer than 200 characters", () => {
    expect(enquirySchema.safeParse({ ...VALID, website: "" }).success).toBe(true);
    expect(enquirySchema.safeParse({ ...VALID, website: "x".repeat(200) }).success).toBe(true);
    expect(enquirySchema.safeParse({ ...VALID, website: "x".repeat(201) }).success).toBe(false);
  });
});
