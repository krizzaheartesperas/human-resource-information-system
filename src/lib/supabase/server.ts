import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client initialization.
 */
export function createServerSupabaseClient(token?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  
  if (!url || !anonKey) {
    throw new Error("Supabase URL or Anon Key is missing from environment variables.");
  }

  return createClient(url, anonKey, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  });
}
