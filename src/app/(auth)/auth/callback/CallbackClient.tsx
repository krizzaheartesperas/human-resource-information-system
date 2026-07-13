"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleAuth = async () => {
      const code = searchParams.get("code");
      const ticket = searchParams.get("ticket");
      const next = searchParams.get("next") || "/dashboard";

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error("Auth callback exchange failed:", error);
          router.replace(`/login?error=${encodeURIComponent(error.message)}`);
          return;
        }
      }

      if (ticket) {
        router.replace(
          `/auth/consume?ticket=${ticket}&next=${encodeURIComponent(next)}`
        );
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        router.replace(next);
      } else if (!ticket && !code) {
        router.replace("/login");
      }
    };

    handleAuth();
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#eef3ff] px-4 dark:bg-[#0b1220]">
      <div className="size-10 animate-spin rounded-full border-2 border-[#0E1F63] border-t-transparent dark:border-slate-200" />
      <p className="mt-4 text-sm text-[#5568a7] dark:text-slate-300">
        Completing sign-in...
      </p>
    </div>
  );
}
