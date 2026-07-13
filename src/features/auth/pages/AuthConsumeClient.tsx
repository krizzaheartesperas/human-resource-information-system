"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { buildCurrentUserForAuthSession } from "@/lib/supabase/supabaseAuth";
import { saveAuthUser } from "@/lib/CurrentUserContext";
import { safeNextPath } from "@/lib/auth/safeNextPath";
import { resolvePostAuthRedirectPath } from "@/lib/auth/postAuthRedirect";
import { isLegacyForceSelectorQuery } from "@/lib/auth/legacyPortalQueryParams";
import {
  applySelectedSystemToUser,
  clearSsoTransition,
  clearSsoTransitionIfTargetMatches,
} from "@/lib/auth/ssoTransition";

type ConsumeJson =
  | { ok: true; flow: "gotrue_redirect"; redirectUrl: string; ticketId?: string; targetSystem?: string }
  | { ok: true; flow: "verify_otp"; tokenHash: string; ticketId?: string; targetSystem?: string }
  | { ok: true; flow: "mock_auth"; mockUserId: string; ticketId?: string; targetSystem?: string }
  | { ok: false; error?: string };

export default function AuthConsumePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    let cancelled = false;
    const ticket = searchParams.get("ticket")?.trim() ?? "";
    const targetFromQuery = searchParams.get("target")?.trim() ?? "";
    const nextRaw = searchParams.get("next");
    const safeNext = safeNextPath(nextRaw);
    const forceSelector = isLegacyForceSelectorQuery(searchParams);

    if (!ticket) {
      const q = safeNext ? `?next=${encodeURIComponent(safeNext)}` : "";
      router.replace(`/login${q}`);
      return;
    }

    void (async () => {
      try {
        const res = await fetch("/api/auth/sso/consume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticket, next: safeNext, targetSystem: targetFromQuery || null }),
          cache: "no-store",
        });
        const json = (await res.json()) as ConsumeJson;
        if (cancelled) return;

        if (!json.ok) {
          setMessage(`SSO Error: ${json.error || "Invalid ticket"}`);
          const nq = safeNext ? `&next=${encodeURIComponent(safeNext)}` : "";
          setTimeout(() => router.replace(`/login?sso=invalid&reason=${json.error}${nq}`), 3000);
          return;
        }

        if (json.flow === "gotrue_redirect" && json.redirectUrl) {
          setMessage("Redirecting to secure sign-in…");
          window.location.assign(json.redirectUrl);
          return;
        }

        if (json.flow === "mock_auth" && "mockUserId" in json && json.mockUserId) {
          setMessage("Completing sign-in (Demo)…");
          // dynamic import to avoid large bundles if possible, but mock is lightweight
          const { demoUsersByRole } = await import("@/lib/mock");
          const demoUser = Object.values(demoUsersByRole).find((u) => u.id === json.mockUserId);
          if (demoUser) {
            // Ensure system context is set if provided
            if (json.targetSystem || targetFromQuery) {
              localStorage.setItem("hris-selected-system", json.targetSystem || targetFromQuery);
              demoUser.selectedSystemCode = json.targetSystem || targetFromQuery;
            }
            const nextUser = applySelectedSystemToUser(demoUser, json.targetSystem || targetFromQuery);
            clearSsoTransitionIfTargetMatches("hris");
            saveAuthUser(nextUser);
            router.replace(resolvePostAuthRedirectPath({ user: nextUser, nextParam: safeNext }));
          } else {
            router.replace("/login?sso=invalid&reason=mock_user_not_found");
          }
          return;
        }

        if (json.flow === "verify_otp" && "tokenHash" in json && json.tokenHash) {
          setMessage("Completing sign-in…");
          const r1 = await supabase.auth.verifyOtp({
            type: "email",
            token_hash: json.tokenHash,
          });
          let session = r1.data.session ?? null;
          if (!session) {
            const r2 = await supabase.auth.verifyOtp({
              type: "magiclink" as "email",
              token_hash: json.tokenHash,
            });
            session = r2.data.session ?? null;
          }
          if (!session?.user) {
            const err = r1.error?.message || "No session returned";
            console.error("SSO verifyOtp failed:", err);
            setMessage(`Sign-in failed: ${err}`);
            const nq = safeNext ? `&next=${encodeURIComponent(safeNext)}` : "";
            setTimeout(() => router.replace(`/login?sso=invalid&reason=otp_failed${nq}`), 3000);
            return;
          }
          const { data: cu, error: hydErr } = await buildCurrentUserForAuthSession(session.user, {
            accessToken: session.access_token,
            selectedSystemCode: json.targetSystem || targetFromQuery || undefined,
          });
          if (!cu || hydErr) {
            console.error("SSO hydration failed:", hydErr);
            await supabase.auth.signOut();
            const nq = safeNext ? `&next=${encodeURIComponent(safeNext)}` : "";
            router.replace(`/login?sso=incomplete${nq}`);
            return;
          }

          // Force the system context from the ticket
          if (json.targetSystem || targetFromQuery) {
            localStorage.setItem("hris-selected-system", json.targetSystem || targetFromQuery);
          }

          const nextUser = applySelectedSystemToUser(cu, json.targetSystem || targetFromQuery);
          clearSsoTransitionIfTargetMatches("hris");
          saveAuthUser(nextUser);
          router.replace(
            resolvePostAuthRedirectPath({
              user: nextUser,
              nextParam: safeNext,
              forceSelector,
            })
          );
          return;
        }

        router.replace(`/login?sso=invalid`);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to connect";
        console.error("SSO Consume catch error:", e);
        clearSsoTransition();
        setMessage(`System Error: ${message}`);
        const nq = safeNext ? `?next=${encodeURIComponent(safeNext)}` : "";
        setTimeout(() => router.replace(`/login?sso=invalid&reason=exception${nq}`), 3000);
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
