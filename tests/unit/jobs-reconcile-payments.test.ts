import { beforeEach, describe, expect, it, vi } from "vitest";

import { reportError } from "@/lib/observability/report";
import type { ProviderPayment } from "@/server/billing/provider";
import type { ReconcileOutcome } from "@/server/billing/reconcile";
import { createReconcilePaymentsJob, reconcilePaymentsJob, type ReconcilePaymentsDeps } from "@/server/jobs/reconcile-payments";
import type { StaleBillingOrder } from "@/server/privileged/jobs";

vi.mock("@/lib/observability/report", () => ({ reportError: vi.fn() }));
// The default wiring must not reach the database. Any call from these tests fails loudly.
vi.mock("@/server/privileged/client", () => ({
  privilegedDb: () => {
    throw new Error("privileged client must not be used in this test");
  },
}));

const NOW = new Date("2026-10-29T20:00:00Z");
const HOUR_MS = 60 * 60 * 1000;
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

function order(overrides: Partial<StaleBillingOrder> = {}): StaleBillingOrder {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    clinic_id: "clinic-a",
    provider_order_id: "order_A1",
    created_at: ago(2 * HOUR_MS),
    ...overrides,
  };
}

function payment(status: ProviderPayment["status"], id = "pay_P1"): ProviderPayment {
  return { id, orderId: "order_A1", status, amountPaise: 8_850_000, currency: "INR", method: "upi", errorCode: null };
}

const PAID: ReconcileOutcome = {
  kind: "paid",
  applied: true,
  paidThrough: "2026-11-29T00:00:00Z",
  planCode: "parmarpro_clinic_monthly",
};

function harness(options: {
  orders?: StaleBillingOrder[];
  payments?: (orderId: string) => ProviderPayment[];
  reconcile?: ReconcileOutcome;
  expired?: boolean;
} = {}) {
  const deps = {
    staleOrders: vi.fn<ReconcilePaymentsDeps["staleOrders"]>(async () => options.orders ?? [order()]),
    fetchOrderPayments: vi.fn<ReconcilePaymentsDeps["fetchOrderPayments"]>(
      async (orderId) => options.payments?.(orderId) ?? [],
    ),
    reconcile: vi.fn<ReconcilePaymentsDeps["reconcile"]>(async () => options.reconcile ?? PAID),
    expireOrder: vi.fn<ReconcilePaymentsDeps["expireOrder"]>(async () => options.expired ?? true),
  };
  return { deps, job: createReconcilePaymentsJob(deps) };
}

beforeEach(() => {
  vi.mocked(reportError).mockClear();
});

describe("reconcile-payments", () => {
  it("reconciles a captured payment through the same path as a webhook and counts it as paid", async () => {
    const { deps, job } = harness({ payments: () => [payment("captured")] });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ paid: 1 });
    expect(deps.fetchOrderPayments).toHaveBeenCalledWith("order_A1");
    expect(deps.reconcile).toHaveBeenCalledWith("pay_P1", { providerOrderId: "order_A1", clinicId: "clinic-a" });
    expect(deps.expireOrder).not.toHaveBeenCalled();
  });

  it("counts a captured payment the reconciler rejects under its outcome", async () => {
    const { job } = harness({
      payments: () => [payment("captured")],
      reconcile: { kind: "mismatch", reason: "amount" },
    });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ reconcile_mismatch: 1 });
  });

  it("expires an old order that has no authorized payment", async () => {
    const { deps, job } = harness({
      orders: [order({ created_at: ago(72 * HOUR_MS) })],
      payments: () => [],
    });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ expired: 1 });
    expect(deps.expireOrder).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
    expect(deps.reconcile).not.toHaveBeenCalled();
  });

  it("counts an order that changed meanwhile as already_changed", async () => {
    const { job } = harness({ orders: [order({ created_at: ago(72 * HOUR_MS) })], expired: false });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ already_changed: 1 });
  });

  it("keeps a young unpaid order pending", async () => {
    const { deps, job } = harness({ orders: [order({ created_at: ago(2 * HOUR_MS) })], payments: () => [] });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ pending: 1 });
    expect(deps.expireOrder).not.toHaveBeenCalled();
  });

  it("keeps an old order pending while a payment is authorized but not captured", async () => {
    const { deps, job } = harness({
      orders: [order({ created_at: ago(72 * HOUR_MS) })],
      payments: () => [payment("authorized")],
    });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ pending: 1 });
    expect(deps.expireOrder).not.toHaveBeenCalled();
    expect(deps.reconcile).not.toHaveBeenCalled();
  });

  it("expires an order whose authorized payment was never captured after seven days", async () => {
    const { deps, job } = harness({
      orders: [order({ created_at: ago(7 * 24 * HOUR_MS + 1000) })],
      payments: () => [payment("authorized")],
    });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ expired: 1 });
    expect(deps.reconcile).not.toHaveBeenCalled();
  });

  it("does not keep an old order open for a failed attempt alone", async () => {
    const { job } = harness({ orders: [order({ created_at: ago(72 * HOUR_MS) })], payments: () => [payment("failed")] });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ expired: 1 });
  });

  it("expires only after more than 48 hours", async () => {
    const atLimit = harness({ orders: [order({ created_at: ago(48 * HOUR_MS) })], payments: () => [] });
    await expect(atLimit.job({ now: NOW, dryRun: false })).resolves.toEqual({ pending: 1 });
    expect(atLimit.deps.expireOrder).not.toHaveBeenCalled();

    const pastLimit = harness({ orders: [order({ created_at: ago(48 * HOUR_MS + 1000) })], payments: () => [] });
    await expect(pastLimit.job({ now: NOW, dryRun: false })).resolves.toEqual({ expired: 1 });
  });

  it("never expires an order whose created_at cannot be read", async () => {
    const { deps, job } = harness({ orders: [order({ created_at: "not-a-date" })], payments: () => [] });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ pending: 1 });
    expect(deps.expireOrder).not.toHaveBeenCalled();
  });

  it("dry run checks nothing at the provider and writes nothing", async () => {
    const { deps, job } = harness({ orders: [order(), order({ id: "22222222-2222-4222-8222-222222222222" })] });
    await expect(job({ now: NOW, dryRun: true })).resolves.toEqual({ would_check: 2 });
    expect(deps.staleOrders).toHaveBeenCalledWith(NOW);
    expect(deps.fetchOrderPayments).not.toHaveBeenCalled();
    expect(deps.reconcile).not.toHaveBeenCalled();
    expect(deps.expireOrder).not.toHaveBeenCalled();
  });

  it("counts a failing order as an error, reports it, and still processes the next order", async () => {
    const { deps, job } = harness({
      orders: [order({ provider_order_id: "order_BAD" }), order({ id: "22222222-2222-4222-8222-222222222222" })],
    });
    deps.fetchOrderPayments.mockImplementation(async (orderId) => {
      if (orderId === "order_BAD") throw new Error("synthetic provider failure");
      return [payment("captured", "pay_OK")];
    });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ errors: 1, paid: 1 });
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { area: "jobs.reconcile-payments" });
    expect(deps.reconcile).toHaveBeenCalledTimes(1);
  });

  it("returns an empty result when no order is stale", async () => {
    const { job } = harness({ orders: [] });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({});
  });

  it("does nothing and reads nothing until Razorpay is configured", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "");
    try {
      await expect(reconcilePaymentsJob({ now: NOW, dryRun: false })).resolves.toEqual({ not_configured: 1 });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
