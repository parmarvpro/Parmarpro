import { describe, expect, it, vi, type Mock } from "vitest";

import type { PaymentApplied } from "@/server/billing/reconcile";
import { createPaymentReceipts, type ReceiptDeps } from "@/server/automations/receipts";
import type { Recipient } from "@/server/email/recipients";

vi.mock("@/server/privileged/client", () => ({
  privilegedDb: () => {
    throw new Error("privileged client must not be used in this test");
  },
}));

const CLINIC_ID = "9b1f7c2e-4a3d-4e5f-8a6b-1c2d3e4f5a6b";
const NOW = new Date("2026-10-29T20:00:00Z");
const PAID_THROUGH = "2026-11-28T18:29:59.999Z";

const INFO: PaymentApplied = {
  clinicId: CLINIC_ID,
  providerPaymentId: "pay_SyntheticReceipt01",
  amountPaise: 8_850_000,
  paidThrough: PAID_THROUGH,
};

type Harness = ReceiptDeps & {
  owners: Mock<ReceiptDeps["owners"]>;
  lookup: Mock<ReceiptDeps["lookup"]>;
  sendOnce: Mock<ReceiptDeps["sendOnce"]>;
  report: Mock<ReceiptDeps["report"]>;
};

function harness(
  options: {
    owners?: { clinicName: string; ownerUserIds: string[] } | null;
    recipients?: Array<[string, Recipient]>;
    sendError?: Error;
    lookupError?: Error;
  } = {},
): Harness {
  const owners = options.owners === undefined ? { clinicName: "Synthetic Dental", ownerUserIds: ["user_a", "user_b"] } : options.owners;
  const recipients = options.recipients ?? [
    ["user_a", { email: "a@example.test", firstName: "Asha" }],
    ["user_b", { email: "b@example.test", firstName: "Bala" }],
  ];
  const deps: Harness = {
    owners: vi.fn(async () => owners),
    lookup: vi.fn(async () => {
      if (options.lookupError) throw options.lookupError;
      return new Map(recipients);
    }),
    sendOnce: vi.fn<ReceiptDeps["sendOnce"]>(async () => {
      if (options.sendError) throw options.sendError;
      return "sent";
    }),
    report: vi.fn(),
    now: () => NOW,
  };
  return deps;
}

describe("payment receipts", () => {
  it("sends one receipt to each owner that has an email address", async () => {
    const deps = harness();
    await createPaymentReceipts(deps)(INFO);
    expect(deps.owners).toHaveBeenCalledWith(CLINIC_ID);
    expect(deps.lookup).toHaveBeenCalledWith(["user_a", "user_b"]);
    expect(deps.sendOnce.mock.calls.map(([params]) => params.to)).toEqual(["a@example.test", "b@example.test"]);
  });

  it("keys each receipt by the payment and the owner, so a repeat cannot send a second copy", async () => {
    const deps = harness();
    await createPaymentReceipts(deps)(INFO);
    const keys = deps.sendOnce.mock.calls.map(([params]) => ({
      kind: params.kind,
      clinicId: params.clinicId,
      subjectKey: params.subjectKey,
      periodKey: params.periodKey,
      dryRun: params.dryRun,
    }));
    expect(keys).toEqual([
      { kind: "payment_receipt", clinicId: CLINIC_ID, subjectKey: "pay_SyntheticReceipt01:user_a", periodKey: "once", dryRun: false },
      { kind: "payment_receipt", clinicId: CLINIC_ID, subjectKey: "pay_SyntheticReceipt01:user_b", periodKey: "once", dryRun: false },
    ]);
  });

  it("states the amount, the paid-through date and the reference", async () => {
    const deps = harness();
    await createPaymentReceipts(deps)(INFO);
    const [params] = deps.sendOnce.mock.calls[0] ?? [];
    expect(params?.content.subject).toBe("Payment received for Synthetic Dental");
    expect(params?.content.text).toContain("Amount paid: ₹88,500");
    expect(params?.content.text).toContain("Paid through: 28 Nov 2026");
    expect(params?.content.text).toContain("Payment reference: pay_SyntheticReceipt01");
  });

  it("uses the payment time as the paid-through date when the provider gave none", async () => {
    const deps = harness();
    await createPaymentReceipts(deps)({ ...INFO, paidThrough: null });
    const [params] = deps.sendOnce.mock.calls[0] ?? [];
    expect(params?.content.text).toContain("Paid through: 30 Oct 2026");
  });

  it("owners without an email address are skipped", async () => {
    const deps = harness({ recipients: [["user_a", { email: "a@example.test", firstName: "Asha" }]] });
    await createPaymentReceipts(deps)(INFO);
    expect(deps.sendOnce.mock.calls.map(([params]) => params.subjectKey)).toEqual(["pay_SyntheticReceipt01:user_a"]);
  });

  it("does nothing when the clinic has no owners or does not exist", async () => {
    const noOwners = harness({ owners: { clinicName: "Synthetic Dental", ownerUserIds: [] } });
    await createPaymentReceipts(noOwners)(INFO);
    expect(noOwners.lookup).not.toHaveBeenCalled();
    expect(noOwners.sendOnce).not.toHaveBeenCalled();

    const missing = harness({ owners: null });
    await createPaymentReceipts(missing)(INFO);
    expect(missing.lookup).not.toHaveBeenCalled();
    expect(missing.sendOnce).not.toHaveBeenCalled();
  });

  it("one owner's failure is reported and the other owner still gets a receipt", async () => {
    const deps = harness({ sendError: new Error("provider unavailable") });
    await expect(createPaymentReceipts(deps)(INFO)).resolves.toBeUndefined();
    expect(deps.sendOnce).toHaveBeenCalledTimes(2);
    expect(deps.report).toHaveBeenCalledTimes(2);
    expect(deps.report).toHaveBeenCalledWith(expect.any(Error), { area: "automations.receipt" });
  });

  it("a failed lookup is reported under the receipt area and nothing is sent", async () => {
    const deps = harness({ lookupError: new Error("clerk unavailable") });
    await expect(createPaymentReceipts(deps)(INFO)).resolves.toBeUndefined();
    expect(deps.sendOnce).not.toHaveBeenCalled();
    expect(deps.report).toHaveBeenCalledWith(expect.any(Error), { area: "automations.receipt" });
  });
});
