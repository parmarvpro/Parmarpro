import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermission = vi.fn();
const recordBillingOrder = vi.fn();
const recentOpenOrderCount = vi.fn(async () => 0);
const findBillingOrder = vi.fn();
const applyPayment = vi.fn(async () => ({ applied: true, paidThrough: "2026-12-28T00:00:00Z" }));

vi.mock("@/server/auth/context", () => ({ requirePermission: (p: string) => requirePermission(p) }));
vi.mock("@/server/billing/razorpay", () => ({ createRazorpayProvider: () => { throw new Error("tests pass a provider"); } }));
vi.mock("@/server/privileged/billing", () => ({
  recordBillingOrder: (row: unknown) => recordBillingOrder(row),
  recentOpenOrderCount: () => recentOpenOrderCount(),
  reconcileStore: {
    findOrder: (id: string) => findBillingOrder(id),
    applyPayment: () => applyPayment(),
    recordAttempt: vi.fn(),
  },
}));

const { startCheckout, verifyCheckout } = await import("@/server/billing/checkout");
const { AppError } = await import("@/server/auth/errors");

const SECRET = "test_secret";
const provider = {
  name: "razorpay" as const,
  publicKeyId: () => "rzp_test_abc",
  createOrder: vi.fn(async ({ amountPaise }: { amountPaise: number }) => ({ id: "order_NEW1", amountPaise, currency: "INR", receipt: null })),
  fetchPayment: vi.fn(async (id: string) => ({ id, orderId: "order_A1", status: "captured" as const, amountPaise: 8_850_000, currency: "INR", method: "card", errorCode: null })),
  fetchOrderPayments: vi.fn(async () => []),
  verifyCheckoutSignature: ({ orderId, paymentId, signature }: { orderId: string; paymentId: string; signature: string }) =>
    createHmac("sha256", SECRET).update(`${orderId}|${paymentId}`).digest("hex") === signature,
};

beforeEach(() => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue({ clinicId: "clinic-a", userId: "user_owner", clinicName: "Synthetic Clinic" });
  findBillingOrder.mockResolvedValue({ id: "o1", clinic_id: "clinic-a", provider_order_id: "order_A1", amount_paise: 8_850_000, currency: "INR", plan_code: "parmarpro_clinic_monthly", status: "created" });
});

describe("startCheckout", () => {
  it("BL-12 charges the server-side price (₹75,000 + 18% GST) and records the order", async () => {
    const order = await startCheckout(provider);
    expect(requirePermission).toHaveBeenCalledWith("billing:pay");
    expect(provider.createOrder).toHaveBeenCalledWith(expect.objectContaining({ amountPaise: 8_850_000, currency: "INR" }));
    expect(recordBillingOrder).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-a", basePaise: 7_500_000, gstPaise: 1_350_000, amountPaise: 8_850_000 }));
    expect(order).toMatchObject({ keyId: "rzp_test_abc", orderId: "order_NEW1", amountPaise: 8_850_000 });
  });

  it("BL-13 non-owners are rejected before any order is created", async () => {
    requirePermission.mockRejectedValue(new AppError("forbidden"));
    await expect(startCheckout(provider)).rejects.toMatchObject({ code: "forbidden" });
    expect(provider.createOrder).not.toHaveBeenCalled();
  });

  it("limits repeated unpaid orders", async () => {
    recentOpenOrderCount.mockResolvedValueOnce(10);
    await expect(startCheckout(provider)).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("refuses to record an order whose amount the provider changed", async () => {
    provider.createOrder.mockResolvedValueOnce({ id: "order_X", amountPaise: 1, currency: "INR", receipt: null });
    await expect(startCheckout(provider)).rejects.toMatchObject({ code: "internal" });
    expect(recordBillingOrder).not.toHaveBeenCalled();
  });
});

describe("verifyCheckout", () => {
  const signature = createHmac("sha256", SECRET).update("order_A1|pay_P1").digest("hex");

  it("BL-10 a bad signature is rejected without contacting the provider", async () => {
    await expect(verifyCheckout({ orderId: "order_A1", paymentId: "pay_P1", signature: "0".repeat(64) }, provider)).rejects.toMatchObject({ code: "invalid_input" });
    expect(provider.fetchPayment).not.toHaveBeenCalled();
    expect(applyPayment).not.toHaveBeenCalled();
  });

  it("a valid callback is reconciled with the provider before access is granted", async () => {
    await expect(verifyCheckout({ orderId: "order_A1", paymentId: "pay_P1", signature }, provider)).resolves.toMatchObject({ kind: "paid" });
    expect(provider.fetchPayment).toHaveBeenCalledWith("pay_P1");
    expect(applyPayment).toHaveBeenCalledTimes(1);
  });

  it("BL-11 another clinic's order cannot be verified", async () => {
    findBillingOrder.mockResolvedValue({ id: "o1", clinic_id: "clinic-b", provider_order_id: "order_A1", amount_paise: 8_850_000, currency: "INR", plan_code: "parmarpro_clinic_monthly", status: "created" });
    await expect(verifyCheckout({ orderId: "order_A1", paymentId: "pay_P1", signature }, provider)).resolves.toEqual({ kind: "not_found" });
    expect(applyPayment).not.toHaveBeenCalled();
  });

  it("BL-13 non-owners cannot verify payments", async () => {
    requirePermission.mockRejectedValue(new AppError("forbidden"));
    await expect(verifyCheckout({ orderId: "order_A1", paymentId: "pay_P1", signature }, provider)).rejects.toMatchObject({ code: "forbidden" });
  });
});
