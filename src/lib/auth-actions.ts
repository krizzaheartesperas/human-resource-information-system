"use client";

import { clearAuthUser, clearAccountProfileOverrides } from "@/lib/CurrentUserContext";
import { isSupabaseAuthConfigured, signOutSupabase } from "@/lib/supabase/supabaseAuth";

/** Clears local HRIS user + profile overrides; signs out Supabase when configured. */
export async function signOutApp(): Promise<void> {
  clearAuthUser();
  clearAccountProfileOverrides();
  if (isSupabaseAuthConfigured()) {
    await signOutSupabase();
  }
}
