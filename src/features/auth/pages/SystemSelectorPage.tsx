"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BriefcaseBusiness,
  FolderKanban,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  loadAuthUser,
  loadSelectedAccessIdFromStorage,
  loadSelectedSystemCodeFromStorage,
  saveAuthUser,
} from "@/lib/CurrentUserContext";
import { getHomePathForSystemRole } from "@/core/routes/portal-routes";
import { supabase } from "@/lib/supabase/client";
import {
  buildCurrentUserForAuthSession,
  isSupabaseAuthConfigured,
} from "@/lib/supabase/supabaseAuth";
import { safeNextPath } from "@/lib/auth/safeNextPath";
import {
  applySelectedSystemToUser,
  clearSsoTransition,
  clearSsoTransitionIfTargetMatches,
  isSsoTransitionActive,
  startSsoTransition,
} from "@/lib/auth/ssoTransition";
import { normalizeSystemCode, roleFromSystemRoleCode } from "@/lib/auth/sessionAccess";
import type { CurrentUser } from "@/lib/mock";

const SYSTEM_COPY: Record<string, string> = {
  hris: "Human resources information system",
  payroll: "Compensation and payroll operations",
  recruitment: "Hiring and candidate pipeline",
  project_management: "Project planning and delivery",
};

const CARD_ACCENTS: Record<
  string,
  {
    iconWrap: string;
    iconText: string;
    badge: string;
  }
> = {
  hris: {
    iconWrap: "bg-[#1e2b4d] text-[#60a5fa]",
    iconText: "text-blue-200",
    badge: "border-[#FFD949] text-white",
  },
  payroll: {
    iconWrap: "bg-[#1e3d2b] text-[#34d399]",
    iconText: "text-emerald-200",
    badge: "border-emerald-500/50 text-white",
  },
  recruitment: {
    iconWrap: "bg-[#2d1e4d] text-[#a78bfa]",
    iconText: "text-violet-200",
    badge: "border-[#a78bfa]/50 text-white",
  },
  project_management: {
    iconWrap: "bg-[#4d3d1e] text-[#fbbf24]",
    iconText: "text-amber-200",
    badge: "border-amber-500/50 text-white",
  },
};

function iconForSystem(systemCode: string) {
  const code = systemCode.toLowerCase();
  if (code === "hris") return Users;
  if (code === "payroll") return ShieldCheck;
  if (code === "project_management") return FolderKanban;
  if (code === "recruitment") return Search;
  return BriefcaseBusiness;
}

function formatRoleLabel(roleName: string) {
  return roleName.replace(/_/g, " ").trim();
}

function formatDisplayName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export default function SystemSelectorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [authRetryNonce, setAuthRetryNonce] = useState(0);

  const systems = useMemo(() => user?.accessibleSystems ?? [], [user]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!isSupabaseAuthConfigured()) {
        setUser(loadAuthUser());
        setMounted(true);
        return;
      }

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        if (isSsoTransitionActive()) {
          window.setTimeout(() => {
            if (!cancelled) setAuthRetryNonce((value) => value + 1);
          }, 400);
          return;
        }
        router.replace(`/login?next=${encodeURIComponent("/system-selector")}`);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { data: currentUser, error: currentUserError } = await buildCurrentUserForAuthSession(
        authUser,
        {
          accessToken: session?.access_token,
          selectedAccessId: loadSelectedAccessIdFromStorage(),
          selectedSystemCode: loadSelectedSystemCodeFromStorage(),
        }
      );

      if (cancelled) return;

      if (!currentUser || currentUserError) {
        if (isSsoTransitionActive()) {
          window.setTimeout(() => {
            if (!cancelled) setAuthRetryNonce((value) => value + 1);
          }, 400);
          return;
        }
        router.replace(`/login?next=${encodeURIComponent("/system-selector")}`);
        return;
      }

      const nextUser = applySelectedSystemToUser(currentUser, currentUser.selectedSystemCode);
      clearSsoTransitionIfTargetMatches("hris");
      setUser(nextUser);
      saveAuthUser(nextUser);
      setMounted(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [authRetryNonce, router]);

  useEffect(() => {
    if (!mounted) return;
    if (!user) {
      if (isSsoTransitionActive()) return;
      router.replace(`/login?next=${encodeURIComponent("/system-selector")}`);
    }
  }, [mounted, router, user]);

  const postSelectNext = safeNextPath(searchParams.get("next"));

  async function handleSelectSystem(access: NonNullable<CurrentUser["accessibleSystems"]>[number]) {
    setError(null);
    setSubmittingId(access.id);

    try {
      const selectedRole = roleFromSystemRoleCode(access.roleCode, access.roleName);
      const updatedUser = user
        ? {
            ...user,
            role: selectedRole,
            selectedAccessId: access.id,
            selectedSystemCode: access.systemCode,
            selectedSystemName: access.systemName,
            selectedSystemRoleCode: access.roleCode,
            selectedSystemRoleName: access.roleName,
          }
        : null;

      if (updatedUser) {
        saveAuthUser(updatedUser);
      }

      if (!isSupabaseAuthConfigured() || normalizeSystemCode(access.systemCode) === "hris") {
        clearSsoTransition();
        router.replace(getHomePathForSystemRole(selectedRole, access.systemCode));
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch("/api/system/switch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          system: access.systemCode,
          next: postSelectNext,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        redirectTo?: string;
      };

      if (!res.ok) {
        setError(json.error?.trim() || "System access could not be verified. Please try again.");
        clearSsoTransition();
        setSubmittingId(null);
        return;
      }

      if (json.redirectTo) {
        startSsoTransition(access.systemCode);
        window.location.assign(json.redirectTo);
        return;
      }

      clearSsoTransition();
      router.replace(getHomePathForSystemRole(selectedRole, access.systemCode));
    } catch {
      setError("Unable to switch systems right now. Please try again.");
      clearSsoTransition();
      setSubmittingId(null);
    }
  }

  if (!mounted || !user) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="rounded-2xl border border-slate-200/70 bg-white px-6 py-4 text-sm font-medium text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          Loading system selector...
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08111f] text-white font-sans">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/company-bg.png')" }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-slate-900/90" aria-hidden />
      <div className="absolute inset-0 bg-brand-deep/20" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col items-center justify-center px-5 py-6 sm:px-8 lg:px-12">
        <header className="mb-12 w-full -translate-y-8 text-center sm:-translate-y-10">
          <h1 className="mx-auto max-w-4xl text-balance text-5xl font-extrabold tracking-tight text-white sm:text-6xl">
            <span className="block">Welcome back, {formatDisplayName(user.name)}</span>
          </h1>
          <p className="mt-4 text-base font-medium text-white/50">
            Select a system to continue your session
          </p>
        </header>

        {error && (
          <div className="mx-auto mb-8 max-w-2xl rounded-xl border border-rose-400/30 bg-rose-500/12 px-5 py-3 text-center text-sm font-medium text-rose-100 shadow-2xl">
            {error}
          </div>
        )}

        <section className="w-full max-w-[1400px] -translate-y-8 sm:-translate-y-10">
          <div className="mb-10 text-center">
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40">
              All Systems
            </span>
          </div>

          <div className="mx-auto grid max-w-[1340px] grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {systems.map((access, index) => {
              const normalizedCode = access.systemCode.toLowerCase();
              const Icon = iconForSystem(normalizedCode);
              const accent = CARD_ACCENTS[normalizedCode] ?? {
                iconWrap: "bg-white/10 text-white",
                badge: "border-white/30 text-white",
              };

              return (
                <button
                  key={access.id}
                  type="button"
                  onClick={() => void handleSelectSystem(access)}
                  disabled={submittingId === access.id}
                  style={{ animationDelay: `${index * 80}ms` }}
                  className="portal-card group relative flex min-h-[155px] w-full flex-col overflow-hidden rounded-[1.75rem] border border-white/8 bg-[linear-gradient(180deg,rgba(12,12,12,0.96)_0%,rgba(10,10,10,0.92)_100%)] px-7 py-5 text-left shadow-[0_22px_64px_rgba(0,0,0,0.32)] transition duration-500 hover:-translate-y-1 hover:border-white/12 hover:bg-[linear-gradient(180deg,rgba(18,18,18,0.98)_0%,rgba(12,12,12,0.94)_100%)] hover:shadow-[0_28px_80px_rgba(0,0,0,0.38)] disabled:opacity-75"
                >
                  <div className="mb-5 flex items-start justify-between">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-[1rem] border border-white/10 ${accent.iconWrap} transition duration-300 group-hover:scale-105`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className={`rounded-full border bg-white/[0.04] px-3 py-1 text-[9px] font-extrabold uppercase tracking-[0.04em] ${accent.badge}`}>
                      {formatRoleLabel(access.roleName)}
                    </div>
                  </div>

                  <div className="mt-auto">
                    <h2 className="mb-1.5 text-[1.65rem] font-black tracking-[-0.04em] text-white">
                      {access.systemName}
                    </h2>
                    <p className="max-w-[24ch] text-[0.92rem] font-semibold leading-relaxed text-white/42">
                      {SYSTEM_COPY[normalizedCode] ?? `Access ${access.systemName}`}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {systems.length === 0 && (
            <div className="mx-auto mt-8 max-w-xl rounded-3xl border border-white/5 bg-[#0c0c0c]/90 p-10 text-center shadow-2xl">
              <p className="text-xl font-bold text-white">Access not assigned</p>
              <p className="mt-2 text-sm text-white/40">
                No active system access was found for this account.
              </p>
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        @keyframes portalCardIn {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .portal-card {
          animation: portalCardIn 600ms cubic-bezier(0.23, 1, 0.32, 1) forwards;
        }
      `}</style>
    </main>
  );
}
