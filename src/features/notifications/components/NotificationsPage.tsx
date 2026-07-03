"use client";

import { useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSearchParams } from "next/navigation";
import { Bell } from "lucide-react";
import { DashboardSectionTopBar } from "@/components/layout/DashboardSectionTopBar";
import { EmployeeSectionHeader } from "@/components/layout/EmployeeSectionHeader";
import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { getNotificationsForRole } from "@/features/notifications/services/notifications.service";

export default function NotificationsPage() {
  const { user } = useCurrentUser();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("selected");
  const notifications = useMemo(() => getNotificationsForRole(user.role), [user.role]);

  const selectedNotification = useMemo(
    () => notifications.find((n) => n.id === selectedId) ?? null,
    [selectedId, notifications]
  );

  useEffect(() => {
    if (!selectedId) return;
    const el = document.getElementById(`notification-${selectedId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId]);

  return (
    <div className="min-w-0 w-full max-w-full space-y-7">
      {/* Topbar + navbar */}
      <div className="min-w-0 space-y-3">
        {user.role === "EMPLOYEE" || user.role === "HR_STAFF" ? (
          <div className="flex flex-col gap-6">
            <EmployeeModuleTopbar searchPlaceholder="Search" />
            <EmployeeSectionHeader title="Updates" />
          </div>
        ) : (
          <>
            <DashboardSectionTopBar
              breadcrumb={
                <>
                  <span className="truncate font-semibold">Notifications</span>
                  <span className="shrink-0 opacity-70">&gt;</span>
                  <span className="truncate font-semibold text-foreground">Notifications</span>
                </>
              }
              searchPlaceholder="Search notifications..."
            />

            <div className="border-b border-border/70">
              <div className="-mx-1 flex gap-1 overflow-x-auto py-1 [scrollbar-width:thin] sm:gap-6 lg:gap-8 [&::-webkit-scrollbar]:h-1.5">
                <button
                  type="button"
                  className="relative flex shrink-0 items-center gap-2 whitespace-nowrap pb-3 -mb-px px-2 text-sm font-medium text-primary transition-colors sm:text-base"
                >
                  <Bell className="size-4 shrink-0" />
                  <span>Notifications</span>
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-100 bg-primary transition-transform duration-200" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main content */}
      <Card className="min-w-0">
        <CardHeader className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Bell className="size-5 shrink-0" />
            Updates
          </CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 px-3 sm:px-6">
          {selectedNotification && (
            <div className="mb-4 rounded-2xl border border-border/70 bg-accent/40 px-3 py-3 sm:px-4">
              <p className="text-sm font-semibold">Selected</p>
              <p className="mt-1 text-sm">{selectedNotification.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {selectedNotification.body}
              </p>
            </div>
          )}

          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No new notifications at this time.
            </p>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => {
                const isSelected = n.id === selectedId;
                return (
                  <div
                    key={n.id}
                    id={`notification-${n.id}`}
                    className={[
                      "rounded-2xl border px-3 py-3 transition-colors sm:px-4",
                      isSelected
                        ? "border-primary/40 bg-primary/5"
                        : "border-border/70 bg-background",
                    ].join(" ")}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold break-words">{n.title}</p>
                        <p className="mt-0.5 break-words text-xs text-muted-foreground">
                          {n.body}
                        </p>
                      </div>
                      <span className="text-[11px] text-muted-foreground sm:shrink-0">
                        {n.time}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
