import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { supabaseSecretEnv } from "@/lib/env";
import type { Database } from "@/server/db/database.types";

/**
 * PRIVILEGED: Supabase client using the secret key (service_role, bypasses
 * RLS). Import restricted by ESLint to src/server/privileged/**. Callers in
 * that directory expose narrow, named operations only, and each one is
 * reachable only after signature verification or explicit server-side
 * authorization. Never add a generic query helper here.
 */
let client: SupabaseClient<Database> | undefined;

export function privilegedDb(): SupabaseClient<Database> {
  if (!client) {
    const { SUPABASE_URL, SUPABASE_SECRET_KEY } = supabaseSecretEnv();
    client = createClient<Database>(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { "x-client-info": "parmarpro-privileged" } },
    });
  }
  return client;
}
