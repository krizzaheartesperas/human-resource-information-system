import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { DashboardLoadingVariant } from "@/components/layout/dashboard-loading-variants";

const pulse =
  "animate-pulse rounded-md bg-slate-200/90 dark:bg-white/[0.12]";

function Shell({
  className,
  children,
  label,
}: {
  className?: string;
  children: ReactNode;
  label: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[min(72vh,560px)] flex-col gap-6 pb-4",
        className
      )}
      aria-busy="true"
      aria-label={label}
    >
      {children}
    </div>
  );
}

function PlaceholderHome() {
  return (
    <Shell label="Loading dashboard">
      <div className="space-y-2">
        <div className={cn("h-8 w-44", pulse)} />
        <div className={cn("h-4 w-full max-w-lg", pulse)} />
        <div className={cn("h-4 w-2/3 max-w-md", pulse)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.04]"
          >
            <div className="mb-3 flex items-center gap-3">
              <div className={cn("size-9 shrink-0 rounded-lg", pulse)} />
              <div className="min-w-0 flex-1 space-y-2">
                <div className={cn("h-3 w-20", pulse)} />
                <div className={cn("h-2 w-14", pulse)} />
              </div>
            </div>
            <div className={cn("h-6 w-16", pulse)} />
          </div>
        ))}
      </div>

      <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/50 dark:border-white/10 dark:bg-white/[0.03]"
          >
            <div className={cn("aspect-[4/3] w-full rounded-t-2xl", pulse)} />
            <div className="space-y-2 p-3">
              <div className={cn("h-3 w-[85%]", pulse)} />
              <div className={cn("h-3 w-1/2", pulse)} />
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

function PlaceholderTabs() {
  return (
    <Shell label="Loading module">
      <div className="space-y-2">
        <div className={cn("h-8 w-56", pulse)} />
        <div className={cn("h-4 max-w-md", pulse)} />
      </div>
      <div className="flex flex-wrap gap-2 border-b border-slate-200/80 pb-2 dark:border-white/10">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={cn("h-9 w-24 rounded-full", pulse)} />
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
        <div className={cn("mb-4 h-6 w-40", pulse)} />
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={cn("h-12 w-full rounded-lg", pulse)} />
          ))}
        </div>
      </div>
    </Shell>
  );
}

function PlaceholderTableFilters() {
  return (
    <Shell label="Loading list">
      <div className="space-y-2">
        <div className={cn("h-8 w-48", pulse)} />
        <div className={cn("h-4 w-full max-w-xl", pulse)} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className={cn("h-10 w-40 rounded-lg", pulse)} />
        <div className={cn("h-10 w-32 rounded-lg", pulse)} />
        <div className={cn("h-10 flex-1 min-w-[120px] rounded-lg", pulse)} />
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10">
        <div className={cn("h-11 w-full border-b border-slate-200/80 dark:border-white/10", pulse)} />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-3 border-b border-slate-100 p-3 last:border-0 dark:border-white/5"
          >
            <div className={cn("h-4 flex-1", pulse)} />
            <div className={cn("h-4 w-24", pulse)} />
            <div className={cn("h-4 w-20", pulse)} />
          </div>
        ))}
      </div>
    </Shell>
  );
}

function PlaceholderDataTable() {
  return (
    <Shell label="Loading data">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className={cn("h-8 w-52", pulse)} />
          <div className={cn("h-4 w-full max-w-md", pulse)} />
        </div>
        <div className={cn("h-10 w-full max-w-xs rounded-lg sm:w-64", pulse)} />
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10">
        <div className="grid grid-cols-5 gap-2 border-b border-slate-200/80 p-3 dark:border-white/10">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={cn("h-4", pulse)} />
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-5 gap-2 border-b border-slate-100 p-3 last:border-0 dark:border-white/5"
          >
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className={cn("h-4", pulse)} />
            ))}
          </div>
        ))}
      </div>
    </Shell>
  );
}

function PlaceholderReports() {
  return (
    <Shell label="Loading reports">
      <div className="space-y-2">
        <div className={cn("h-8 w-44", pulse)} />
        <div className={cn("h-4 max-w-lg", pulse)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <div className={cn("mb-4 h-5 w-32", pulse)} />
          <div className={cn("h-56 w-full rounded-xl", pulse)} />
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <div className={cn("mb-4 h-5 w-36", pulse)} />
          <div className={cn("h-56 w-full rounded-xl", pulse)} />
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200/80 dark:border-white/10">
        <div className={cn("h-10 border-b border-slate-200/80 dark:border-white/10", pulse)} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={cn("h-12 border-b border-slate-100 last:border-0 dark:border-white/5", pulse)} />
        ))}
      </div>
    </Shell>
  );
}

function PlaceholderPayroll() {
  return (
    <Shell label="Loading payroll">
      <div className="space-y-2">
        <div className={cn("h-8 w-40", pulse)} />
        <div className={cn("h-4 max-w-lg", pulse)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.04]"
          >
            <div className={cn("mb-2 h-3 w-24", pulse)} />
            <div className={cn("h-8 w-20", pulse)} />
          </div>
        ))}
      </div>
      <div className={cn("h-48 w-full rounded-2xl", pulse)} />
    </Shell>
  );
}

function PlaceholderModuleGrid() {
  return (
    <Shell label="Loading module">
      <div className="space-y-2">
        <div className={cn("h-8 w-48", pulse)} />
        <div className={cn("h-4 max-w-xl", pulse)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 dark:border-white/10 dark:bg-white/[0.03]"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className={cn("size-12 rounded-xl", pulse)} />
              <div className="flex-1 space-y-2">
                <div className={cn("h-4 w-3/4", pulse)} />
                <div className={cn("h-3 w-1/2", pulse)} />
              </div>
            </div>
            <div className={cn("h-24 w-full rounded-lg", pulse)} />
          </div>
        ))}
      </div>
    </Shell>
  );
}

function PlaceholderSimple() {
  return (
    <Shell label="Loading page">
      <div className={cn("h-8 w-48", pulse)} />
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 dark:border-white/10 dark:bg-white/[0.03]"
          >
            <div className={cn("mb-4 h-5 w-40", pulse)} />
            <div className="space-y-2">
              <div className={cn("h-4 w-full", pulse)} />
              <div className={cn("h-4 w-5/6", pulse)} />
              <div className={cn("h-4 w-2/3", pulse)} />
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

function PlaceholderDetail() {
  return (
    <Shell label="Loading details">
      <div className={cn("h-7 w-28 rounded-full", pulse)} />
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="lg:w-72 shrink-0 space-y-4">
          <div className={cn("mx-auto aspect-square w-40 rounded-2xl", pulse)} />
          <div className={cn("h-4 w-full", pulse)} />
          <div className={cn("h-4 w-3/4", pulse)} />
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <div className={cn("h-9 w-2/3 max-w-md", pulse)} />
          <div className="rounded-2xl border border-slate-200/80 p-4 dark:border-white/10">
            <div className="space-y-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={cn("h-4 w-full", pulse)} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function PlaceholderOffboarding() {
  return (
    <Shell label="Loading offboarding">
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn("h-10 w-28 rounded-full", pulse)} />
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-6 dark:border-white/10 dark:bg-white/[0.03]">
        <div className={cn("mb-6 h-7 w-52", pulse)} />
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={cn("h-24 rounded-xl", pulse)} />
          ))}
        </div>
      </div>
    </Shell>
  );
}

function PlaceholderDefault() {
  return <PlaceholderHome />;
}

export function DashboardLoadingByVariant({
  variant,
}: {
  variant: DashboardLoadingVariant;
}) {
  switch (variant) {
    case "home":
      return <PlaceholderHome />;
    case "tabs":
      return <PlaceholderTabs />;
    case "tableFilters":
      return <PlaceholderTableFilters />;
    case "dataTable":
      return <PlaceholderDataTable />;
    case "reports":
      return <PlaceholderReports />;
    case "payroll":
      return <PlaceholderPayroll />;
    case "moduleGrid":
      return <PlaceholderModuleGrid />;
    case "simple":
      return <PlaceholderSimple />;
    case "detail":
      return <PlaceholderDetail />;
    case "offboarding":
      return <PlaceholderOffboarding />;
    default:
      return <PlaceholderDefault />;
  }
}
