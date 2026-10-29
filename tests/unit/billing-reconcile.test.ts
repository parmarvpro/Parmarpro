import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { reportError } from "@/lib/observability/report";
import type { ProviderPayment } from "@/server/billing/provider";
import { reconcilePayment, type BillingOrderRecord, type ReconcileDeps } from "@/server/billing/reconcile";

vi.mock("@/lib/observability/report", () => ({ reportError: vi.fn() }));

const ORDER: BillingOrderRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  clinic_id: "clinic-a",
  provider_order_id: "order_A1",
  amount_paise: 8_850_000,
  currency: "INR",
  plan_code: "parmarpro_clinic_monthly",
  status: "created",
};

function payment(overrides: Partial<ProviderPayment> = {}): ProviderPayment {
  return { id: "pay_P1", orderId: "order_A1", status: "captured", amountPaise: 8_850_000, currency: "INR", method: "upi", errorCode: null, ...overrides };
}

let deps: ReconcileDeps & { applyPayment: Mock<ReconcileDeps["applyPayment"]>; recordAttempt: Mock<ReconcileDeps["recordAttempt"]> };

beforeEach(() => {
  deps = {
    provider: { fetchPayment: vi.fn(async () => payment()) },
    findOrder: vi.fn(async (id: string) => (id === ORDER.provider_order_id ? ORDER : null)),
    applyPayment: vi.fn<ReconcileDeps["applyPayment"]>(async () => ({ applied: true, paidThrough: "2026-12-28T00:00:00Z" })),
    recordAttempt: vi.fn<ReconcileDeps["recordAttempt"]>(async () => undefined),
  };
});

describe("reconcilePayment", () => {
  it("BL-02 captured payment for our order with the right amount is applied", async () => {
    await expect(reconcilePayment("pay_P1", {}, deps)).resolves.toMatchObject({ kind: "paid", applied: true });
    expect(deps.applyPayment).toHaveBeenCalledWith(expect.objectContaining({ billingOrderId: ORDER.id, amountPaise: 8_850_000, currency: "INR" }));
  });

  it("BL-05 amount mismatch grants nothing", async () => {
    deps.provider.fetchPayment = vi.fn(async () => payment({ amountPaise: 100 }));
    await expect(reconcilePayment("pay_P1", {}, deps)).resolves.toEqual({ kind: "mismatch", reason: "amount" });
    expect(deps.applyPayment).not.toHaveBeenCalled();
  });

  it("BL-05 currency mismatch grants nothing", async () => {
    deps.provider.fetchPayment = vi.fn(async () => payment({ currency: "USD" }));
    await expect(reconcilePayment("pay_P1", {}, deps)).resolves.toEqual({ kind: "mismatch", reason: "currency" });
    expect(deps.applyPayment).not.toHaveBeenCalled();
  });

  it("BL-06 payment for an order ParmarPro did not create is ignored", async () => {
    deps.provider.fetchPayment = vi.fn(async () => payment({ orderId: "order_FOREIGN" }));
    await expect(reconcilePayment("pay_P1", {}, deps)).resolves.toEqual({ kind: "not_found" });
    expect(deps.applyPayment).not.toHaveBeenCalled();
  });

  it("BL-07 failed payment is recorded without access", async () => {
    deps.provider.fetchPayment = vi.fn(async () => payment({ status: "failed", errorCode: "BAD_REQUEST_ERROR" }));
    await expect(reconcilePayment("pay_P1", {}, deps)).resolves.toEqual({ kind: "failed" });
    expect(deps.recordAttempt).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", errorCode: "BAD_REQUEST_ERROR" }));
    expect(deps.applyPayment).not.toHaveBeenCalled();
  });

  it("BL-08 authorized but not captured stays pending", async () => {
    deps.provider.fetchPayment = vi.fn(async () => payment({ status: "authorized" }));
    await expect(reconcilePayment("pay_P1", {}, deps)).resolves.toEqual({ kind: "pending" });
    expect(deps.applyPayment).not.toHaveBeenCalled();
  });

  it("refunded payments never grant access", async () => {
    deps.provider.fetchPayment = vi.fn(async () => payment({ status: "refunded" }));
    await expect(reconcilePayment("pay_P1", {}, deps)).resolves.toEqual({ kind: "ignored", reason: "refunded" });
    expect(deps.applyPayment).not.toHaveBeenCalled();
  });

  it("BL-11 an order of another clinic is treated as not found", async () => {
    await expect(reconcilePayment("pay_P1", { clinicId: "clinic-b" }, deps)).resolves.toEqual({ kind: "not_found" });
    expect(deps.applyPayment).not.toHaveBeenCalled();
  });

  it("a callback whose payment belongs to a different order is a mismatch", async () => {
    await expect(reconcilePayment("pay_P1", { providerOrderId: "order_OTHER" }, deps)).resolves.toEqual({ kind: "mismatch", reason: "order" });
    expect(deps.findOrder).not.toHaveBeenCalled();
  });
});

describe("reconcilePayment: onPaymentApplied", () => {
  const APPLIED_THROUGH = "2026-12-28T00:00:00Z";

  beforeEach(() => {
    vi.mocked(reportError).mockClear();
  });

  it("is called once with the payment details when this call applies the payment", async () => {
    const onPaymentApplied = vi.fn(async () => undefined);
    await expect(reconcilePayment("pay_P1", {}, { ...deps, onPaymentApplied })).resolves.toMatchObject({ kind: "paid", applied: true });
    expect(onPaymentApplied).toHaveBeenCalledTimes(1);
    expect(onPaymentApplied).toHaveBeenCalledWith({
      clinicId: ORDER.clinic_id,
      providerPaymentId: "pay_P1",
      amountPaise: 8_850_000,
      paidThrough: APPLIED_THROUGH,
    });
  });

  it("is not called when the payment was already applied by an earlier delivery", async () => {
    deps.applyPayment = vi.fn<ReconcileDeps["applyPayment"]>(async () => ({ applied: false, paidThrough: APPLIED_THROUGH }));
    const onPaymentApplied = vi.fn(async () => undefined);
    await expect(reconcilePayment("pay_P1", {}, { ...deps, onPaymentApplied })).resolves.toEqual({
      kind: "paid",
      applied: false,
      paidThrough: APPLIED_THROUGH,
      planCode: ORDER.plan_code,
    });
    expect(onPaymentApplied).not.toHaveBeenCalled();
  });

  it("a failing hook never changes the outcome, and the failure is reported under billing.receipt", async () => {
    const failure = new Error("receipt failed");
    const onPaymentApplied = vi.fn(async () => {
      throw failure;
    });
    await expect(reconcilePayment("pay_P1", {}, { ...deps, onPaymentApplied })).resolves.toEqual({
      kind: "paid",
      applied: true,
      paidThrough: APPLIED_THROUGH,
      planCode: ORDER.plan_code,
    });
    expect(reportError).toHaveBeenCalledWith(failure, { area: "billing.receipt" });
  });
});
