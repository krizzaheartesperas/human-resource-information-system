"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { buildCurrentUserForAuthSession } from "@/lib/supabase/supabaseAuth";
import { saveAuthUser } from "@/lib/CurrentUserContext";
import { safeNextPath } from "@/lib/auth/safeNextPath";
import { resolvePostAuthRedirectPath } from "@/lib/auth/postAuthRedirect";
import {
  applySelectedSystemToUser,
  clearSsoTransition,
  clearSsoTransitionIfTargetMatches,
} from "@/lib/auth/ssoTransition";

export default function AuthSsoCompletePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Finishing sign-in…");

  useEffect(() => {
    let cancelled = false;
    const targetSystem = searchParams.get("target");
    const next = safeNextPath(searchParams.get("next"));

    void (async () => {
      try {
        if (typeof window !== "undefined") {
          const href = window.location.href;
          if (href.includes("code=")) {
            const { error } = await supabase.auth.exchangeCodeForSession(href);
            if (error && !/already|session/i.test(error.message)) {
              // continue; PKCE may not apply to magic-link return
            }
          }
        }
        const {
          data: { session },
          error: sessErr,
        } = await supabase.auth.getSession();
        if (cancelled) return;
        if (sessErr || !session?.user) {
          const nq = next ? `?next=${encodeURIComponent(next)}` : "";
          router.replace(`/login?sso=incomplete${nq}`);
          return;
        }
        const { data: cu, error: hydErr } = await buildCurrentUserForAuthSession(session.user, {
          accessToken: session.access_token,
          selectedSystemCode: targetSystem,
        });
        if (!cu || hydErr) {
          await supabase.auth.signOut();
          const nq = next ? `?next=${encodeURIComponent(next)}` : "";
          router.replace(`/login?sso=incomplete${nq}`);
          return;
        }

        // Force the system context if provided (SSO handoff)
        if (targetSystem) {
          localStorage.setItem("hris-selected-system", targetSystem);
        }

        const nextUser = applySelectedSystemToUser(cu, targetSystem);
        clearSsoTransitionIfTargetMatches("hris");
        saveAuthUser(nextUser);
        setMessage("Taking you to Workzen…");
        router.replace(
          resolvePostAuthRedirectPath({
            user: nextUser,
            nextParam: next,
            forceSelector: false,
          })
        );
      } catch {
        clearSsoTransition();
        const nq = next ? `?next=${encodeURIComponent(next)}` : "";
        router.replace(`/login?sso=incomplete${nq}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#eef3ff] px-4 dark:bg-[#0b1220]">
      <div className="size-10 animate-spin rounded-full border-2 border-[#0E1F63] border-t-transparent dark:border-slate-200" />
      <p className="mt-4 text-sm text-[#5568a7] dark:text-slate-300">{message}</p>
    </div>
  );
}
