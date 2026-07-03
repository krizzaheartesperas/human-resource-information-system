"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getNotificationsForRole,
  getUnreadCount,
} from "@/features/notifications/services/notifications.service";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { getPortalPaths } from "@/core/routes/portal-routes";

type Props = {
  /** Adjust bell icon size. Defaults to `size-5` (matches most topbars). */
  iconClassName?: string;
  /** Optional wrapper class for the button element. */
  buttonClassName?: string;
};

export default function NotificationsBellMenu({
  iconClassName = "size-5",
  buttonClassName,
}: Props) {
  const { user } = useCurrentUser();
  const paths = useMemo(() => getPortalPaths(user.role), [user.role]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const notifications = useMemo(() => getNotificationsForRole(user.role), [user.role]);
  const unreadCount = useMemo(() => getUnreadCount(notifications), [notifications]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!open) return;
      const root = rootRef.current;
      if (!root) return;
      if (e.target instanceof Node && !root.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={cn("rounded-full relative", buttonClassName)}
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className={iconClassName} />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground shadow"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="menu"
          aria-label="Notifications menu"
          className="absolute right-0 top-[calc(100%+10px)] z-50 w-[360px] rounded-2xl border border-border/80 bg-background/95 shadow-2xl shadow-black/15 ring-1 ring-black/5 backdrop-blur-xl dark:shadow-black/50 dark:ring-white/10 dark:border-white/15 animate-in fade-in-0 zoom-in-95 duration-150"
        >
          <div className="px-4 py-3 border-b border-border/70">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Notifications</p>
              {unreadCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  {unreadCount} unread
                </span>
              )}
            </div>
          </div>

          <div className="max-h-[360px] overflow-auto scrollbar-hide py-2">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications
              </div>
            ) : (
              <div className="space-y-1">
                {notifications.map((n) => (
                  <Link
                    key={n.id}
                    href={`${paths.notifications}?selected=${encodeURIComponent(n.id)}`}
                    role="menuitem"
                    className={cn(
                      "mx-2 block rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-accent/90 hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      n.unread && "bg-accent/50"
                    )}
                    onClick={() => setOpen(false)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {n.unread && (
                            <span
                              aria-hidden="true"
                              className="mt-1 size-2 rounded-full bg-primary shrink-0"
                            />
                          )}
                          <p className="font-medium truncate">{n.title}</p>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                          {n.body}
                        </p>
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {n.time}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border/70 px-3 py-2">
            <Link
              href={paths.notifications}
              className="block rounded-xl px-3 py-2 text-sm font-medium text-primary hover:bg-accent/70"
              onClick={() => setOpen(false)}
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
