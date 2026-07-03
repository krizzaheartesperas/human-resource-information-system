import { useCallback, useEffect, useMemo } from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { allowedTabsByRole, defaultTabByRole } from "@/features/leave/constants/leaveRoleTabs";

type Args = {
  searchParams: ReadonlyURLSearchParams;
  currentUserRole: string;
  onReplace: (href: string) => void;
};

export function useLeaveRouting({ searchParams, currentUserRole, onReplace }: Args) {
  const requested = (searchParams.get("tab") ?? "").trim();
  const allowed = allowedTabsByRole[currentUserRole] ?? allowedTabsByRole.DEFAULT;
  const fallback = defaultTabByRole[currentUserRole] ?? defaultTabByRole.DEFAULT;
  const tab = useMemo(
    () => (!requested ? "my-report" : allowed.includes(requested) ? requested : fallback),
    [requested, allowed, fallback],
  );

  useEffect(() => {
    if (requested && requested !== tab) {
      onReplace(`/leave?tab=${encodeURIComponent(tab)}`);
    }
  }, [requested, tab, onReplace]);

  const setTab = useCallback(
    (next: string) => {
      onReplace(`/leave?tab=${encodeURIComponent(next)}`);
    },
    [onReplace],
  );

  return { tab, setTab };
}
