"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolveDemoUserByEmail } from "@/lib/auth-routing";
import { demoUsersByRole } from "@/lib/mock";
import { safeNextPath } from "@/lib/auth/safeNextPath";
import { resolvePostAuthRedirectPath } from "@/lib/auth/postAuthRedirect";
import { isLegacyForceSelectorQuery } from "@/lib/auth/legacyPortalQueryParams";
import { supabase } from "@/lib/supabase/client";
import {
  buildCurrentUserForAuthSession,
  isSupabaseAuthConfigured,
} from "@/lib/supabase/supabaseAuth";
import {
  saveAuthUser,
  loadAuthUser,
  loadSelectedAccessIdFromStorage,
  loadSelectedSystemCodeFromStorage,
  clearAuthUser,
  clearAccountProfileOverrides,
} from "@/lib/CurrentUserContext";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const forceSelector = isLegacyForceSelectorQuery(searchParams);
  const nextParam = safeNextPath(searchParams.get("next"));

  useEffect(() => {
    let cancelled = false;

    async function checkAlreadySignedIn() {
      if (isSupabaseAuthConfigured()) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const { data: cu } = await buildCurrentUserForAuthSession(user, {
            accessToken: session?.access_token,
            selectedAccessId: loadSelectedAccessIdFromStorage(),
            selectedSystemCode: loadSelectedSystemCodeFromStorage(),
          });
          if (cu) {
            const systems = cu.accessibleSystems ?? [];
            let finalUser = cu;
            if (systems.length === 1 && !cu.selectedSystemCode) {
              finalUser = {
                ...cu,
                selectedAccessId: systems[0].id,
                selectedSystemCode: systems[0].systemCode,
                selectedSystemName: systems[0].systemName,
                selectedSystemRoleCode: systems[0].roleCode,
                selectedSystemRoleName: systems[0].roleName,
              };
            }
            saveAuthUser(finalUser);
            router.replace(
              resolvePostAuthRedirectPath({
                user: finalUser,
                nextParam,
                forceSelector: systems.length > 1,
              })
            );
            return;
          }
          clearAuthUser();
          clearAccountProfileOverrides();
        }
      } else {
        const localUser = loadAuthUser();
        if (localUser) {
          const systems = localUser.accessibleSystems ?? [];
          let finalUser = localUser;
          if (systems.length === 1 && !localUser.selectedSystemCode) {
            finalUser = {
              ...localUser,
              selectedAccessId: systems[0].id,
              selectedSystemCode: systems[0].systemCode,
              selectedSystemName: systems[0].systemName,
              selectedSystemRoleCode: systems[0].roleCode,
              selectedSystemRoleName: systems[0].roleName,
            };
            saveAuthUser(finalUser);
          }
          router.replace(
            resolvePostAuthRedirectPath({
              user: finalUser,
              nextParam,
              forceSelector: systems.length > 1,
            })
          );
          return;
        }
      }
      if (!cancelled) setChecking(false);
    }

    void checkAlreadySignedIn();
    return () => {
      cancelled = true;
    };
  }, [router, forceSelector, nextParam]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    if (isSupabaseAuthConfigured()) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setError(error.message);
        setSubmitting(false);
        return;
      }
      if (!data.user) {
        setError("Sign-in failed.");
        setSubmitting(false);
        return;
      }

      const { data: cu, error: hydrateErr } = await buildCurrentUserForAuthSession(data.user, {
        accessToken: data.session?.access_token,
      });
      if (hydrateErr) {
        setError(`Could not load your profile: ${hydrateErr}`);
        await supabase.auth.signOut();
        setSubmitting(false);
        return;
      }
      if (!cu) {
        setError("No profile linked to this login. Please link employees/profiles to your auth user.");
        await supabase.auth.signOut();
        setSubmitting(false);
        return;
      }

      clearAuthUser();
      clearAccountProfileOverrides();

      const systems = cu.accessibleSystems ?? [];
      let finalUser = cu;

      // Auto-select if exactly one system, otherwise clear to force selector
      if (systems.length === 1) {
        finalUser = {
          ...cu,
          selectedAccessId: systems[0].id,
          selectedSystemCode: systems[0].systemCode,
          selectedSystemName: systems[0].systemName,
          selectedSystemRoleCode: systems[0].roleCode,
          selectedSystemRoleName: systems[0].roleName,
        };
      } else if (systems.length > 1) {
        finalUser = {
          ...cu,
          selectedAccessId: undefined,
          selectedSystemCode: undefined,
          selectedSystemName: undefined,
          selectedSystemRoleCode: undefined,
          selectedSystemRoleName: undefined,
        };
      }

      saveAuthUser(finalUser);
      router.replace(
        resolvePostAuthRedirectPath({
          user: finalUser,
          nextParam,
          forceSelector: systems.length > 1,
        })
      );
      setSubmitting(false);
      return;
    }

    const user = resolveDemoUserByEmail(email);
    if (!user) {
      setError("No demo account found for this email.");
      setSubmitting(false);
      return;
    }
    clearAuthUser();
    clearAccountProfileOverrides();

    const systems = user.accessibleSystems ?? [];
    let finalUser = user;

    if (systems.length === 1) {
      finalUser = {
        ...user,
        selectedAccessId: systems[0].id,
        selectedSystemCode: systems[0].systemCode,
        selectedSystemName: systems[0].systemName,
        selectedSystemRoleCode: systems[0].roleCode,
        selectedSystemRoleName: systems[0].roleName,
      };
    } else if (systems.length > 1) {
      finalUser = {
        ...user,
        selectedAccessId: undefined,
        selectedSystemCode: undefined,
        selectedSystemName: undefined,
        selectedSystemRoleCode: undefined,
        selectedSystemRoleName: undefined,
      };
    }

    saveAuthUser(finalUser);
    router.replace(
      resolvePostAuthRedirectPath({
        user: finalUser,
        nextParam,
        forceSelector: systems.length > 1,
      })
    );
    setSubmitting(false);
  }

  async function handleGoogleSSO() {
    setError("");
    if (!isSupabaseAuthConfigured()) {
      const demo = demoUsersByRole.EMPLOYEE;
      clearAuthUser();
      clearAccountProfileOverrides();
      saveAuthUser(demo);
      router.replace(
        resolvePostAuthRedirectPath({
          user: demo,
          nextParam,
          forceSelector,
        })
      );
      return;
    }
    const origin = window.location.origin;
    const loginQs = new URLSearchParams();
    if (nextParam) loginQs.set("next", nextParam);
    if (searchParams.get("from") === "main-portal") loginQs.set("from", "main-portal");
    if (searchParams.get("selectSystem") === "1") loginQs.set("selectSystem", "1");
    const qs = loginQs.toString();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/login${qs ? `?${qs}` : ""}` },
    });
    if (oauthError) {
      setError(oauthError.message);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08111f]">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08111f] text-white">
      {/* Background with Overlays */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/company-bg.png')" }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-slate-900/90" aria-hidden />
      <div className="absolute inset-0 bg-brand-deep/20" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1440px] items-center px-8 lg:px-20">
        <div className="grid w-full items-center gap-12 lg:grid-cols-2">
          
          {/* Left Column: Branding */}
          <section className="max-w-2xl space-y-10 py-12">
            <div className="flex items-center gap-3">
              <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white/10 backdrop-blur-md">
                <Image src="/newlogo.png" alt="Workzen Logo" width={32} height={32} className="object-contain" />
              </div>
              <div>
                <span className="block text-xl font-black uppercase tracking-tight text-white">workzen</span>
                <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">system</span>
              </div>
            </div>

            <div className="space-y-6">
              <h1 className="text-balance text-6xl font-black leading-[1.05] tracking-[-0.04em] text-white sm:text-7xl">
                Recruit Smarter.<br />
                Manage Faster.<br />
                Work Anywhere.
              </h1>
              <p className="max-w-md text-lg font-medium leading-relaxed text-white/60">
                Your unified platform for recruitment, HRIS, payroll, and project management. 
                Run hiring end-to-end and manage your teams seamlessly across devices.
              </p>
            </div>
          </section>

          {/* Right Column: Login Card */}
          <section className="flex justify-center lg:justify-end">
            <div className="w-full max-w-[500px] overflow-hidden rounded-3xl bg-[#090e1a]/95 p-8 shadow-[0_40px_100px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
              <div className="space-y-1">
                <h2 className="text-3xl font-extrabold tracking-tight text-white">Welcome Back!</h2>
                <p className="text-sm font-medium text-white/45">
                  Log in to access your recruitment pipeline, HR data, payroll, and projects.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-wider text-white/30">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Input your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11 rounded-lg border-white/5 bg-white/[0.03] px-4 text-sm text-white placeholder:text-white/20 focus:border-brand-deep/50 focus:ring-0"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-wider text-white/30">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Input your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11 rounded-lg border-white/5 bg-white/[0.03] px-4 pr-12 text-sm text-white placeholder:text-white/20 focus:border-brand-deep/50 focus:ring-0"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60 transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between py-1">
                  <label className="flex cursor-pointer items-center gap-2 group">
                    <div className="relative flex h-4 w-4 items-center justify-center rounded border border-white/10 bg-white/[0.02] transition-colors group-hover:border-white/20">
                      <input 
                        type="checkbox" 
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="peer absolute inset-0 cursor-pointer opacity-0" 
                      />
                      <div className="h-1.5 w-1.5 scale-0 rounded-[1px] bg-[#FFD949] transition-transform peer-checked:scale-100" />
                    </div>
                    <span className="text-[11px] font-bold text-white/50 group-hover:text-white/70">Remember Me</span>
                  </label>
                  <Link href="/forgot-password" className="text-[11px] font-bold text-[#FFD949] hover:underline">
                    Forgot Password?
                  </Link>
                </div>

                <Button 
                  type="submit" 
                  disabled={submitting}
                  className="h-11 w-full rounded-lg bg-[#FFD949] text-sm font-black text-slate-900 shadow-[0_10px_20px_rgba(255,217,73,0.1)] hover:bg-[#ffdf6b] transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  {submitting ? "Logging in..." : "Login"}
                </Button>

                {error && (
                  <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-center text-xs font-bold text-rose-200">
                    {error}
                  </p>
                )}
              </form>

              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/5" />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/15">Or continue with</span>
                  <div className="h-px flex-1 bg-white/5" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full rounded-lg border-white/5 bg-white/[0.03] text-sm font-bold text-white hover:bg-white/[0.06] transition-colors"
                  onClick={handleGoogleSSO}
                >
                  <span className="inline-flex items-center gap-2.5">
                    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
                      <path
                        fill="#4285F4"
                        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.55-5.17 3.55-8.65Z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.88-3c-1.07.72-2.43 1.14-4.05 1.14-3.11 0-5.75-2.1-6.69-4.92H1.3v3.09A12 12 0 0 0 12 24Z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.31 14.31A7.2 7.2 0 0 1 4.94 12c0-.8.14-1.57.37-2.31V6.6H1.3A12 12 0 0 0 0 12c0 1.94.46 3.77 1.3 5.4l4.01-3.09Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.45-3.45C17.94 1.16 15.23 0 12 0A12 12 0 0 0 1.3 6.6l4.01 3.09c.94-2.82 3.58-4.92 6.69-4.92Z"
                      />
                    </svg>
                    Continue with Google
                  </span>
                </Button>
              </div>

              <p className="mt-6 text-center text-xs font-bold text-white/25">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="text-[#FFD949] hover:underline">
                  Signup
                </Link>
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
