import { describe, expect, it, vi } from "vitest";

import { createRecipientLookup, type GetUserList, type RecipientUser } from "@/server/email/recipients";

function user(id: string, overrides: Partial<RecipientUser> = {}): RecipientUser {
  return {
    id,
    firstName: "Test",
    primaryEmailAddressId: `${id}-primary`,
    emailAddresses: [{ id: `${id}-primary`, emailAddress: `${id}@example.test` }],
    ...overrides,
  };
}

/** A fake Clerk list endpoint that answers only the ids it is asked for, like the real filter. */
function fakeClerk(users: RecipientUser[]) {
  return vi.fn<GetUserList>(async ({ userId, limit }) => {
    const wanted = new Set(userId);
    const data = users.filter((u) => wanted.has(u.id)).slice(0, limit);
    return { data };
  });
}

describe("createRecipientLookup", () => {
  it("splits 250 ids into three requests of at most 100, each with a limit that covers it", async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `user_${i}`);
    const getUserList = fakeClerk(ids.map((id) => user(id)));

    const recipients = await createRecipientLookup(getUserList)(ids);

    expect(getUserList).toHaveBeenCalledTimes(3);
    const batches = getUserList.mock.calls.map(([params]) => params);
    expect(batches.map((params) => params.userId.length)).toEqual([100, 100, 50]);
    for (const params of batches) expect(params.limit).toBe(params.userId.length);
    expect(recipients.size).toBe(250);
  });

  it("removes duplicate ids before asking Clerk", async () => {
    const getUserList = fakeClerk([user("u1"), user("u2")]);

    const recipients = await createRecipientLookup(getUserList)(["u1", "u2", "u1", "u1", "u2"]);

    expect(getUserList).toHaveBeenCalledTimes(1);
    expect(getUserList.mock.calls[0]?.[0].userId).toEqual(["u1", "u2"]);
    expect([...recipients.keys()].sort()).toEqual(["u1", "u2"]);
  });

  it("uses the primary email address, not the first one listed", async () => {
    const getUserList = fakeClerk([
      user("u1", {
        firstName: "Priya",
        primaryEmailAddressId: "e2",
        emailAddresses: [
          { id: "e1", emailAddress: "old@example.test" },
          { id: "e2", emailAddress: "primary@example.test" },
        ],
      }),
    ]);

    const recipients = await createRecipientLookup(getUserList)(["u1"]);

    expect(recipients.get("u1")).toEqual({ email: "primary@example.test", firstName: "Priya" });
  });

  it("skips users without a primary email address", async () => {
    const getUserList = fakeClerk([
      user("no_primary", { primaryEmailAddressId: null }),
      user("dangling", { primaryEmailAddressId: "missing", emailAddresses: [{ id: "e9", emailAddress: "x@example.test" }] }),
      user("ok"),
    ]);

    const recipients = await createRecipientLookup(getUserList)(["no_primary", "dangling", "ok"]);

    expect([...recipients.keys()]).toEqual(["ok"]);
  });

  it("keeps a null first name", async () => {
    const getUserList = fakeClerk([user("u1", { firstName: null })]);
    const recipients = await createRecipientLookup(getUserList)(["u1"]);
    expect(recipients.get("u1")?.firstName).toBeNull();
  });

  it("makes no request for an empty list", async () => {
    const getUserList = fakeClerk([]);
    const recipients = await createRecipientLookup(getUserList)([]);
    expect(getUserList).not.toHaveBeenCalled();
    expect(recipients.size).toBe(0);
  });
});
