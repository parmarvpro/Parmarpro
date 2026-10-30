import { describe, expect, it, vi, type Mock } from "vitest";

import type { Recipient } from "@/server/email/recipients";
import { createWelcomeSender, type WelcomeDeps } from "@/server/automations/welcome";

vi.mock("@/server/privileged/client", () => ({
  privilegedDb: () => {
    throw new Error("privileged client must not be used in this test");
  },
}));

const CLINIC_ID = "9b1f7c2e-4a3d-4e5f-8a6b-1c2d3e4f5a6b";
const USER_ID = "user_owner_synthetic";

type Harness = WelcomeDeps & {
  lookup: Mock<WelcomeDeps["lookup"]>;
  sendOnce: Mock<WelcomeDeps["sendOnce"]>;
  report: Mock<WelcomeDeps["report"]>;
};

function harness(options: { recipient?: Recipient | null; error?: Error } = {}): Harness {
  const recipient = options.recipient === undefined ? { email: "owner@example.test", firstName: "Synthetic" } : options.recipient;
  const deps: Harness = {
    lookup: vi.fn(async () => new Map(recipient ? [[USER_ID, recipient]] : [])),
    sendOnce: vi.fn<WelcomeDeps["sendOnce"]>(async () => {
      if (options.error) throw options.error;
      return "sent";
    }),
    report: vi.fn(),
  };
  return deps;
}

const PARAMS = { clinicId: CLINIC_ID, userId: USER_ID, clinicName: "Synthetic Dental" };

describe("welcome email", () => {
  it("is sent once to the creating user, keyed by the clinic", async () => {
    const deps = harness();
    await createWelcomeSender(deps)(PARAMS);
    expect(deps.lookup).toHaveBeenCalledWith([USER_ID]);
    expect(deps.sendOnce).toHaveBeenCalledTimes(1);
    const [params] = deps.sendOnce.mock.calls[0] ?? [];
    expect(params).toMatchObject({
      kind: "welcome",
      clinicId: CLINIC_ID,
      subjectKey: CLINIC_ID,
      periodKey: "once",
      to: "owner@example.test",
      dryRun: false,
    });
  });

  it("names the clinic in the body, and greets by first name", async () => {
    const deps = harness();
    await createWelcomeSender(deps)(PARAMS);
    const [params] = deps.sendOnce.mock.calls[0] ?? [];
    expect(params?.content.subject).toBe("Welcome to ParmarPro");
    expect(params?.content.text).toContain("Hi Synthetic,");
    expect(params?.content.text).toContain("Your clinic, Synthetic Dental, is set up and ready to use.");
    expect(params?.content.text).not.toContain("trial");
  });

  it("is not sent when the creating user has no email address", async () => {
    const deps = harness({ recipient: null });
    await createWelcomeSender(deps)(PARAMS);
    expect(deps.sendOnce).not.toHaveBeenCalled();
  });

  it("failures are reported under the welcome area and never thrown", async () => {
    const deps = harness({ error: new Error("provider unavailable") });
    await expect(createWelcomeSender(deps)(PARAMS)).resolves.toBeUndefined();
    expect(deps.report).toHaveBeenCalledWith(expect.any(Error), { area: "automations.welcome" });
  });

  it("a failed lookup is reported and nothing is sent", async () => {
    const deps = harness();
    deps.lookup = vi.fn(async () => {
      throw new Error("clerk unavailable");
    });
    await expect(createWelcomeSender(deps)(PARAMS)).resolves.toBeUndefined();
    expect(deps.sendOnce).not.toHaveBeenCalled();
    expect(deps.report).toHaveBeenCalledWith(expect.any(Error), { area: "automations.welcome" });
  });
});
