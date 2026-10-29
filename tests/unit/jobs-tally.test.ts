import { beforeEach, describe, expect, it, vi } from "vitest";

import { reportError } from "@/lib/observability/report";
import { createTally, forEachItem } from "@/server/jobs/tally";

vi.mock("@/lib/observability/report", () => ({ reportError: vi.fn() }));

beforeEach(() => {
  vi.mocked(reportError).mockClear();
});

describe("createTally", () => {
  it("counts each outcome and returns only numbers", () => {
    const tally = createTally();
    tally.add("sent");
    tally.add("sent");
    tally.add("skipped_no_email");
    expect(tally.result()).toEqual({ sent: 2, skipped_no_email: 1 });
  });

  it("is empty before anything is added", () => {
    expect(createTally().result()).toEqual({});
  });
});

describe("forEachItem", () => {
  it("runs the rest of the items after one fails, counts the failure and reports it under the job's area", async () => {
    const tally = createTally();
    const processed: string[] = [];
    await forEachItem(["a", "b", "c"], tally, "jobs.example", async (item) => {
      if (item === "b") throw new Error("synthetic failure");
      processed.push(item);
      tally.add("ok");
    });
    expect(processed).toEqual(["a", "c"]);
    expect(tally.result()).toEqual({ ok: 2, errors: 1 });
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { area: "jobs.example" });
  });

  it("does nothing for an empty list", async () => {
    const tally = createTally();
    await forEachItem([], tally, "jobs.example", async () => {
      throw new Error("never called");
    });
    expect(tally.result()).toEqual({});
    expect(reportError).not.toHaveBeenCalled();
  });
});
