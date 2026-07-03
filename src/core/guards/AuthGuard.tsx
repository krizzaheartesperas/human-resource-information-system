"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabase/client";
import {
  buildCurrentUserForAuthSession,
  isSupabaseAuthConfigured,
  signOutSupabase,
} from "@/lib/supabase/supabaseAuth";
import {
  loadAuthUser,
  saveAuthUser,
  loadSelectedAccessIdFromStorage,
  loadSelectedRoleFromStorage,
  loadSelectedSystemCodeFromStorage,
} from "@/lib/CurrentUserContext";
import { canAccessAppPath, canAccessSystem } from "@/lib/auth/permissions";
import { getHomePathForRole } from "@/core/routes/portal-routes";

function isMissingAuthSessionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "AuthSessionMissingError" ||
    error.message.toLowerCase().includes("auth session missing")
  );
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [mounted, setMounted] = useState(false);
  const authBootstrappedRef = useRef(false);

  // ✅ Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const loginRedirectUrl = useCallback(() => {
    const path = pathname || "/";
    const q = searchParams?.toString() ?? "";
    const full = q ? `${path}?${q}` : path;
    const next = encodeURIComponent(full.startsWith("/") ? full : `/${full}`);
    return `/login?next=${next}`;
  }, [pathname, searchParams]);

  // =========================
  // AUTH CHECK
  // =========================
  useEffect(() => {
    if (!mounted || authBootstrappedRef.current) return;
    authBootstrappedRef.current = true;

    let cancelled = false;

    async function checkAuth() {
      try {
        // =========================
        // SUPABASE AUTH FLOW
        // =========================
        if (isSupabaseAuthConfigured()) {
          const { data, error } = await supabase.auth.getUser();

          if (error) {
            if (isMissingAuthSessionError(error)) {
              if (!cancelled && pathname !== "/login") {
                router.replace(loginRedirectUrl());
              }
              return;
            }
            throw error;
          }

          const user = data.user;

          if (!user) {
            if (!cancelled && pathname !== "/login") {
              router.replace(loginRedirectUrl());
            }
            return;
          }

          const { data: sessionData } = await supabase.auth.getSession();

          const { data: current, error: buildError } =
            await buildCurrentUserForAuthSession(user, {
              accessToken: sessionData?.session?.access_token,
              selectedAccessId: loadSelectedAccessIdFromStorage() || undefined,
              selectedSystemCode:
                loadSelectedSystemCodeFromStorage() || undefined,
            });

          if (buildError || !current) {
            await signOutSupabase();

            if (!cancelled && pathname !== "/login") {
              router.replace(loginRedirectUrl());
            }
            return;
          }

          // 🚫 System access check
          if (
            current.selectedSystemCode &&
            !canAccessSystem(current, current.selectedSystemCode)
          ) {
            await signOutSupabase();

            if (!cancelled && pathname !== "/login") {
              router.replace(loginRedirectUrl());
            }
            return;
          }

          // ✅ Apply selected role override if exists
          const selectedRole = loadSelectedRoleFromStorage();

          const guardedUser = selectedRole
            ? { ...current, role: selectedRole }
            : current;

          saveAuthUser(guardedUser);
          return;
        }

        // =========================
        // LOCAL FALLBACK AUTH
        // =========================
        const user = loadAuthUser();

        if (!user) {
          if (!cancelled && pathname !== "/login") {
            router.replace(loginRedirectUrl());
          }
          return;
        }
      } catch (err) {
        if (!isMissingAuthSessionError(err)) {
          console.error("AuthGuard error:", err);
        }

        if (!cancelled && pathname !== "/login") {
          router.replace(loginRedirectUrl());
        }
      }
    }

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [mounted, pathname, loginRedirectUrl, router]);

  // =========================
  // ROLE / ROUTE GUARD
  // =========================
  useEffect(() => {
    if (!mounted) return;

    const user = loadAuthUser();
    if (!user) return;

    if (!canAccessAppPath(user.role, pathname || "")) {
      const target = getHomePathForRole(user.role);

      if (pathname !== target) {
        router.replace(target);
      }
    }
  }, [mounted, pathname, router]);

  // ✅ Prevent hydration mismatch
  if (!mounted) return null;

  return <>{children}</>;
}