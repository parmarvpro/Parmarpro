import { formatIstDateTime } from "@/lib/ist";

/**
 * One-tap WhatsApp links. Staff open the chat, check the text and press send
 * themselves: nothing is sent automatically. Pure, so it runs in components,
 * server code and tests alike.
 */

const E164 = /^\+[1-9][0-9]{7,14}$/;

/** wa.me link that opens a chat with the number and a prefilled text. Null when the number is not E.164. */
export function whatsappLink(phoneE164: string, text: string): string | null {
  if (!E164.test(phoneE164)) return null;
  const digits = phoneE164.slice(1);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** First word of a full name, for greetings. Names are required to be non-empty. */
export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName.trim();
}

export function appointmentReminderText({
  firstName,
  clinicName,
  startsAt,
}: {
  firstName: string;
  clinicName: string;
  startsAt: Date;
}): string {
  return `Hello ${firstName}, this is a reminder of your appointment at ${clinicName} on ${formatIstDateTime(startsAt)}. Reply here if you need to change it.`;
}

export function inquiryFollowUpText({ firstName, clinicName }: { firstName: string; clinicName: string }): string {
  return `Hello ${firstName}, this is ${clinicName} following up on your enquiry. When would be a good time to talk?`;
}
