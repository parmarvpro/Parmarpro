import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EnquiryFormState } from "@/lib/validation/enquiry";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  findEnquiryClinic: vi.fn(),
  websiteEnquiriesToday: vi.fn(),
  createWebsiteLead: vi.fn(),
  reportError: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/server/privileged/enquiry", () => ({
  findEnquiryClinic: mocks.findEnquiryClinic,
  websiteEnquiriesToday: mocks.websiteEnquiriesToday,
  createWebsiteLead: mocks.createWebsiteLead,
}));
vi.mock("@/lib/observability/report", () => ({ reportError: mocks.reportError }));

const { submitEnquiryAction } = await import("@/server/actions/enquiry");

// Synthetic values only. The key is checked by findEnquiryClinic, which is mocked here.
const KEY = "ab".repeat(32);
const CLINIC = { clinicId: "11111111-2222-4333-8444-555555555555", clinicName: "Synthetic Clinic" };

let addressCounter = 0;
/** A new address per submission, so the per-address limit of the module-level limiter never leaks between tests. */
function freshAddress(): string {
  addressCounter += 1;
  return `10.20.${Math.floor(addressCounter / 250)}.${addressCounter % 250}`;
}

function enquiry(overrides: Record<string, string | null> = {}): FormData {
  const values: Record<string, string | null> = {
    fullName: "Synthetic Enquirer",
    phone: "9800000077",
    email: null,
    message: "Synthetic question",
    consent: "on",
    website: "",
    ...overrides,
  };
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) if (value !== null) data.append(name, value);
  return data;
}

async function submit(data: FormData, headers: Record<string, string> = { "x-real-ip": freshAddress() }): Promise<EnquiryFormState> {
  mocks.headers.mockResolvedValue(new Headers(headers));
  return submitEnquiryAction(KEY, { status: "idle" }, data);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findEnquiryClinic.mockResolvedValue(CLINIC);
  mocks.websiteEnquiriesToday.mockResolvedValue(0);
  mocks.createWebsiteLead.mockResolvedValue("99999999-8888-4777-8666-555555555555");
});

describe("submitEnquiryAction", () => {
  it("stores a valid enquiry once, for the clinic the key names, and reports it sent", async () => {
    expect(await submit(enquiry())).toEqual({ status: "sent" });
    expect(mocks.findEnquiryClinic).toHaveBeenCalledWith(KEY);
    expect(mocks.createWebsiteLead).toHaveBeenCalledTimes(1);
    expect(mocks.createWebsiteLead).toHaveBeenCalledWith({
      clinicId: CLINIC.clinicId,
      fullName: "Synthetic Enquirer",
      phone: "+919800000077",
      email: null,
      message: "Synthetic question",
    });
  });

  it("a filled honeypot is reported as sent, and nothing is stored or looked up", async () => {
    expect(await submit(enquiry({ website: "http://spam.example" }))).toEqual({ status: "sent" });
    expect(mocks.findEnquiryClinic).not.toHaveBeenCalled();
    expect(mocks.createWebsiteLead).not.toHaveBeenCalled();
  });

  it("an unknown, switched-off or unpaid key is unavailable, and nothing is stored", async () => {
    mocks.findEnquiryClinic.mockResolvedValueOnce(null);
    expect(await submit(enquiry())).toEqual({ status: "unavailable" });
    expect(mocks.websiteEnquiriesToday).not.toHaveBeenCalled();
    expect(mocks.createWebsiteLead).not.toHaveBeenCalled();
  });

  it("refuses new enquiries once the clinic has reached today's cap, and stores nothing", async () => {
    mocks.websiteEnquiriesToday.mockResolvedValueOnce(50);
    expect(await submit(enquiry())).toEqual({ status: "busy" });
    expect(mocks.createWebsiteLead).not.toHaveBeenCalled();
  });

  it("still accepts an enquiry one below the cap", async () => {
    mocks.websiteEnquiriesToday.mockResolvedValueOnce(49);
    expect(await submit(enquiry())).toEqual({ status: "sent" });
    expect(mocks.createWebsiteLead).toHaveBeenCalledTimes(1);
  });

  it("reports invalid fields per field, without looking the clinic up", async () => {
    const result = await submit(enquiry({ phone: null, email: null }));
    expect(result.status).toBe("invalid");
    if (result.status !== "invalid") throw new Error("expected invalid");
    expect(result.fieldErrors.phone?.[0]).toBe("Add a phone number or an email so the clinic can reply.");
    expect(mocks.findEnquiryClinic).not.toHaveBeenCalled();
    expect(mocks.createWebsiteLead).not.toHaveBeenCalled();
  });

  it("refuses an enquiry without the consent box, and names the consent field", async () => {
    const result = await submit(enquiry({ consent: null }));
    expect(result.status).toBe("invalid");
    if (result.status !== "invalid") throw new Error("expected invalid");
    expect(result.fieldErrors.consent?.[0]).toBe("Tick the box to agree that the clinic may contact you.");
    expect(mocks.createWebsiteLead).not.toHaveBeenCalled();
  });

  it("allows five submissions from one address in ten minutes, then refuses the sixth", async () => {
    const address = "192.0.2.201";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(await submit(enquiry(), { "x-real-ip": address })).toEqual({ status: "sent" });
    }
    expect(await submit(enquiry(), { "x-real-ip": address })).toEqual({ status: "rate_limited" });
    expect(mocks.createWebsiteLead).toHaveBeenCalledTimes(5);
  });

  it("limits by the x-real-ip address first, and uses the first x-forwarded-for address otherwise", async () => {
    const forwarded = "192.0.2.202";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await submit(enquiry(), { "x-forwarded-for": `${forwarded}, 10.0.0.1` });
    }
    expect(await submit(enquiry(), { "x-forwarded-for": `${forwarded}, 10.0.0.9` })).toEqual({ status: "rate_limited" });
    // Another address is not affected by the first one's count.
    expect(await submit(enquiry(), { "x-real-ip": "192.0.2.203", "x-forwarded-for": forwarded })).toEqual({ status: "sent" });
  });

  it("a failure while storing is reported under the enquiry area and shown as an error", async () => {
    mocks.createWebsiteLead.mockRejectedValueOnce(Object.assign(new Error("Failing row contains synthetic"), { code: "23514" }));
    expect(await submit(enquiry())).toEqual({ status: "error" });
    expect(mocks.reportError).toHaveBeenCalledWith(expect.any(Error), { area: "enquiry.form" });
  });

  it("a failure while looking the clinic up is reported and shown as an error, never as unavailable", async () => {
    mocks.findEnquiryClinic.mockRejectedValueOnce(new Error("network"));
    expect(await submit(enquiry())).toEqual({ status: "error" });
    expect(mocks.reportError).toHaveBeenCalledWith(expect.any(Error), { area: "enquiry.form" });
  });
});
