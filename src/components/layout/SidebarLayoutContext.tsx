"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type SidebarLayoutValue = {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  closeMobile: () => void;
};

const SidebarLayoutContext = createContext<SidebarLayoutValue | null>(null);

export function SidebarLayoutProvider({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const value = useMemo(
    () => ({
      mobileOpen,
      setMobileOpen,
      closeMobile,
    }),
    [mobileOpen, closeMobile]
  );

  return (
    <SidebarLayoutContext.Provider value={value}>
      {children}
    </SidebarLayoutContext.Provider>
  );
}

export function useSidebarLayout(): SidebarLayoutValue {
  const ctx = useContext(SidebarLayoutContext);
  if (!ctx) {
    return {
      mobileOpen: false,
      setMobileOpen: () => {},
      closeMobile: () => {},
    };
  }
  return ctx;
}
