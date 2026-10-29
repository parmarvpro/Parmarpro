import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRazorpayProvider, RazorpayApiError } from "@/server/billing/razorpay";

// Test-only values, not real credentials.
const KEY_ID = "rzp_test_SyntheticKey01"; // gitleaks:allow synthetic test value
const KEY_SECRET = "synthetic_key_secret_value"; // gitleaks:allow synthetic test value

const PAYMENT = {
  id: "pay_SyntheticPay01",
  order_id: "order_SyntheticOrd1",
  status: "captured",
  amount: 8_850_000,
  currency: "INR",
  method: "upi",
  error_code: null,
};

const fetchMock = vi.fn<typeof fetch>();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  vi.stubEnv("RAZORPAY_KEY_ID", KEY_ID);
  vi.stubEnv("RAZORPAY_KEY_SECRET", KEY_SECRET);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("fetchOrderPayments", () => {
  it("lists the payments of one order with a GET to /orders/{id}/payments, authenticated with the key pair", async () => {
    fetchMock.mockResolvedValue(json({ entity: "collection", count: 1, items: [PAYMENT] }));
    await createRazorpayProvider().fetchOrderPayments("order_SyntheticOrd1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.razorpay.com/v1/orders/order_SyntheticOrd1/payments");
    expect(init?.method).toBeUndefined();
    const expected = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
    expect(new Headers(init?.headers).get("authorization")).toBe(`Basic ${expected}`);
  });

  it("maps every payment the way fetchPayment does", async () => {
    fetchMock.mockResolvedValue(
      json({
        entity: "collection",
        count: 2,
        items: [
          PAYMENT,
          { ...PAYMENT, id: "pay_SyntheticPay02", status: "failed", method: null, error_code: "BAD_REQUEST_ERROR" },
        ],
      }),
    );
    await expect(createRazorpayProvider().fetchOrderPayments("order_SyntheticOrd1")).resolves.toEqual([
      {
        id: "pay_SyntheticPay01",
        orderId: "order_SyntheticOrd1",
        status: "captured",
        amountPaise: 8_850_000,
        currency: "INR",
        method: "upi",
        errorCode: null,
      },
      {
        id: "pay_SyntheticPay02",
        orderId: "order_SyntheticOrd1",
        status: "failed",
        amountPaise: 8_850_000,
        currency: "INR",
        method: null,
        errorCode: "BAD_REQUEST_ERROR",
      },
    ]);
  });

  it("returns an empty list for an order with no payments", async () => {
    fetchMock.mockResolvedValue(json({ entity: "collection", count: 0, items: [] }));
    await expect(createRazorpayProvider().fetchOrderPayments("order_SyntheticOrd1")).resolves.toEqual([]);
  });

  it.each([
    ["a payment id", "pay_SyntheticPay01"],
    ["an empty id", ""],
    ["a path traversal", "order_A/../refunds"],
    ["a query string", "order_A1?count=100"],
    ["a prefix only", "order_"],
  ])("rejects %s before any request is made", async (_name, orderId) => {
    await expect(createRazorpayProvider().fetchOrderPayments(orderId)).rejects.toBeInstanceOf(RazorpayApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports the provider's HTTP status when the request fails", async () => {
    fetchMock.mockResolvedValue(json({ error: { code: "SERVER_ERROR" } }, 500));
    const failure = createRazorpayProvider().fetchOrderPayments("order_SyntheticOrd1");
    await expect(failure).rejects.toBeInstanceOf(RazorpayApiError);
    await expect(failure).rejects.toMatchObject({ status: 500 });
  });

  it("rejects a response whose payments do not match the expected shape", async () => {
    fetchMock.mockResolvedValue(json({ entity: "collection", items: [{ ...PAYMENT, id: "not-a-payment-id" }] }));
    await expect(createRazorpayProvider().fetchOrderPayments("order_SyntheticOrd1")).rejects.toThrow();
  });
});

describe("fetchPayment (unchanged by the order listing)", () => {
  it("still maps a single payment", async () => {
    fetchMock.mockResolvedValue(json(PAYMENT));
    await expect(createRazorpayProvider().fetchPayment("pay_SyntheticPay01")).resolves.toEqual({
      id: "pay_SyntheticPay01",
      orderId: "order_SyntheticOrd1",
      status: "captured",
      amountPaise: 8_850_000,
      currency: "INR",
      method: "upi",
      errorCode: null,
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.razorpay.com/v1/payments/pay_SyntheticPay01");
  });
});
