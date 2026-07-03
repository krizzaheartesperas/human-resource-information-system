import { Suspense } from "react";
import SystemSelectorPage from "@/features/auth/pages/SystemSelectorPage";

function Fallback() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="rounded-2xl border border-slate-200/70 bg-white px-6 py-4 text-sm font-medium text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        Loading system selector...
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Fallback />}>
      <SystemSelectorPage />
    </Suspense>
  );
}
