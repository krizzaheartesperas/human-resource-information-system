"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getHomePathForRole } from "@/lib/auth-routing";
import { demoUsersByRole } from "@/lib/mock";
import {
  saveAuthUser,
  clearAuthUser,
  clearAccountProfileOverrides,
} from "@/lib/CurrentUserContext";

export default function SignupPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!agreedToTerms) return;
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    // Frontend-only demo: treat sign up as creating a user with the selected role
    clearAuthUser();
    clearAccountProfileOverrides();
    saveAuthUser(demoUsersByRole.EMPLOYEE);
    router.replace(getHomePathForRole("EMPLOYEE"));
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
                Build Your<br />
                HR Workspace.
              </h1>
              <p className="max-w-md text-lg font-medium leading-relaxed text-white/60">
                Create an account to manage attendance, leave, payroll, and employee records in one secure workspace.
              </p>
            </div>
          </section>

          {/* Right Column: Signup Card */}
          <section className="flex justify-center lg:justify-end">
            <div className="w-full max-w-[560px] overflow-hidden rounded-3xl bg-[#090e1a]/95 p-8 shadow-[0_40px_100px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
              <div className="space-y-1">
                <h2 className="text-3xl font-extrabold tracking-tight text-white">Create Account</h2>
                <p className="text-sm font-medium text-white/45">
                  Set up your account to use Workzen HRIS.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="first-name" className="text-[10px] font-bold uppercase tracking-wider text-white/30">
                      First Name
                    </Label>
                    <Input
                      id="first-name"
                      placeholder="Luke"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      className="h-10 rounded-lg border-white/5 bg-white/[0.03] px-4 text-sm text-white placeholder:text-white/20 focus:border-brand-deep/50 focus:ring-0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="last-name" className="text-[10px] font-bold uppercase tracking-wider text-white/30">
                      Last Name
                    </Label>
                    <Input
                      id="last-name"
                      placeholder="Dalton"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      className="h-10 rounded-lg border-white/5 bg-white/[0.03] px-4 text-sm text-white placeholder:text-white/20 focus:border-brand-deep/50 focus:ring-0"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-wider text-white/30">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="workmail@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-10 rounded-lg border-white/5 bg-white/[0.03] px-4 text-sm text-white placeholder:text-white/20 focus:border-brand-deep/50 focus:ring-0"
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
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-10 rounded-lg border-white/5 bg-white/[0.03] px-4 pr-12 text-sm text-white placeholder:text-white/20 focus:border-brand-deep/50 focus:ring-0"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password" className="text-[10px] font-bold uppercase tracking-wider text-white/30">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="h-10 rounded-lg border-white/5 bg-white/[0.03] px-4 pr-12 text-sm text-white placeholder:text-white/20 focus:border-brand-deep/50 focus:ring-0"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((p) => !p)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <label className="flex items-start gap-3 group cursor-pointer pt-1">
                  <div className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded border border-white/10 bg-white/[0.02] transition-colors group-hover:border-white/20">
                    <input 
                      type="checkbox" 
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="peer absolute inset-0 cursor-pointer opacity-0" 
                      required
                    />
                    <div className="h-1.5 w-1.5 scale-0 rounded-[1px] bg-[#FFD949] transition-transform peer-checked:scale-100" />
                  </div>
                  <span className="text-[11px] font-medium leading-relaxed text-white/40 group-hover:text-white/60">
                    I agree to the{" "}
                    <Link href="/terms" className="font-bold text-[#FFD949] hover:underline">Terms</Link> &{" "}
                    <Link href="/privacy" className="font-bold text-[#FFD949] hover:underline">Privacy Policy</Link>
                  </span>
                </label>

                <Button 
                  type="submit" 
                  disabled={submitting || !agreedToTerms}
                  className="h-10 w-full rounded-lg bg-[#FFD949] text-sm font-black text-slate-900 shadow-[0_10px_20px_rgba(255,217,73,0.1)] hover:bg-[#ffdf6b] transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:grayscale disabled:hover:scale-100"
                >
                  {submitting ? "Creating Account..." : "Create Account"}
                </Button>

                {error && (
                  <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-center text-xs font-bold text-rose-200">
                    {error}
                  </p>
                )}
              </form>

              <p className="mt-6 text-center text-xs font-bold text-white/25">
                Already have an account?{" "}
                <Link href="/login" className="text-[#FFD949] hover:underline">
                  Log In
                </Link>
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
