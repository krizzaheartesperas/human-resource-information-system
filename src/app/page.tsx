import { Suspense } from "react";
import HomePage from "@/features/auth/pages/HomePage";

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="rounded-2xl border border-slate-200/70 bg-white px-6 py-4 text-sm font-medium text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          Loading dashboard...
        </div>
      </div>
    }>
      <HomePage />
    </Suspense>
  );
}
