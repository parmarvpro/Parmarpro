import { beforeEach, describe, expect, it, vi } from "vitest";

import { reserveAiCall, settleAiCall } from "@/server/privileged/ai-usage";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/server/privileged/client", () => ({
  privilegedDb: () => ({ rpc }),
}));

const RESERVE = { lane: "free" as const, model: "gemini-3.5-flash-lite", feature: "ops_note", clinicId: null, estTokens: 42, clinicDailyCap: null };

beforeEach(() => {
  rpc.mockReset();
});

describe("reserveAiCall", () => {
  it("sends every argument, with null sent explicitly for no clinic and no cap", async () => {
    rpc.mockResolvedValue({ data: 7, error: null });

    await expect(reserveAiCall(RESERVE)).resolves.toBe(7);

    expect(rpc).toHaveBeenCalledWith("ai_reserve", {
      p_lane: "free",
      p_model: "gemini-3.5-flash-lite",
      p_feature: "ops_note",
      p_clinic_id: null,
      p_est_tokens: 42,
      p_clinic_daily_cap: null,
    });
    const args = rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(args).toHaveProperty("p_clinic_id", null);
    expect(args).toHaveProperty("p_clinic_daily_cap", null);
  });

  it("passes the clinic and the cap through when they are given", async () => {
    rpc.mockResolvedValue({ data: 8, error: null });
    await reserveAiCall({ ...RESERVE, lane: "paid", clinicId: "00000000-0000-4000-8000-000000000001", clinicDailyCap: 100 });
    expect(rpc).toHaveBeenCalledWith(
      "ai_reserve",
      expect.objectContaining({ p_lane: "paid", p_clinic_id: "00000000-0000-4000-8000-000000000001", p_clinic_daily_cap: 100 }),
    );
  });

  it("returns null when the database refuses the call", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(reserveAiCall(RESERVE)).resolves.toBeNull();
  });

  it("throws the database error", async () => {
    const dbError = { code: "P0001", message: "limit" };
    rpc.mockResolvedValue({ data: null, error: dbError });
    await expect(reserveAiCall(RESERVE)).rejects.toBe(dbError);
  });
});

describe("settleAiCall", () => {
  it("sends the counts when there is usage", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await settleAiCall(7, "ok", { inputTokens: 120, outputTokens: 30, thoughtTokens: 10 });
    expect(rpc).toHaveBeenCalledWith("ai_settle", {
      p_id: 7,
      p_status: "ok",
      p_input_tokens: 120,
      p_output_tokens: 30,
      p_thought_tokens: 10,
    });
  });

  it("sends explicit nulls when there is no usage, so the estimate stays on record", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await settleAiCall(7, "rate_limited", null);
    const args = rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(args).toEqual({ p_id: 7, p_status: "rate_limited", p_input_tokens: null, p_output_tokens: null, p_thought_tokens: null });
    expect(args).toHaveProperty("p_input_tokens", null);
  });

  it("throws the database error", async () => {
    const dbError = { code: "22023", message: "invalid call status" };
    rpc.mockResolvedValue({ data: null, error: dbError });
    await expect(settleAiCall(7, "ok", null)).rejects.toBe(dbError);
  });
});
