import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendEmail } from "@/server/email/send";
import { notifier } from "@/server/privileged/notifications";

// Exercises the default adapter behind notifier(): the claim is an insert into
// notification_log, and a unique violation (23505) means "already claimed".
const db = vi.hoisted(() => {
  const state = {
    insertError: null as { code: string } | null,
    inserted: [] as unknown[],
    deleted: 0,
  };
  const client = {
    from: () => ({
      select: () => ({ gte: async () => ({ count: 0, error: null }) }),
      insert: async (row: unknown) => {
        state.inserted.push(row);
        return { error: state.insertError };
      },
      delete: () => ({
        eq: () => ({
          eq: () => ({
            eq: async () => {
              state.deleted += 1;
              return { error: null };
            },
          }),
        }),
      }),
    }),
  };
  return { state, client };
});

vi.mock("@/server/privileged/client", () => ({ privilegedDb: () => db.client }));
vi.mock("@/server/email/send", () => ({ sendEmail: vi.fn(async () => ({ ok: true, id: "em_1" })) }));
vi.mock("@/lib/observability/report", () => ({ reportError: vi.fn() }));

const PARAMS = {
  kind: "weekly_summary",
  clinicId: "clinic_1",
  subjectKey: "clinic:clinic_1",
  periodKey: "2026-W44",
  to: "owner@example.test",
  content: { subject: "Weekly summary", text: "text", html: "<p>html</p>" },
  dryRun: false,
};

beforeEach(() => {
  // Test-only values, not real credentials.
  vi.stubEnv("RESEND_API_KEY", "re_test_0123456789abcdef");
  vi.stubEnv("EMAIL_FROM", "ParmarPro <hello@example.test>");
  db.state.insertError = null;
  db.state.inserted = [];
  db.state.deleted = 0;
  vi.mocked(sendEmail).mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("default notifier adapter", () => {
  it("treats a unique violation as already claimed: duplicate, and nothing is sent", async () => {
    db.state.insertError = { code: "23505" };
    await expect(notifier().sendOnce(PARAMS)).resolves.toBe("duplicate");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("propagates other database errors and sends nothing", async () => {
    db.state.insertError = { code: "08006" };
    await expect(notifier().sendOnce(PARAMS)).rejects.toMatchObject({ code: "08006" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("claims the period with its key, then sends", async () => {
    await expect(notifier().sendOnce(PARAMS)).resolves.toBe("sent");
    expect(db.state.inserted).toEqual([
      { kind: "weekly_summary", clinic_id: "clinic_1", subject_key: "clinic:clinic_1", period_key: "2026-W44" },
    ]);
    expect(sendEmail).toHaveBeenCalledWith({ to: "owner@example.test", content: PARAMS.content });
    expect(db.state.deleted).toBe(0);
  });

  it("releases the claim when the provider rejects the send", async () => {
    vi.mocked(sendEmail).mockResolvedValueOnce({ ok: false, reason: "rejected" });
    await expect(notifier().sendOnce(PARAMS)).resolves.toBe("failed");
    expect(db.state.deleted).toBe(1);
  });
});
