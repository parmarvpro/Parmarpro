import { describe, expect, it } from "vitest";

import { formatIstDateTime } from "@/lib/ist";
import { appointmentReminderText, firstNameOf, inquiryFollowUpText, whatsappLink } from "@/lib/whatsapp";

describe("whatsappLink", () => {
  it("opens the chat with the digits of an E.164 number", () => {
    expect(whatsappLink("+919800000001", "Hi")).toBe("https://wa.me/919800000001?text=Hi");
  });

  it("encodes the text so spaces, ampersands, question marks and rupee signs survive", () => {
    expect(whatsappLink("+919800000001", "A & B? 10:30 ₹")).toBe("https://wa.me/919800000001?text=A%20%26%20B%3F%2010%3A30%20%E2%82%B9");
  });

  it("returns null for anything that is not an E.164 number", () => {
    // Synthetic values only.
    for (const bad of ["9800000001", "+91 98000 00001", "+0919800000001", "+91abc", "", "+1234567", "+9198000000012345678"]) {
      expect(whatsappLink(bad, "text")).toBeNull();
    }
  });
});

describe("firstNameOf", () => {
  it("takes the first word of the name, ignoring extra spaces", () => {
    expect(firstNameOf("  Asha   Verma ")).toBe("Asha");
    expect(firstNameOf("Asha")).toBe("Asha");
  });
});

describe("message texts", () => {
  it("writes the appointment reminder in IST, with the clinic name", () => {
    const startsAt = new Date("2026-10-30T05:00:00Z"); // 10:30 in India
    expect(formatIstDateTime(startsAt)).toMatch(/30 Oct,? 2026/);
    expect(formatIstDateTime(startsAt)).toMatch(/10:30/);
    expect(appointmentReminderText({ firstName: "Asha", clinicName: "Synthetic Clinic", startsAt })).toBe(
      `Hello Asha, this is a reminder of your appointment at Synthetic Clinic on ${formatIstDateTime(startsAt)}. Reply here if you need to change it.`,
    );
  });

  it("writes the enquiry follow-up", () => {
    expect(inquiryFollowUpText({ firstName: "Ravi", clinicName: "Synthetic Clinic" })).toBe(
      "Hello Ravi, this is Synthetic Clinic following up on your enquiry. When would be a good time to talk?",
    );
  });
});
