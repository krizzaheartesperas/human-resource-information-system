"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { getPortalPaths } from "@/core/routes/portal-routes";
import { useTheme } from "@/components/theme/ThemeProvider";
import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";
import { EmployeeSectionHeader } from "@/components/layout/EmployeeSectionHeader";
import { Search } from "lucide-react";

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

type StoredComplaint = {
  id: string;
  title: string;
  description?: string;
  type?: string;
  departmentName?: string;
  employeeName?: string;
  isAnonymous?: boolean;
  assignedHr?: string;
  status: ComplaintStatus | string;
  priority: ComplaintPriority;
  submittedAt?: string;
  resolvedAt?: string;
};

const COMPLAINTS_STORAGE_KEY = "hris-complaints";

function loadComplaints(): StoredComplaint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COMPLAINTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredComplaint[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function getMaskedSubmittedBy(c: StoredComplaint) {
  if (c.isAnonymous) return "Anonymous";
  if (!c.employeeName) return "—";
  const parts = c.employeeName.split(" ");
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].charAt(0)}.`;
}

export default function ComplaintsAuditPage() {
  const { user } = useCurrentUser();
  const paths = useMemo(() => getPortalPaths(user.role), [user.role]);
  const { theme } = useTheme();
  const complaintsCardClass = cn(
    "rounded-[32px] border-none shadow-sm",
    theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
  );
  const reportStatCardClass = cn(
    "rounded-2xl border px-4 py-3",
    theme === "dark"
      ? "border-[#2e3d62] bg-[#223054]"
      : "border-[#26335f] bg-[#1B2447] text-slate-100"
  );
  const searchParams = useSearchParams();
  const router = useRouter();
  const [complaints] = useState<StoredComplaint[]>(() => loadComplaints());
  const [search, setSearch] = useState("");

  const tab = (searchParams.get("tab") as "records" | "reports" | "logs" | null) ?? "records";

  const filteredComplaints = useMemo(() => {
    if (!search.trim()) return complaints;
    const term = search.toLowerCase();
    return complaints.filter((c) =>
      [
        c.id,
        c.title,
        c.type,
        c.departmentName,
        c.employeeName,
        c.assignedHr,
        c.status,
      ]
        .filter(Boolean)
        .some((value) => value!.toString().toLowerCase().includes(term)),
    );
  }, [complaints, search]);

  const metrics = useMemo(() => {
    const total = complaints.length;
    const resolved = complaints.filter((c) => c.status === "RESOLVED").length;
    const pending = complaints.filter(
      (c) => c.status !== "RESOLVED" && c.status !== "WITHDRAWN",
    ).length;
    const escalated = complaints.filter((c) => c.status === "ESCALATED").length;
    return { total, resolved, pending, escalated };
  }, [complaints]);

  if (user.role !== "AUDITOR" && user.role !== "SUPER_ADMIN") {
    return (
      <div className="space-y-4 -mt-2">
        <h1 className="mt-[10px] text-3xl font-semibold tracking-tight text-foreground">
          Complaints – Auditor View
        </h1>
        <Card className={complaintsCardClass}>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">
              This complaints view is reserved for Auditor and Super Admin roles.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full max-w-full flex flex-col gap-4">
      {/* Topbar + navbar (match HR Staff layout) */}
      <div className="flex flex-col gap-6">
        <EmployeeModuleTopbar searchPlaceholder="Search complaints..." />
        <EmployeeSectionHeader
          title="Complaints"
          tabs={[
            { id: "records", label: "Complaint Records" },
            { id: "reports", label: "Complaint Reports" },
            { id: "logs", label: "Audit Logs" },
          ]}
          activeTab={tab}
          onTabChange={(id) => router.push(`${paths.complaints}?tab=${id}`)}
        />



      </div>

      {tab === "records" && (
        <Card className={complaintsCardClass}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold">
                  Complaint Records
                </CardTitle>
                <CardDescription className="text-sm">
                  Read-only view of all complaints for audit and compliance checks.
                </CardDescription>
              </div>
              <div className="relative w-64 max-w-xs">
                <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-muted-foreground">
                  <Search className="h-3.5 w-3.5" />
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by ID, title, department, staff..."
                  className="h-8 w-full rounded-full border border-border bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card/80">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Complaint ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Submitted By</TableHead>
                    <TableHead>Assigned HR Staff</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Date Submitted</TableHead>
                    <TableHead>Date Resolved</TableHead>
                    <TableHead className="w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredComplaints.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={11}
                        className="py-6 text-center text-sm text-muted-foreground"
                      >
                        No complaints found for the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredComplaints.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium text-sm">
                          {c.id}
                        </TableCell>
                        <TableCell className="text-sm max-w-xs truncate">
                          {c.title || c.description || "Complaint"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.type || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.departmentName || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {getMaskedSubmittedBy(c)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.assignedHr || "Unassigned"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-medium">
                            {c.status.toString().replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              c.priority === "URGENT"
                                ? "destructive"
                                : c.priority === "HIGH"
                                ? "secondary"
                                : "outline"
                            }
                            className="text-xs font-semibold"
                          >
                            {c.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(c.submittedAt)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(c.resolvedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-full px-3 text-xs"
                          >
                            <Link href={`/complaints/${c.id}`}>View Details</Link>
                          </Button>
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

      {tab === "reports" && (
        <Card className={complaintsCardClass}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Complaint Reports
            </CardTitle>
            <CardDescription className="text-sm">
              High-level metrics to help auditors understand complaint volumes and
              outcomes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
              <div className={reportStatCardClass}>
                <p className="text-xs text-slate-300">Total Complaints</p>
                <p className="mt-1 text-2xl font-semibold">{metrics.total}</p>
              </div>
              <div className={reportStatCardClass}>
                <p className="text-xs text-slate-300">Resolved</p>
                <p className="mt-1 text-2xl font-semibold">
                  {metrics.resolved}
                </p>
              </div>
              <div className={reportStatCardClass}>
                <p className="text-xs text-slate-300">Pending</p>
                <p className="mt-1 text-2xl font-semibold">
                  {metrics.pending}
                </p>
              </div>
              <div className={reportStatCardClass}>
                <p className="text-xs text-slate-300">Escalated</p>
                <p className="mt-1 text-2xl font-semibold">
                  {metrics.escalated}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              These metrics are read-only and are intended to support compliance
              reviews and board reporting.
            </p>
          </CardContent>
        </Card>
      )}

      {tab === "logs" && (
        <Card className={complaintsCardClass}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Audit Logs</CardTitle>
            <CardDescription className="text-sm">
              View the full system audit trail, including complaint-related
              actions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              The detailed audit log, including who viewed or updated complaints,
              is available in the dedicated Audit Logs module.
            </p>
            <Button asChild size="sm" className="rounded-full px-4">
              <Link href={paths.audit}>Open Audit Logs</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
