import "server-only";

import { clerkClient } from "@clerk/nextjs/server";

/** The fields of a Clerk user this module reads. Matches the backend `User` resource. */
export type RecipientUser = {
  id: string;
  firstName: string | null;
  primaryEmailAddressId: string | null;
  emailAddresses: ReadonlyArray<{ id: string; emailAddress: string }>;
};

export type GetUserList = (params: { userId: string[]; limit: number }) => Promise<{ data: ReadonlyArray<RecipientUser> }>;

export type Recipient = { email: string; firstName: string | null };

export type RecipientLookup = (userIds: string[]) => Promise<Map<string, Recipient>>;

/** Clerk's userId filter accepts at most 100 ids per request. */
const CLERK_BATCH_SIZE = 100;

/**
 * Resolves Clerk user ids to their primary email address and first name.
 * Users without a primary email are omitted. Callers must treat the result as
 * the only source of addresses: nothing is cached between runs.
 */
export function createRecipientLookup(getUserList: GetUserList): RecipientLookup {
  return async (userIds) => {
    const unique = [...new Set(userIds)].filter((id) => id.length > 0);
    const recipients = new Map<string, Recipient>();
    for (let start = 0; start < unique.length; start += CLERK_BATCH_SIZE) {
      const batch = unique.slice(start, start + CLERK_BATCH_SIZE);
      // Clerk returns 10 users when no limit is given, so the limit must cover the batch.
      const { data } = await getUserList({ userId: batch, limit: batch.length });
      for (const user of data) {
        const primary = user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId);
        if (primary) recipients.set(user.id, { email: primary.emailAddress, firstName: user.firstName });
      }
    }
    return recipients;
  };
}

export function clerkRecipientLookup(): RecipientLookup {
  return createRecipientLookup(async (params) => (await clerkClient()).users.getUserList(params));
}
