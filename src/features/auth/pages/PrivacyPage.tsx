"use client";

import Link from "next/link";
import { ThemeLogo } from "@/components/ui/theme-logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/company-bg.png')" }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-slate-900/90" aria-hidden />
      <div className="absolute inset-0 bg-brand-deep/20" aria-hidden />
      <Card className="w-full max-w-2xl relative z-10 shadow-xl border-border/80 max-h-[90vh] overflow-auto scrollbar-hide">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-2">
            <ThemeLogo width={64} height={64} />
          </div>
          <CardTitle className="text-2xl font-semibold tracking-tight text-center">
            Privacy policy
          </CardTitle>
          <CardDescription className="text-center">
            Workzen HRIS
          </CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <p className="text-muted-foreground">
            This is a placeholder. Replace with your company&apos;s privacy policy describing how personal and HR data are collected, used, stored, and shared.
          </p>
          <p className="text-muted-foreground mt-2">
            Workzen HRIS processes employee and HR-related data for legitimate business purposes. Access is restricted to authorized roles. Data is retained according to company policy and applicable regulations.
          </p>
          <div className="mt-6">
            <Link href="/login">
              <Button variant="outline">Back to sign in</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
