import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { supabaseEnv } from "@/lib/env";
import type { Database } from "@/server/db/database.types";

export type UserDb = SupabaseClient<Database>;

/**
 * Supabase client that acts as the signed-in Clerk user.
 *
 * It uses the publishable key plus the user's Clerk session token, so every
 * query runs as the `authenticated` Postgres role under Row Level Security.
 * There is no session persistence: a new client is created per request from
 * the verified Clerk auth object.
 */
export function createUserDb(getToken: () => Promise<string | null>): UserDb {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = supabaseEnv();
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    accessToken: getToken,
    db: { schema: "public" },
    global: { headers: { "x-client-info": "parmarpro-server" } },
  });
}
