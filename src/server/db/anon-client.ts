import "server-only";

import { createClient } from "@supabase/supabase-js";

import { supabaseEnv } from "@/lib/env";
import type { Database } from "@/server/db/database.types";

/** Supabase client acting as the `anon` role (publishable key, no user token). */
export function createAnonDb() {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = supabaseEnv();
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
