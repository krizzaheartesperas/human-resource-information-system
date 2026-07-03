"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loadAuthUser } from "@/lib/CurrentUserContext";
import { supabase } from "@/lib/supabase/client";
import {
  buildCurrentUserForAuthSession,
  isSupabaseAuthConfigured,
} from "@/lib/supabase/supabaseAuth";
import { safeNextPath } from "@/lib/auth/safeNextPath";
import { resolvePostAuthRedirectPath } from "@/lib/auth/postAuthRedirect";
import { isLegacyForceSelectorQuery } from "@/lib/auth/legacyPortalQueryParams";

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mounted, setMounted] = useState(false);

  const forceSelector = isLegacyForceSelectorQuery(searchParams);
  const nextParam = safeNextPath(searchParams.get("next"));
  const ticket = searchParams.get("ticket")?.trim() ?? "";

  // ✅ Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    let cancelled = false;

    if (ticket) {
      const qs = new URLSearchParams();
      qs.set("ticket", ticket);
      if (nextParam) qs.set("next", nextParam);
      router.replace(`/auth/consume?${qs.toString()}`);
      return;
    }

    void (async () => {
      if (isSupabaseAuthConfigured()) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (!user) {
          const q = nextParam ? `?next=${encodeURIComponent(nextParam)}` : "";
          router.replace(`/login${q}`);
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        const { data: cu } = await buildCurrentUserForAuthSession(user, {
          accessToken: session?.access_token,
        });

        if (!cu) {
          const q = nextParam ? `?next=${encodeURIComponent(nextParam)}` : "";
          router.replace(`/login${q}`);
          return;
        }


        const systems = cu.accessibleSystems ?? [];

        router.replace(
          resolvePostAuthRedirectPath({
            user: cu,
            nextParam,
            forceSelector: forceSelector || systems.length > 1,
          })
        );

        return;
      }

      const user = loadAuthUser();

      if (!user) {
        const q = nextParam ? `?next=${encodeURIComponent(nextParam)}` : "";
        router.replace(`/login${q}`);
        return;
      }

      const systems = user.accessibleSystems ?? [];

      router.replace(
        resolvePostAuthRedirectPath({
          user,
          nextParam,
          forceSelector: forceSelector || systems.length > 1,
        })
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [mounted, router, forceSelector, nextParam, ticket]);

  // ✅ CRITICAL: render nothing until mounted
  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-medium text-slate-600 shadow-sm">
        Redirecting...
      </div>
    </div>
  );
}