"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { Settings as SettingsIcon } from "lucide-react";
import { DashboardSectionTopBar } from "@/components/layout/DashboardSectionTopBar";
import { EmployeeSectionHeader } from "@/components/layout/EmployeeSectionHeader";
import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";

type WorkdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

type HrisSettings = {
  companyName: string;
  timezone: string;
  workdayStart: string;
  workdayEnd: string;
  workdays: WorkdayKey[];
  requireLeaveApproval: boolean;
  leaveSlaDays: number | "";
};

const SETTINGS_STORAGE_KEY = "hris-settings";

type EmployeeTimeFormat = "12h" | "24h";

type EmployeeSettings = {
  language: string;
  timeFormat: EmployeeTimeFormat;
  emailNotifications: boolean;
  inAppNotifications: boolean;
  weeklySummary: boolean;
};

const EMPLOYEE_SETTINGS_STORAGE_KEY_PREFIX = "hris-employee-settings:";

const DEFAULT_SETTINGS: HrisSettings = {
  companyName: "Acme Corporation",
  timezone: "Asia/Manila (GMT+8)",
  workdayStart: "09:00",
  workdayEnd: "18:00",
  workdays: ["mon", "tue", "wed", "thu", "fri"],
  requireLeaveApproval: true,
  leaveSlaDays: 2,
};

const DEFAULT_EMPLOYEE_SETTINGS: EmployeeSettings = {
  language: "English",
  timeFormat: "24h",
  emailNotifications: true,
  inAppNotifications: true,
  weeklySummary: false,
};

const WORKDAY_LABELS: Record<WorkdayKey, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

function loadHrisSettingsFromStorage(): HrisSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<HrisSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadEmployeeSettingsFromStorage(employeeId: string): EmployeeSettings {
  if (typeof window === "undefined") return DEFAULT_EMPLOYEE_SETTINGS;
  const key = `${EMPLOYEE_SETTINGS_STORAGE_KEY_PREFIX}${employeeId}`;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return DEFAULT_EMPLOYEE_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<EmployeeSettings>;
    return { ...DEFAULT_EMPLOYEE_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_EMPLOYEE_SETTINGS;
  }
}

export default function SettingsPage() {
  const { user: currentUser } = useCurrentUser();
  const [settings, setSettings] = useState<HrisSettings>(() => loadHrisSettingsFromStorage());
  const [employeeSettings, setEmployeeSettings] = useState<EmployeeSettings>(() =>
    loadEmployeeSettingsFromStorage(currentUser.employeeId)
  );
  const lastEmployeeIdRef = useRef(currentUser.employeeId);

  useEffect(() => {
    if (lastEmployeeIdRef.current === currentUser.employeeId) return;
    lastEmployeeIdRef.current = currentUser.employeeId;
    const id = window.setTimeout(() => {
      setEmployeeSettings(loadEmployeeSettingsFromStorage(currentUser.employeeId));
    }, 0);
    return () => window.clearTimeout(id);
  }, [currentUser.employeeId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `${EMPLOYEE_SETTINGS_STORAGE_KEY_PREFIX}${currentUser.employeeId}`;
    try {
      window.localStorage.setItem(key, JSON.stringify(employeeSettings));
    } catch {
      // ignore
    }
  }, [employeeSettings, currentUser.employeeId]);

  const toggleWorkday = (key: WorkdayKey) => {
    setSettings((prev) => {
      const has = prev.workdays.includes(key);
      const nextDays = has
        ? prev.workdays.filter((d) => d !== key)
        : [...prev.workdays, key];
      const order: WorkdayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
      return {
        ...prev,
        workdays: nextDays.sort(
          (a, b) => order.indexOf(a) - order.indexOf(b)
        ),
      };
    });
  };

  const isOrgAdmin =
    currentUser.role === "SUPER_ADMIN" || currentUser.role === "HR_ADMIN";

  const settingsTabs = (
    <div className="border-b border-border/70">
      <div className="-mx-1 flex gap-1 overflow-x-auto py-1 [scrollbar-width:thin] sm:gap-6 lg:gap-8 [&::-webkit-scrollbar]:h-1.5">
        <button
          type="button"
          className="relative flex shrink-0 items-center gap-2 whitespace-nowrap pb-3 -mb-px px-2 text-sm font-medium text-primary transition-colors sm:text-base"
        >
          <SettingsIcon className="size-4 shrink-0" />
          <span>Settings</span>
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-100 bg-primary transition-transform duration-200" />
        </button>
      </div>
    </div>
  );

  if (!isOrgAdmin) {
    return (
      <div className="min-w-0 w-full max-w-full space-y-7">
        <div className="min-w-0 space-y-3">
          {currentUser.role === "EMPLOYEE" || currentUser.role === "HR_STAFF" ? (
            <div className="flex flex-col gap-6">
              <EmployeeModuleTopbar searchPlaceholder="Search" />
              <EmployeeSectionHeader title="Settings" />
            </div>
          ) : (
            <>
              <DashboardSectionTopBar
                breadcrumb={
                  <>
                    <span className="truncate font-semibold">Settings</span>
                    <span className="shrink-0 opacity-70">&gt;</span>
                    <span className="truncate font-semibold text-foreground">Settings</span>
                  </>
                }
                searchPlaceholder="Search settings..."
              />
              {settingsTabs}
            </>
          )}
        </div>

        {/* Main content */}
        <div className="grid min-w-0 gap-6 md:grid-cols-2">
          <Card className="min-w-0">
            <CardHeader className="min-w-0">
              <CardTitle className="text-base sm:text-lg">Personal preferences</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4 px-3 text-sm sm:px-6">
              <div className="space-y-2">
                <Label htmlFor="employee-language">Preferred language</Label>
                <Input
                  id="employee-language"
                  value={employeeSettings.language}
                  onChange={(e) =>
                    setEmployeeSettings((prev) => ({
                      ...prev,
                      language: e.target.value,
                    }))
                  }
                  placeholder="e.g. English"
                />
              </div>
              <div className="space-y-2">
                <Label>Time format</Label>
                <div className="flex gap-2">
                  {(["12h", "24h"] as EmployeeTimeFormat[]).map((fmt) => {
                    const active = employeeSettings.timeFormat === fmt;
                    return (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() =>
                          setEmployeeSettings((prev) => ({
                            ...prev,
                            timeFormat: fmt,
                          }))
                        }
                        className={[
                          "px-3 py-1 rounded-full border text-xs font-medium transition-colors",
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:bg-accent",
                        ].join(" ")}
                      >
                        {fmt === "12h" ? "12-hour" : "24-hour"}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Used when showing times on your dashboard and requests.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader className="min-w-0">
              <CardTitle className="text-base sm:text-lg">Notifications</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4 px-3 text-sm sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <div className="font-medium">Email notifications</div>
                  <p className="text-xs text-muted-foreground">
                    Get emails when your requests are approved, rejected, or
                    need more information.
                  </p>
                </div>
                <label className="inline-flex shrink-0 items-center gap-2 text-xs sm:pt-0.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border border-input"
                    checked={employeeSettings.emailNotifications}
                    onChange={(e) =>
                      setEmployeeSettings((prev) => ({
                        ...prev,
                        emailNotifications: e.target.checked,
                      }))
                    }
                  />
                  <span>Enabled</span>
                </label>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <div className="font-medium">In-app alerts</div>
                  <p className="text-xs text-muted-foreground">
                    Show alerts inside HRIS when something needs your
                    attention.
                  </p>
                </div>
                <label className="inline-flex shrink-0 items-center gap-2 text-xs sm:pt-0.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border border-input"
                    checked={employeeSettings.inAppNotifications}
                    onChange={(e) =>
                      setEmployeeSettings((prev) => ({
                        ...prev,
                        inAppNotifications: e.target.checked,
                      }))
                    }
                  />
                  <span>Enabled</span>
                </label>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <div className="font-medium">Weekly summary</div>
                  <p className="text-xs text-muted-foreground">
                    Receive a weekly email summary of your open requests and
                    approvals.
                  </p>
                </div>
                <label className="inline-flex shrink-0 items-center gap-2 text-xs sm:pt-0.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border border-input"
                    checked={employeeSettings.weeklySummary}
                    onChange={(e) =>
                      setEmployeeSettings((prev) => ({
                        ...prev,
                        weeklySummary: e.target.checked,
                      }))
                    }
                  />
                  <span>Enabled</span>
                </label>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full max-w-full space-y-6">
      <div className="min-w-0 space-y-3">
        <DashboardSectionTopBar
          breadcrumb={
            <>
              <span className="truncate font-semibold">Settings</span>
              <span className="shrink-0 opacity-70">&gt;</span>
              <span className="truncate font-semibold text-foreground">Organization</span>
            </>
          }
          searchPlaceholder="Search settings..."
        />
        {settingsTabs}
      </div>

      <div className="grid min-w-0 gap-6 md:grid-cols-2">
        {/* Organization settings */}
        <Card className="min-w-0">
          <CardHeader className="min-w-0">
            <CardTitle className="text-base sm:text-lg">Organization</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4 px-3 text-sm sm:px-6">
            <div className="space-y-2">
              <Label htmlFor="company-name">Company name</Label>
              <Input
                id="company-name"
                value={settings.companyName}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, companyName: e.target.value }))
                }
                placeholder="Your company name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Default time zone</Label>
              <Input
                id="timezone"
                value={settings.timezone}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, timezone: e.target.value }))
                }
                placeholder="e.g. Asia/Manila (GMT+8)"
              />
              <p className="text-xs text-muted-foreground">
                Used for working hours, leave dates, and attendance summaries.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Work schedule */}
        <Card className="min-w-0">
          <CardHeader className="min-w-0">
            <CardTitle className="text-base sm:text-lg">Work schedule</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4 px-3 text-sm sm:px-6">
            <div className="space-y-2">
              <Label>Working days</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(WORKDAY_LABELS) as WorkdayKey[]).map((key) => {
                  const active = settings.workdays.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleWorkday(key)}
                      className={[
                        "px-3 py-1 rounded-full border text-xs font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:bg-accent",
                      ].join(" ")}
                    >
                      {WORKDAY_LABELS[key]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="workday-start">Workday start</Label>
                <Input
                  id="workday-start"
                  type="time"
                  value={settings.workdayStart}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, workdayStart: e.target.value }))
                  }
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="workday-end">Workday end</Label>
                <Input
                  id="workday-end"
                  type="time"
                  value={settings.workdayEnd}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, workdayEnd: e.target.value }))
                  }
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              These defaults will guide future modules like attendance rules and scheduling.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Leave settings */}
      <Card className="min-w-0">
        <CardHeader className="min-w-0">
          <CardTitle className="text-base sm:text-lg">Leave & approval</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4 px-3 text-sm sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <div className="font-medium">Require approval for leave requests</div>
              <p className="text-xs text-muted-foreground">
                When enabled, new leave requests must go through the workflow engine before being
                applied.
              </p>
            </div>
            <label className="inline-flex shrink-0 items-center gap-2 text-xs sm:pt-0.5">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border border-input"
                checked={settings.requireLeaveApproval}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    requireLeaveApproval: e.target.checked,
                  }))
                }
              />
              <span>Enabled</span>
            </label>
          </div>
          <div className="max-w-full space-y-2 sm:max-w-xs">
            <Label htmlFor="leave-sla">Target approval SLA (business days)</Label>
            <Input
              id="leave-sla"
              type="number"
              min={1}
              value={settings.leaveSlaDays}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  leaveSlaDays: e.target.value === "" ? "" : Number(e.target.value),
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Used for reporting and reminders. Does not block approvals.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Super admin tools */}
      <div className="grid min-w-0 gap-6 md:grid-cols-3">
        <Card className="min-w-0">
          <CardHeader className="min-w-0">
            <CardTitle className="text-base sm:text-lg">User accounts</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 space-y-3 px-3 text-sm sm:px-6">
            <p className="text-muted-foreground">
              Manage HRIS user accounts and assign them to roles like HR Administrator, HR
              Manager, HR Staff, Department Manager, Employee, and Auditor.
            </p>
            <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
              <li>Create and deactivate user accounts</li>
              <li>Assign default role and department</li>
              <li>Reset access (coming soon)</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="min-w-0">
            <CardTitle className="text-base sm:text-lg">Roles &amp; permissions</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 space-y-3 px-3 text-sm sm:px-6">
            <p className="text-muted-foreground">
              High-level view of what each role can see and do across the system.
            </p>
            <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
              <li>Super Admin – full system control</li>
              <li>HR Admin / HR Manager / HR Staff – HR operations</li>
              <li>Department Manager – team approvals</li>
              <li>Employee – self-service</li>
              <li>Auditor – read-only access</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="min-w-0">
            <CardTitle className="text-base sm:text-lg">System activity &amp; logs</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 space-y-3 px-3 text-sm sm:px-6">
            <p className="text-muted-foreground">
              Central place to review audit logs, approvals, and key changes across HR modules.
            </p>
            <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
              <li>View login and approval history (via Audit Reports)</li>
              <li>Track changes to employees, leave, workflows</li>
              <li>Export logs for compliance (coming soon)</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

