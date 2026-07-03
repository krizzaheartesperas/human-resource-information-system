"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { signOutApp } from "@/lib/auth-actions";
import { cn } from "@/lib/utils";

export default function Topbar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const hideTopbarPaths = [
    "/employees",
    "/leave",
    "/requests",
    "/audit",
    "/departments",
    "/attendance",
    "/my-time",
    "/organization",
    "/notifications",
    "/help",
    "/account",
    "/profile",
    "/reports",
    "/settings",
  ];
  // Hide topbar on dashboard (/) and on key app sections where the page has its own header
  if (
    pathname === "/" ||
    hideTopbarPaths.some((p) => pathname === p || (p !== "/" && pathname.startsWith(p)))
  )
    return null;

  const pageTitle = pathname === "/" ? "" : pathname === "/settings" ? "Settings" : "Dashboard";

  return (
    <header className={cn(
      "h-14 border-b flex items-center justify-between px-6 shrink-0",
      theme === "dark" 
        ? "border-white/10 bg-[#161b30] text-slate-50" 
        : "border-slate-300/80 bg-white text-[#192853]"
    )}>
      <div>
        {pageTitle && <h1 className="text-lg font-semibold tracking-tight text-[#192853]">{pageTitle}</h1>}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {theme === "dark" ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void signOutApp().then(() => {
              window.location.href = "/login";
            });
          }}
        >
          <LogOut className="size-4 mr-2" />
          Sign out
        </Button>
      </div>
    </header>
  );
}
