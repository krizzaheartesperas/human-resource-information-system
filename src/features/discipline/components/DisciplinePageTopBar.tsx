"use client";

import NotificationsBellMenu from "@/components/layout/NotificationsBellMenu";
import SettingsIconLink from "@/components/layout/SettingsIconLink";
import TopbarAccountMenu from "@/components/layout/TopbarAccountMenu";
import { useTheme } from "@/components/theme/ThemeProvider";
import { FileText, Moon, Sun } from "lucide-react";

export function DisciplinePageTopBar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="space-y-3 mt-[10px]">
      <div className="flex items-center gap-4">
        <div className="flex flex-1 items-center gap-1.5 text-base text-muted-foreground">
          <span className="font-semibold">Disciplinary Records</span>
          <span className="opacity-70">&gt;</span>
          <span className="font-semibold text-foreground">Overview</span>
        </div>

        <div className="hidden">
          <div className="w-full max-w-lg">
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-base text-muted-foreground transition-colors focus-within:border-[#192853] focus-within:ring-1 focus-within:ring-[#192853] hover:border-[#192853]">
              <FileText className="h-4 w-4 opacity-70" />
              <input
                type="text"
                placeholder="Search disciplinary cases..."
                className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:ring-transparent focus-visible:border-transparent topbar-search-input"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 flex justify-end items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <NotificationsBellMenu />
          <SettingsIconLink />
          <TopbarAccountMenu />
        </div>
      </div>

      <div className="border-b border-border/70">
        <div className="flex gap-6 text-sm sm:text-base">
          <button
            type="button"
            className="relative flex items-center gap-2 pb-3 -mb-px px-1 text-primary font-medium"
          >
            <FileText className="h-4 w-4" />
            <span>Disciplinary Records</span>
            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left bg-primary transition-transform duration-200 scale-x-100" />
          </button>
        </div>
      </div>
    </div>
  );
}
