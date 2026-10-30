import { beforeEach, describe, expect, it, vi } from "vitest";

import { OPS_COUNT_KEYS } from "@/lib/ops-counts";
import { countsOnly, opsCounts, recordJobRun } from "@/server/privileged/ops";

const { insert, from, rpc } = vi.hoisted(() => {
  const insert = vi.fn();
  return { insert, from: vi.fn(() => ({ insert })), rpc: vi.fn() };
});

vi.mock("@/server/privileged/client", () => ({
  privilegedDb: () => ({ from, rpc }),
}));

const SINCE = new Date("2026-10-30T03:30:00.000Z");

function zeroCounts(): Record<string, number> {
  return Object.fromEntries(OPS_COUNT_KEYS.map((key) => [key, 0]));
}

function without(key: string): Record<string, number> {
  const counts = zeroCounts();
  delete counts[key];
  return counts;
}

beforeEach(() => {
  insert.mockReset();
  from.mockClear();
  rpc.mockReset();
});

describe("countsOnly", () => {
  it("keeps finite numbers and booleans, and drops strings and other values", () => {
    expect(
      countsOnly({ sent: 2, ok: true, zero: 0, note: "Synthetic Name", nan: Number.NaN, inf: Number.POSITIVE_INFINITY }),
    ).toEqual({ sent: 2, ok: true, zero: 0 });
  });
});

describe("recordJobRun", () => {
  it("inserts one job_runs row with the counts only", async () => {
    insert.mockResolvedValue({ error: null });

    await recordJobRun({
      job: "staff-digest",
      ok: true,
      dryRun: false,
      result: { sent: 2, skipped_empty: 1, note: "Synthetic Clinic Name" },
      durationMs: 12.6,
    });

    expect(from).toHaveBeenCalledWith("job_runs");
    expect(insert).toHaveBeenCalledWith({
      job: "staff-digest",
      ok: true,
      dry_run: false,
      result: { sent: 2, skipped_empty: 1 },
      duration_ms: 13,
    });
  });

  it("never stores a negative or non-finite duration", async () => {
    insert.mockResolvedValue({ error: null });

    await recordJobRun({ job: "staff-digest", ok: false, dryRun: true, result: {}, durationMs: Number.NaN });
    await recordJobRun({ job: "staff-digest", ok: false, dryRun: true, result: {}, durationMs: -4 });

    expect(insert.mock.calls.map(([row]) => row.duration_ms)).toEqual([0, 0]);
  });

  it("throws the database error", async () => {
    insert.mockResolvedValue({ error: { code: "23514", message: "check violated" } });

    await expect(recordJobRun({ job: "staff-digest", ok: true, dryRun: false, result: {}, durationMs: 1 })).rejects.toMatchObject({
      code: "23514",
    });
  });
});

describe("opsCounts", () => {
  it("calls ops_counts with the start time and returns the eleven counts", async () => {
    const data = { ...zeroCounts(), job_runs: 3, ai_calls: 1 };
    rpc.mockResolvedValue({ data, error: null });

    await expect(opsCounts(SINCE)).resolves.toEqual(data);
    expect(rpc).toHaveBeenCalledWith("ops_counts", { p_since: "2026-10-30T03:30:00.000Z" });
  });

  it.each([
    ["an extra key", { ...zeroCounts(), secret: 1 }],
    ["a missing key", without("job_runs")],
    ["a string value", { ...zeroCounts(), job_runs: "3" }],
    ["a negative count", { ...zeroCounts(), job_runs: -1 }],
    ["a fractional count", { ...zeroCounts(), job_runs: 1.5 }],
    ["a null result", null],
  ])("throws on %s", async (_name, data) => {
    rpc.mockResolvedValue({ data, error: null });

    await expect(opsCounts(SINCE)).rejects.toThrow("ops_counts_shape");
  });

  it("throws the database error", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied" } });

    await expect(opsCounts(SINCE)).rejects.toMatchObject({ code: "42501" });
  });
});
