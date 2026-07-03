"use client";

import { useEffect, useState } from "react";
import { MessageCircleMore, Moon, Search, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import NotificationsBellMenu from "@/components/layout/NotificationsBellMenu";
import TopbarAccountMenu from "@/components/layout/TopbarAccountMenu";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { ReactNode } from "react";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { EmployeeMessengerDialog } from "@/features/chat/components/EmployeeMessengerDialog";
import {
  getEmployeeChatUnreadCount,
  loadEmployeeChatConversations,
} from "@/features/chat/services/employeeChat.service";

type EmployeeModuleTopbarProps = {
  searchPlaceholder?: string;
  searchInputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  rightExtras?: ReactNode;
  /** Optional override for the outer topbar container (role-specific theming). */
  containerClassName?: string;
};

export function EmployeeModuleTopbar({
  searchPlaceholder = "Search",
  searchInputProps,
  rightExtras,
  containerClassName,
}: EmployeeModuleTopbarProps) {
  const { theme, toggleTheme } = useTheme();
  const { user } = useCurrentUser();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatTargetName, setChatTargetName] = useState<string | null>(null);
  const unreadCount = user.employeeId
    ? getEmployeeChatUnreadCount(
        loadEmployeeChatConversations({
          employeeId: user.employeeId,
          employeeName: user.name,
        }),
        user.employeeId
      )
    : 0;

  useEffect(() => {
    const handleOpenEmployeeChat = (event: Event) => {
      const customEvent = event as CustomEvent<{ participantName?: string | null }>;
      setChatTargetName(customEvent.detail?.participantName ?? null);
      setChatOpen(true);
    };

    window.addEventListener("employee-chat:open", handleOpenEmployeeChat as EventListener);
    return () => window.removeEventListener("employee-chat:open", handleOpenEmployeeChat as EventListener);
  }, []);

  return (
    <>
      <div className={cn(
        "rounded-2xl border px-3 py-2 shadow-sm sm:px-4",
        theme === "dark" 
          ? "border-white/10 bg-[#161b30] text-slate-50" 
          : "border-border/70 bg-card",
        containerClassName
      )}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              className={cn(
                "h-10 rounded-2xl pl-10 text-sm transition-all",
                theme === "dark" 
                  ? "border-white/10 bg-white/5 placeholder:text-slate-500 focus:bg-white/10" 
                  : "border-border/70 bg-white"
              )}
              aria-label={searchPlaceholder}
              {...searchInputProps}
            />
          </div>
          <div className="flex min-w-0 shrink-0 flex-row items-center justify-end gap-2">
            {rightExtras}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={cn(
                "h-9 w-9 rounded-md border-0 bg-transparent shadow-none hover:bg-transparent focus-visible:bg-transparent",
                theme === "dark" ? "text-slate-200 hover:text-white" : "text-[#5A6B93]"
              )}
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              {theme === "dark" ? <Sun className="size-7" /> : <Moon className="size-7" />}
            </Button>

            <NotificationsBellMenu
              iconClassName={cn("size-7", theme === "dark" ? "text-slate-200" : "text-[#5A6B93]")}
              buttonClassName={cn(
                "h-9 w-9 rounded-none border-0 bg-transparent shadow-none hover:bg-transparent focus-visible:bg-transparent",
                theme === "dark" ? "text-slate-200 hover:text-white" : "text-[#5A6B93]"
              )}
            />

            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={cn(
                "relative h-9 w-9 rounded-md border-0 bg-transparent shadow-none hover:bg-transparent focus-visible:bg-transparent",
                theme === "dark" ? "text-slate-200 hover:text-white" : "text-[#5A6B93]"
              )}
              aria-label="Messages"
              onClick={() => {
                setChatTargetName(null);
                setChatOpen(true);
              }}
            >
              <MessageCircleMore className="size-7" />
              {unreadCount > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground shadow"
                >
                  {unreadCount}
                </span>
              ) : null}
            </Button>

            <TopbarAccountMenu
              showName
              triggerClassName={cn(
                "h-9 gap-2 rounded-full border border-[#E6ECFA] bg-white px-2.5 shadow-sm transition-colors",
                theme === "dark" ? "border-white/15 bg-white/5 hover:bg-white/10" : "bg-white"
              )}
              userIconClassName="size-7"
              chevronIconClassName="size-4"
              nameClassName={cn("max-w-28 text-sm", theme === "dark" ? "text-slate-100" : "text-[#7B879F]")}
            />
          </div>
        </div>
      </div>
      <EmployeeMessengerDialog
        key={`topbar-chat-${chatTargetName ?? "default"}-${chatOpen ? "open" : "closed"}`}
        open={chatOpen}
        onOpenChange={(nextOpen) => {
          setChatOpen(nextOpen);
          if (!nextOpen) setChatTargetName(null);
        }}
        user={user}
        initialParticipantName={chatTargetName}
      />
    </>
  );
}
