import { after } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { reportError } from "@/lib/observability/report";
import { scheduleAfter } from "@/server/automations/schedule";

vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/observability/report", () => ({ reportError: vi.fn() }));

const afterMock = vi.mocked(after);

beforeEach(() => {
  afterMock.mockReset();
  vi.mocked(reportError).mockClear();
});

describe("scheduleAfter", () => {
  it("hands the task to after() inside a request, and does not run it itself", async () => {
    const pending: Array<() => unknown> = [];
    afterMock.mockImplementation((callback) => {
      pending.push(callback as () => unknown);
    });
    const task = vi.fn(async () => undefined);
    scheduleAfter(task);
    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(task).not.toHaveBeenCalled();
    await pending[0]?.();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("runs the task now when after() throws because there is no request scope", async () => {
    afterMock.mockImplementation(() => {
      throw new Error("`after` was called outside a request scope");
    });
    const task = vi.fn(async () => undefined);
    scheduleAfter(task);
    await vi.waitFor(() => expect(task).toHaveBeenCalledTimes(1));
  });

  it("reports a failing task under the schedule area and never throws", async () => {
    afterMock.mockImplementation(() => {
      throw new Error("outside request scope");
    });
    const failure = new Error("task failed");
    scheduleAfter(async () => {
      throw failure;
    });
    await vi.waitFor(() => expect(reportError).toHaveBeenCalledWith(failure, { area: "automations.schedule" }));
  });

  it("reports a failing task scheduled with after() too", async () => {
    const pending: Array<() => unknown> = [];
    afterMock.mockImplementation((callback) => {
      pending.push(callback as () => unknown);
    });
    const failure = new Error("task failed");
    scheduleAfter(async () => {
      throw failure;
    });
    await pending[0]?.();
    expect(reportError).toHaveBeenCalledWith(failure, { area: "automations.schedule" });
  });
});
