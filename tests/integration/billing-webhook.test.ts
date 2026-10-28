/**
 * Integration: Razorpay webhook processing with the real privileged store
 * (service role -> PostgREST -> PostgreSQL). Only the Razorpay API is faked.
 */
import { createHmac, randomBytes, randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { admin, closePool, createClinicFixture, deleteClinicFixture, type ClinicFixture } from "../helpers/db";
import { mintToken } from "../helpers/jwt";
import { startRestProxy } from "../helpers/rest-proxy";

vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: null }), clerkClient: async () => ({}) }));

const SECRET = "whsec_integration_only";
let A: ClinicFixture;
let proxy: Awaited<ReturnType<typeof startRestProxy>>;
let billing: typeof import("@/server/privileged/billing");
let processor: typeof import("@/server/billing/webhook-processor");
let reconcileModule: typeof import("@/server/billing/reconcile");

beforeAll(async () => {
  proxy = await startRestProxy();
  process.env.SUPABASE_URL = proxy.url;
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_local_integration_tests";
  // Locally minted service_role token stands in for the Supabase secret key.
  process.env.SUPABASE_SECRET_KEY = await mintToken({ role: "service_role" }, { expiresIn: "1h" });
  billing = await import("@/server/privileged/billing");
  processor = await import("@/server/billing/webhook-processor");
  reconcileModule = await import("@/server/billing/reconcile");
  A = await createClinicFixture("Hook");
});

afterAll(async () => {
  await admin("delete from public.webhook_events where event_id like 'evt_it_%'");
  await deleteClinicFixture(A);
  await closePool();
  await proxy.close();
});

async function newOrder() {
  const id = randomUUID();
  const providerOrderId = `order_${randomBytes(6).toString("hex")}`;
  await billing.recordBillingOrder({
    id,
    clinicId: A.id,
    providerOrderId,
    planCode: "parmarpro_clinic_monthly",
    basePaise: 7_500_000,
    gstPaise: 1_350_000,
    amountPaise: 8_850_000,
    createdBy: A.owner.userId,
  });
  return { id, providerOrderId };
}

function fakeProvider(orderId: string, overrides: Record<string, unknown> = {}) {
  return {
    fetchPayment: async (id: string) => ({
      id,
      orderId,
      status: "captured" as const,
      amountPaise: 8_850_000,
      currency: "INR",
      method: "upi",
      errorCode: null,
      ...overrides,
    }),
  };
}

function signedDelivery(event: string, paymentId: string) {
  const rawBody = JSON.stringify({ event, payload: { payment: { entity: { id: paymentId } } } });
  return {
    rawBody,
    signature: createHmac("sha256", SECRET).update(rawBody).digest("hex"),
    eventId: `evt_it_${randomBytes(6).toString("hex")}`,
  };
}

async function paidThrough() {
  const { rows } = await admin<{ paid_through: Date | null }>("select paid_through from public.clinic_entitlements where clinic_id = $1", [A.id]);
  return rows[0]?.paid_through?.getTime() ?? null;
}

describe("webhook processing against the database", () => {
  it("applies a captured payment once, and a redelivery is a duplicate", async () => {
    const order = await newOrder();
    const paymentId = `pay_${randomBytes(6).toString("hex")}`;
    const deps = {
      webhookSecret: SECRET,
      store: billing.webhookStore("razorpay"),
      reconcile: { provider: fakeProvider(order.providerOrderId), ...billing.reconcileStore },
    };
    const delivery = signedDelivery("payment.captured", paymentId);
    const before = await paidThrough();
    await expect(processor.processRazorpayWebhook(delivery, deps)).resolves.toEqual({ status: 200, outcome: "paid" });
    const after = await paidThrough();
    expect(after).not.toBe(before);
    await expect(processor.processRazorpayWebhook(delivery, deps)).resolves.toEqual({ status: 200, outcome: "duplicate" });
    expect(await paidThrough()).toBe(after);
    const event = await admin<{ status: string }>("select status from public.webhook_events where event_id = $1", [delivery.eventId]);
    expect(event.rows[0]!.status).toBe("processed");
  });

  it("payment.captured + order.paid + browser verify racing extend the period exactly once", async () => {
    const order = await newOrder();
    const paymentId = `pay_${randomBytes(6).toString("hex")}`;
    const reconcile = { provider: fakeProvider(order.providerOrderId), ...billing.reconcileStore };
    const deps = { webhookSecret: SECRET, store: billing.webhookStore("razorpay"), reconcile };
    const before = await paidThrough();
    const results = await Promise.all([
      processor.processRazorpayWebhook(signedDelivery("payment.captured", paymentId), deps),
      processor.processRazorpayWebhook(signedDelivery("order.paid", paymentId), deps),
      reconcileModule.reconcilePayment(paymentId, { providerOrderId: order.providerOrderId, clinicId: A.id }, reconcile),
    ]);
    expect(results.filter((r) => "outcome" in r && r.outcome === "paid").length + results.filter((r) => "kind" in r && r.kind === "paid").length).toBe(3);
    const applied = await admin<{ n: string }>(
      "select count(*)::text n from public.activity_events where entity_id = $1 and action = 'payment_applied'",
      [order.id],
    );
    expect(applied.rows[0]!.n).toBe("1");
    const months = before === null ? null : Math.round(((await paidThrough())! - before) / (24 * 3600 * 1000));
    expect(months === null || (months >= 28 && months <= 31)).toBe(true);
  });

  it("a wrong amount from the provider never grants access and is recorded as failed", async () => {
    const order = await newOrder();
    const before = await paidThrough();
    const deps = {
      webhookSecret: SECRET,
      store: billing.webhookStore("razorpay"),
      reconcile: { provider: fakeProvider(order.providerOrderId, { amountPaise: 100 }), ...billing.reconcileStore },
    };
    const delivery = signedDelivery("payment.captured", `pay_${randomBytes(6).toString("hex")}`);
    await expect(processor.processRazorpayWebhook(delivery, deps)).resolves.toEqual({ status: 200, outcome: "mismatch" });
    expect(await paidThrough()).toBe(before);
    const status = await admin<{ status: string }>("select status from public.billing_orders where id = $1", [order.id]);
    expect(status.rows[0]!.status).toBe("created");
  });

  it("a payment for an unknown order is ignored", async () => {
    const deps = {
      webhookSecret: SECRET,
      store: billing.webhookStore("razorpay"),
      reconcile: { provider: fakeProvider("order_notours123"), ...billing.reconcileStore },
    };
    const delivery = signedDelivery("payment.captured", `pay_${randomBytes(6).toString("hex")}`);
    await expect(processor.processRazorpayWebhook(delivery, deps)).resolves.toEqual({ status: 200, outcome: "unknown_order" });
  });
});
