/**
 * Client-side current user helpers (demo localStorage + Supabase hydration via AuthGuard).
 */
import type { CurrentUser } from "@/lib/mock";
import { loadAuthUser } from "@/lib/CurrentUserContext";

export function getClientAuthUser(): CurrentUser | null {
  return loadAuthUser();
}
