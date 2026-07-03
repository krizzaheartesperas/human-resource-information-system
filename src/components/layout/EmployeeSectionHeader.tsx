"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type EmployeeSectionTab = { id: string; label: string };

export type EmployeeSectionHeaderProps = {
  title: string;
  description?: ReactNode;
  /** When omitted or empty, the underline tab row is not shown. */
  tabs?: EmployeeSectionTab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  /** Right side of the title row (e.g. primary buttons). */
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
};

/**
 * Shared page header for regular employee modules: title, optional description
 * and actions, optional My Time–style tab strip.
 */
export function EmployeeSectionHeader({
  title,
  description,
  tabs,
  activeTab,
  onTabChange,
  actions,
  className,
  titleClassName,
}: EmployeeSectionHeaderProps) {
  const showTabs = Boolean(tabs?.length);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className={cn("text-3xl font-semibold tracking-tight text-foreground", titleClassName)}>
            {title}
          </h1>
          {description ? (
            <div className="max-w-prose text-sm text-muted-foreground">{description}</div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        ) : null}
      </div>

      {showTabs && activeTab && onTabChange ? (
        <div className="flex w-full max-w-5xl gap-1 overflow-x-auto border-b border-border pb-px [scrollbar-width:thin]">
          {tabs!.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={cn(
                "relative shrink-0 px-4 py-2.5 text-sm font-normal transition-colors",
                activeTab === t.id
                  ? "text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[#192853] dark:after:bg-accent"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
