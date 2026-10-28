import "server-only";

import { isAppError } from "@/server/auth/errors";

/** Loads page data, turning a 403 into a renderable "no access" state. Other errors propagate. */
export async function loadUnlessForbidden<T>(load: () => Promise<T>): Promise<{ allowed: true; data: T } | { allowed: false }> {
  try {
    return { allowed: true, data: await load() };
  } catch (error) {
    if (isAppError(error) && error.code === "forbidden") return { allowed: false };
    throw error;
  }
}
