/**
 * Database-level billing guarantees (docs/security-plan.md §5): a verified
 * payment extends the paid period exactly once, mismatches never grant
 * access, and only the service role can apply payments.
 */
import { randomBytes, randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { admin, asRole, closePool, createClinicFixture, deleteClinicFixture, getPool, type ClinicFixture } from "../helpers/db";

let A: ClinicFixture;
let B: ClinicFixture;

const BASE = 7_500_000;
const GST = 1_350_000;
const TOTAL = BASE + GST;

async function createOrder(clinic: ClinicFixture) {
  const id = randomUUID();
  const providerOrderId = `order_${randomBytes(7).toString("hex")}`;
  await admin(
    `insert into public.billing_orders (id, clinic_id, provider_order_id, plan_code, period_months, base_paise, gst_paise, amount_paise, created_by)
     values ($1, $2, $3, 'parmarpro_clinic_monthly', 1, $4, $5, $6, $7)`,
    [id, clinic.id, providerOrderId, BASE, GST, TOTAL, clinic.owner.userId],
  );
  return { id, providerOrderId };
}

async function paidThrough(clinic: ClinicFixture): Promise<Date | null> {
  const { rows } = await admin<{ paid_through: Date | null }>(
    "select paid_through from public.clinic_entitlements where clinic_id = $1",
    [clinic.id],
  );
  return rows[0]?.paid_through ?? null;
}

/** Calls apply_verified_payment as the service role on its own connection. */
async function apply(orderId: string, providerOrderId: string, paymentId: string, amount = TOTAL, currency = "INR") {
  const client = await getPool().connect();
  try {
    await client.query("set role service_role");
    const { rows } = await client.query<{ r: { applied: boolean; reason?: string } }>(
      "select public.apply_verified_payment($1, $2, $3, $4, $5, 'upi') as r",
      [orderId, providerOrderId, paymentId, amount, currency],
    );
    return rows[0]!.r;
  } finally {
    await client.query("reset role");
    client.release();
  }
}

beforeAll(async () => {
  A = await createClinicFixture("BillA");
  B = await createClinicFixture("BillB");
});

afterAll(async () => {
  await deleteClinicFixture(A);
  await deleteClinicFixture(B);
  await closePool();
});

describe("apply_verified_payment", () => {
  it("BL-02 extends the paid period by one month after the trial", async () => {
    const order = await createOrder(A);
    const { rows } = await admin<{ trial_ends_at: Date }>(
      "select trial_ends_at from public.clinic_entitlements where clinic_id = $1",
      [A.id],
    );
    const trialEnd = rows[0]!.trial_ends_at;
    const result = await apply(order.id, order.providerOrderId, `pay_${randomBytes(7).toString("hex")}`);
    expect(result.applied).toBe(true);
    const through = await paidThrough(A);
    const expected = new Date(trialEnd);
    expected.setUTCMonth(expected.getUTCMonth() + 1);
    expect(Math.abs(through!.getTime() - expected.getTime())).toBeLessThan(5 * 60 * 1000);
  });

  it("BL-03/BL-04 applying the same payment or order twice extends only once", async () => {
    const order = await createOrder(A);
    const paymentId = `pay_${randomBytes(7).toString("hex")}`;
    const first = await apply(order.id, order.providerOrderId, paymentId);
    const before = await paidThrough(A);
    const again = await apply(order.id, order.providerOrderId, paymentId);
    const otherPaymentSameOrder = await apply(order.id, order.providerOrderId, `pay_${randomBytes(7).toString("hex")}`);
    expect(first.applied).toBe(true);
    expect(again).toMatchObject({ applied: false, reason: "already_paid" });
    expect(otherPaymentSameOrder).toMatchObject({ applied: false, reason: "already_paid" });
    expect((await paidThrough(A))!.getTime()).toBe(before!.getTime());
  });

  it("BL-04 concurrent verify-route and webhook application extends exactly once", async () => {
    const order = await createOrder(B);
    const paymentId = `pay_${randomBytes(7).toString("hex")}`;
    const before = await paidThrough(B);
    const results = await Promise.all([
      apply(order.id, order.providerOrderId, paymentId),
      apply(order.id, order.providerOrderId, paymentId),
      apply(order.id, order.providerOrderId, paymentId),
    ]);
    expect(results.filter((r) => r.applied)).toHaveLength(1);
    const after = await paidThrough(B);
    const payments = await admin("select 1 from public.payments where provider_payment_id = $1", [paymentId]);
    expect(payments.rowCount).toBe(1);
    expect(after!.getTime()).toBeGreaterThan(before?.getTime() ?? 0);
  });

  it("BL-05 amount or currency mismatch is rejected without granting access", async () => {
    const order = await createOrder(A);
    const before = await paidThrough(A);
    await expect(apply(order.id, order.providerOrderId, `pay_${randomBytes(7).toString("hex")}`, 100)).rejects.toThrow(
      /mismatch/,
    );
    await expect(
      apply(order.id, order.providerOrderId, `pay_${randomBytes(7).toString("hex")}`, TOTAL, "USD"),
    ).rejects.toThrow(/mismatch/);
    expect((await paidThrough(A))?.getTime()).toBe(before?.getTime());
    const status = await admin<{ status: string }>("select status from public.billing_orders where id = $1", [order.id]);
    expect(status.rows[0]!.status).toBe("created");
  });

  it("BL-06 unknown or mismatched order ids are rejected", async () => {
    await expect(apply(randomUUID(), "order_unknown1", "pay_unknown1")).rejects.toThrow(/unknown order/);
    const order = await createOrder(A);
    await expect(apply(order.id, "order_someoneelse", `pay_${randomBytes(7).toString("hex")}`)).rejects.toThrow(
      /unknown order/,
    );
  });

  it("a payment id already tied to another order cannot pay a second order", async () => {
    const first = await createOrder(A);
    const second = await createOrder(A);
    const paymentId = `pay_${randomBytes(7).toString("hex")}`;
    await apply(first.id, first.providerOrderId, paymentId);
    await expect(apply(second.id, second.providerOrderId, paymentId)).rejects.toThrow(/different order/);
  });

  it("BL-07 failed attempts are recorded without touching entitlement", async () => {
    const order = await createOrder(A);
    const before = await paidThrough(A);
    const client = await getPool().connect();
    try {
      await client.query("set role service_role");
      await client.query(
        "select public.record_payment_attempt($1, $2, $3, 'failed', $4, 'INR', 'card', 'BAD_REQUEST_ERROR')",
        [order.id, order.providerOrderId, `pay_${randomBytes(7).toString("hex")}`, TOTAL],
      );
      await expect(
        client.query("select public.record_payment_attempt($1, $2, $3, 'captured', $4, 'INR')", [
          order.id,
          order.providerOrderId,
          `pay_${randomBytes(7).toString("hex")}`,
          TOTAL,
        ]),
      ).rejects.toThrow(/only authorized or failed/);
    } finally {
      await client.query("reset role");
      client.release();
    }
    expect((await paidThrough(A))?.getTime()).toBe(before?.getTime());
  });

  it("TI-18 the authenticated and anon roles cannot execute it", async () => {
    const order = await createOrder(A);
    for (const role of ["authenticated", "anon"] as const) {
      const result = await asRole(role, role === "authenticated" ? A.owner.claims : null, (q) =>
        q("select public.apply_verified_payment($1, $2, 'pay_x1', $3, 'INR')", [order.id, order.providerOrderId, TOTAL]),
      );
      expect(result.error?.code).toBe("42501");
    }
  });
});
