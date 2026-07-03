"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeletonRows } from "@/components/ui/table-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";
import { EmployeeSectionHeader } from "@/components/layout/EmployeeSectionHeader";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { getPortalPaths } from "@/core/routes/portal-routes";
import { useTheme } from "@/components/theme/ThemeProvider";
import {
  BarChart3,
  Ban,
  Eye,
  FileText,
  ListTodo,
  Pencil,
  Power,
  Settings,
  UserPlus2,
} from "lucide-react";
import { employees } from "@/lib/mock";
import { cn } from "@/lib/utils";

type ComplaintStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "INVESTIGATING"
  | "INVESTIGATED"
  | "FURTHER_INVESTIGATION_REQUIRED"
  | "INVESTIGATION_COMPLETED"
  | "RESOLVED"
  | "WITHDRAWN"
  | "ESCALATED";

type ComplaintPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type Complaint = {
  id: string;
  title: string;
  typeLabel?: string;
  employeeName?: string;
  departmentName?: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  assignedHr?: string;
  createdAt: string;
};
type StoredComplaintRow = Partial<Complaint> & {
  id: string;
  title?: string;
  description?: string;
  type?: string;
  employeeName?: string;
  isAnonymous?: boolean;
  departmentName?: string;
  assignedHr?: string;
  submittedAt?: string;
  createdAt?: string;
  priority?: ComplaintPriority;
  status?: ComplaintStatus;
};

type ComplaintSettings = {
  defaultPriority: ComplaintPriority;
  autoEscalateAfterDays: number;
  allowAnonymous: boolean;
  slaResponseHours: number;
};

type ComplaintCategory = {
  id: string;
  name: string;
  description: string;
  severityLevel: "LOW" | "MEDIUM" | "HIGH";
  status: "ACTIVE" | "INACTIVE";
};

const COMPLAINTS_STORAGE_KEY = "hris-complaints";
const COMPLAINT_SETTINGS_KEY = "hris-complaint-settings";
const COMPLAINT_CATEGORIES_KEY = "hris-complaint-categories";

const DEFAULT_SETTINGS: ComplaintSettings = {
  defaultPriority: "MEDIUM",
  autoEscalateAfterDays: 3,
  allowAnonymous: true,
  slaResponseHours: 24,
};

const DEFAULT_CATEGORIES: ComplaintCategory[] = [
  { id: "cat-1", name: "Workplace Harassment", description: "Harassment or bullying in the workplace", severityLevel: "HIGH", status: "ACTIVE" },
  { id: "cat-2", name: "Discrimination", description: "Discrimination based on protected characteristics", severityLevel: "HIGH", status: "ACTIVE" },
  { id: "cat-3", name: "Policy Violation", description: "Violation of company policies", severityLevel: "MEDIUM", status: "ACTIVE" },
  { id: "cat-4", name: "Workplace Conflict", description: "Interpersonal conflicts between employees", severityLevel: "MEDIUM", status: "ACTIVE" },
  { id: "cat-5", name: "Theft", description: "Theft or misuse of company property", severityLevel: "HIGH", status: "ACTIVE" },
];

function loadComplaints(): Complaint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COMPLAINTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredComplaintRow[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((c) => ({
      id: c.id,
      title: c.title ?? c.description ?? "Complaint",
      typeLabel: c.type ?? "Complaint",
      employeeName: c.employeeName ?? (c.isAnonymous ? "Anonymous" : "—"),
      departmentName: c.departmentName ?? "—",
      priority: (c.priority ?? "MEDIUM") as ComplaintPriority,
      status: (c.status ?? "SUBMITTED") as ComplaintStatus,
      assignedHr: c.assignedHr ?? "Unassigned",
      createdAt: c.submittedAt ?? c.createdAt ?? new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

function loadSettings(): ComplaintSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(COMPLAINT_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as ComplaintSettings;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: ComplaintSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COMPLAINT_SETTINGS_KEY, JSON.stringify(settings));
}

function loadCategories(): ComplaintCategory[] {
  if (typeof window === "undefined") return DEFAULT_CATEGORIES;
  try {
    const raw = window.localStorage.getItem(COMPLAINT_CATEGORIES_KEY);
    if (!raw) return DEFAULT_CATEGORIES;
    const parsed = JSON.parse(raw) as ComplaintCategory[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CATEGORIES;
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

function saveCategories(categories: ComplaintCategory[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COMPLAINT_CATEGORIES_KEY, JSON.stringify(categories));
}

const hrOfficers = employees.filter((e) =>
  ["HR_ADMIN", "HR_MANAGER", "HR_STAFF"].includes(e.role as string)
);

export default function ComplaintsAdminPage() {
  const { user } = useCurrentUser();
  const paths = useMemo(() => getPortalPaths(user.role), [user.role]);
  const { theme } = useTheme();
  const complaintsCardClass = cn(
    "rounded-[32px] border-none shadow-sm",
    theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
  );
  const tableViewActionClass = cn(
    "h-8 rounded-full px-3 text-xs font-semibold transition-all duration-200",
    "border shadow-sm hover:-translate-y-0.5",
    theme === "dark"
      ? "border-[#35548f] bg-[#0f1f3f] text-[#dce9ff] hover:bg-[#17305f] hover:text-white"
      : "border-[#c8d8ff] bg-[#f5f9ff] text-[#1b3a74] hover:bg-[#e7f0ff] hover:text-[#0f2d61]"
  );
  const tableAssignActionClass = cn(
    "h-8 rounded-full px-3 text-xs font-semibold transition-all duration-200",
    "border shadow-sm hover:-translate-y-0.5",
    theme === "dark"
      ? "border-[#6a588e] bg-[#261f3b] text-[#e7dcff] hover:bg-[#322851] hover:text-white"
      : "border-[#ddcdfc] bg-[#f8f4ff] text-[#5b3f8a] hover:bg-[#f0e9ff] hover:text-[#4b2f79]"
  );
  const searchParams = useSearchParams();
  const router = useRouter();
  const [complaints, setComplaints] = useState<Complaint[]>(() => loadComplaints());
  const [settings, setSettings] = useState<ComplaintSettings>(() => loadSettings());
  const [categories, setCategories] = useState<ComplaintCategory[]>(() => loadCategories());
  const [adminDataLoading] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [assignOfficerId, setAssignOfficerId] = useState("");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ComplaintCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState<{
    name: string;
    description: string;
    severityLevel: "LOW" | "MEDIUM" | "HIGH";
  }>({ name: "", description: "", severityLevel: "MEDIUM" });

  const tab = searchParams.get("tab") ?? "all";

  const updateComplaintAssign = (id: string, officerName: string) => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(COMPLAINTS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredComplaintRow[];
      const updated = parsed.map((c) =>
        c.id === id ? { ...c, assignedHr: officerName } : c
      );
      window.localStorage.setItem(COMPLAINTS_STORAGE_KEY, JSON.stringify(updated));
      setComplaints(loadComplaints());
    } catch {}
  };

  const handleAssignOfficer = () => {
    if (!selectedComplaintId || !assignOfficerId) return;
    const officer = hrOfficers.find((e) => e.id === assignOfficerId);
    const name = officer ? `${officer.firstName} ${officer.lastName}` : assignOfficerId;
    updateComplaintAssign(selectedComplaintId, name);
    setAssignDialogOpen(false);
    setSelectedComplaintId(null);
    setAssignOfficerId("");
  };

  const handleSaveSettings = () => {
    saveSettings(settings);
  };

  const handleSaveCategory = () => {
    let next: ComplaintCategory[];
    if (editingCategory) {
      next = categories.map((c) =>
        c.id === editingCategory.id
          ? {
              ...c,
              name: categoryForm.name,
              description: categoryForm.description,
              severityLevel: categoryForm.severityLevel as "LOW" | "MEDIUM" | "HIGH",
            }
          : c
      );
    } else {
      const newCat: ComplaintCategory = {
        id: `cat-${Date.now()}`,
        name: categoryForm.name,
        description: categoryForm.description,
        severityLevel: categoryForm.severityLevel as "LOW" | "MEDIUM" | "HIGH",
        status: "ACTIVE",
      };
      next = [...categories, newCat];
    }
    setCategories(next);
    saveCategories(next);
    setCategoryDialogOpen(false);
    setEditingCategory(null);
    setCategoryForm({ name: "", description: "", severityLevel: "MEDIUM" });
  };

  const toggleCategoryStatus = (id: string) => {
    const next: ComplaintCategory[] = categories.map((c) =>
      c.id === id
        ? {
            ...c,
            status: c.status === "ACTIVE" ? ("INACTIVE" as const) : ("ACTIVE" as const),
          }
        : c
    );
    setCategories(next);
    saveCategories(next);
  };

  const reportMetrics = useMemo(() => {
    const total = complaints.length;
    const resolved = complaints.filter((c) => c.status === "RESOLVED").length;
    const pending = complaints.filter(
      (c) =>
        !["RESOLVED", "WITHDRAWN"].includes(c.status)
    ).length;
    const escalated = complaints.filter((c) => c.status === "ESCALATED").length;
    const byDept = complaints.reduce<Record<string, number>>((acc, c) => {
      const d = c.departmentName ?? "Unknown";
      acc[d] = (acc[d] ?? 0) + 1;
      return acc;
    }, {});
    const byCategory = complaints.reduce<Record<string, number>>((acc, c) => {
      const t = c.typeLabel ?? "Other";
      acc[t] = (acc[t] ?? 0) + 1;
      return acc;
    }, {});
    return { total, resolved, pending, escalated, byDept, byCategory };
  }, [complaints]);

  const navTabs = [
    { id: "all", label: "All Complaints", icon: ListTodo },
    { id: "settings", label: "Complaint Settings", icon: Settings },
    { id: "categories", label: "Complaint Categories", icon: FileText },
    { id: "reports", label: "Complaint Reports", icon: BarChart3 },
  ];

  if (user.role !== "SUPER_ADMIN" && user.role !== "HR_ADMIN") {
    return (
      <div className="space-y-4 -mt-2">
        <h1 className="mt-[10px] text-3xl font-semibold tracking-tight text-foreground">
          Complaints Control Center
        </h1>
        <Card className={complaintsCardClass}>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">
              This complaints control center is only available to HR Administrators.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-6">
        <EmployeeModuleTopbar searchPlaceholder="Search complaints..." />
        <EmployeeSectionHeader
          title="Complaints"
          tabs={navTabs.map(({ id, label }) => ({ id, label }))}
          activeTab={tab}
          onTabChange={(id) => router.replace(`${paths.complaints}?tab=${id}`, { scroll: false })}
        />
      </div>

      {/* Tab: All Complaints */}
      {tab === "all" && (
        <div>
          {adminDataLoading ? (
            <Table scrollable>
              <TableHeader className="bg-[#FFE14E]">
                <TableRow>
                  <TableHead className="text-[#192853] font-semibold">Complaint ID</TableHead>
                  <TableHead className="text-[#192853] font-semibold">Title</TableHead>
                  <TableHead className="text-[#192853] font-semibold">Type</TableHead>
                  <TableHead className="text-[#192853] font-semibold">Employee</TableHead>
                  <TableHead className="text-[#192853] font-semibold">Department</TableHead>
                  <TableHead className="text-[#192853] font-semibold">Priority</TableHead>
                  <TableHead className="text-[#192853] font-semibold">Status</TableHead>
                  <TableHead className="text-[#192853] font-semibold">Assigned HR Officer</TableHead>
                  <TableHead className="text-[#192853] font-semibold">Date Submitted</TableHead>
                  <TableHead className="w-48 text-right text-[#192853] font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableSkeletonRows columns={10} prefix="complaints-admin-sk" />
              </TableBody>
            </Table>
          ) : complaints.length === 0 ? (
            <p className="text-sm text-muted-foreground">No complaints in the system.</p>
          ) : (
            <Table scrollable>
              <TableHeader className="bg-[#FFE14E]">
                <TableRow>
                  <TableHead className="text-[#192853] font-semibold">Complaint ID</TableHead>
                  <TableHead className="text-[#192853] font-semibold">Title</TableHead>
                  <TableHead className="text-[#192853] font-semibold">Type</TableHead>
                  <TableHead className="text-[#192853] font-semibold">Employee</TableHead>
                  <TableHead className="text-[#192853] font-semibold">Department</TableHead>
                  <TableHead className="text-[#192853] font-semibold">Priority</TableHead>
                  <TableHead className="text-[#192853] font-semibold">Status</TableHead>
                  <TableHead className="text-[#192853] font-semibold">Assigned HR Officer</TableHead>
                  <TableHead className="text-[#192853] font-semibold">Date Submitted</TableHead>
                  <TableHead className="w-48 text-right text-[#192853] font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {complaints.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.id}</TableCell>
                    <TableCell>{c.title}</TableCell>
                    <TableCell>{c.typeLabel ?? "Complaint"}</TableCell>
                    <TableCell>{c.employeeName ?? "Anonymous"}</TableCell>
                    <TableCell>{c.departmentName ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          c.priority === "URGENT" || c.priority === "HIGH"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {c.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{c.status}</Badge>
                    </TableCell>
                    <TableCell>{c.assignedHr ?? "Unassigned"}</TableCell>
                    <TableCell>
                      {c.createdAt
                        ? new Date(c.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Link href={`/complaints/${c.id}`}>
                        <Button variant="outline" size="sm" className={tableViewActionClass}>
                          <Eye className="size-3.5" />
                          View
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        className={tableAssignActionClass}
                        onClick={() => {
                          setSelectedComplaintId(c.id);
                          setAssignDialogOpen(true);
                        }}
                      >
                        <UserPlus2 className="size-3.5" />
                        Assign
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Tab: Complaint Settings */}
      {tab === "settings" && (
        <Card className={complaintsCardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="size-4" />
              Complaint Settings
            </CardTitle>
            <CardDescription>
              Configure default behavior and escalation rules for the complaints system.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 max-w-2xl">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Default Priority</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={settings.defaultPriority}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      defaultPriority: e.target.value as ComplaintPriority,
                    }))
                  }
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Auto Escalate After (days)</Label>
                <Input
                  type="number"
                  min={1}
                  value={settings.autoEscalateAfterDays}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      autoEscalateAfterDays: parseInt(e.target.value, 10) || 3,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>SLA Response Time (hours)</Label>
                <Input
                  type="number"
                  min={1}
                  value={settings.slaResponseHours}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      slaResponseHours: parseInt(e.target.value, 10) || 24,
                    }))
                  }
                />
              </div>
              <div className="space-y-2 flex items-center gap-4 pt-6">
                <Label>Allow Anonymous Complaints</Label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.allowAnonymous}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, allowAnonymous: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-input"
                  />
                  <span className="text-sm">{settings.allowAnonymous ? "Enabled" : "Disabled"}</span>
                </label>
              </div>
            </div>
            <Button onClick={handleSaveSettings} className="rounded-full">
              Save Settings
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tab: Complaint Categories */}
      {tab === "categories" && (
        <Card className={complaintsCardClass}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4" />
                Complaint Categories
              </CardTitle>
              <CardDescription>
                Manage complaint types and their severity levels.
              </CardDescription>
            </div>
            <Button
              size="sm"
              className="rounded-full"
              onClick={() => {
                setEditingCategory(null);
                setCategoryForm({ name: "", description: "", severityLevel: "MEDIUM" });
                setCategoryDialogOpen(true);
              }}
            >
              Add Category
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader className="bg-[#FFE14E]">
                  <TableRow>
                    <TableHead className="text-[#192853] font-semibold">Category Name</TableHead>
                    <TableHead className="text-[#192853] font-semibold">Description</TableHead>
                    <TableHead className="text-[#192853] font-semibold">Severity Level</TableHead>
                    <TableHead className="text-[#192853] font-semibold">Status</TableHead>
                    <TableHead className="w-32 text-right text-[#192853] font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminDataLoading ? (
                    <TableSkeletonRows columns={5} prefix="complaints-cat-sk" />
                  ) : (
                  categories.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell className="font-medium">{cat.name}</TableCell>
                      <TableCell className="text-muted-foreground">{cat.description}</TableCell>
                      <TableCell>
                        <Badge variant={cat.severityLevel === "HIGH" ? "destructive" : "secondary"}>
                          {cat.severityLevel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={cat.status === "ACTIVE" ? "default" : "outline"}>
                          {cat.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 rounded-lg px-3 text-muted-foreground hover:bg-muted hover:text-foreground"
                            onClick={() => {
                              setEditingCategory(cat);
                              setCategoryForm({
                                name: cat.name,
                                description: cat.description,
                                severityLevel: cat.severityLevel,
                              });
                              setCategoryDialogOpen(true);
                            }}
                          >
                            <Pencil className="size-3.5" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "h-8 gap-1.5 rounded-lg px-3",
                              cat.status === "ACTIVE"
                                ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                : "text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                            )}
                            onClick={() => toggleCategoryStatus(cat.id)}
                          >
                            {cat.status === "ACTIVE" ? (
                              <>
                                <Ban className="size-3.5" />
                                Disable
                              </>
                            ) : (
                              <>
                                <Power className="size-3.5" />
                                Enable
                              </>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab: Complaint Reports */}
      {tab === "reports" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className={complaintsCardClass}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Complaints</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{reportMetrics.total}</p>
                <p className="text-xs text-muted-foreground">All complaints in system</p>
              </CardContent>
            </Card>
            <Card className={complaintsCardClass}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{reportMetrics.resolved}</p>
                <p className="text-xs text-muted-foreground">Closed successfully</p>
              </CardContent>
            </Card>
            <Card className={complaintsCardClass}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{reportMetrics.pending}</p>
                <p className="text-xs text-muted-foreground">Awaiting resolution</p>
              </CardContent>
            </Card>
            <Card className={complaintsCardClass}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Escalated</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{reportMetrics.escalated}</p>
                <p className="text-xs text-muted-foreground">Require manager attention</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className={complaintsCardClass}>
              <CardHeader>
                <CardTitle className="text-base">By Department</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {Object.entries(reportMetrics.byDept)
                    .sort(([, a], [, b]) => b - a)
                    .map(([dept, count]) => (
                      <li key={dept} className="flex justify-between">
                        <span>{dept}</span>
                        <span className="font-medium">{count}</span>
                      </li>
                    ))}
                  {Object.keys(reportMetrics.byDept).length === 0 && (
                    <li className="text-muted-foreground">No data</li>
                  )}
                </ul>
              </CardContent>
            </Card>
            <Card className={complaintsCardClass}>
              <CardHeader>
                <CardTitle className="text-base">By Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {Object.entries(reportMetrics.byCategory)
                    .sort(([, a], [, b]) => b - a)
                    .map(([cat, count]) => (
                      <li key={cat} className="flex justify-between">
                        <span>{cat}</span>
                        <span className="font-medium">{count}</span>
                      </li>
                    ))}
                  {Object.keys(reportMetrics.byCategory).length === 0 && (
                    <li className="text-muted-foreground">No data</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Assign HR Officer Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Assign HR Officer</DialogTitle>
            <DialogDescription>
              Select an HR officer to assign to this complaint for investigation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>HR Officer</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={assignOfficerId}
              onChange={(e) => setAssignOfficerId(e.target.value)}
            >
              <option value="">Select HR Officer</option>
              {hrOfficers.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName} ({e.role})
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignOfficer} disabled={!assignOfficerId}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Add/Edit Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
            <DialogDescription>
              {editingCategory
                ? "Update the complaint category details."
                : "Create a new complaint category."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Category Name</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Workplace Harassment"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={categoryForm.description}
                onChange={(e) => setCategoryForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief description"
              />
            </div>
            <div className="space-y-2">
              <Label>Severity Level</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={categoryForm.severityLevel}
                onChange={(e) =>
                  setCategoryForm((f) => ({
                    ...f,
                    severityLevel: e.target.value as "LOW" | "MEDIUM" | "HIGH",
                  }))
                }
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCategory} disabled={!categoryForm.name.trim()}>
              {editingCategory ? "Save" : "Add Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
