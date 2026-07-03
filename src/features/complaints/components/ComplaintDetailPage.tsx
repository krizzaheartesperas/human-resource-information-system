"use client";

import { useMemo } from "react";
import { getPortalPaths } from "@/core/routes/portal-routes";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { useTheme } from "@/components/theme/ThemeProvider";
import NotificationsBellMenu from "@/components/layout/NotificationsBellMenu";
import SettingsIconLink from "@/components/layout/SettingsIconLink";
import TopbarAccountMenu from "@/components/layout/TopbarAccountMenu";
import {
  CalendarDays,
  ChevronLeft,
  FileText,
  Moon,
  Sun,
  Check,
} from "lucide-react";

type ComplaintStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "RESOLVED"
  | "WITHDRAWN"
  | "ESCALATED";

type ComplaintPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type StoredComplaint = {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: ComplaintPriority;
  departmentId: string;
  departmentName: string;
  submittedAt: string;
  dateOfIncident?: string;
  status: ComplaintStatus | string;
  isAnonymous?: boolean;
  createdByEmployeeId?: string;
  attachmentName?: string;
  resolutionStatus?: string;
  disciplinaryAction?: string;
};

const COMPLAINTS_STORAGE_KEY = "hris-complaints";

function loadComplaintById(id: string): StoredComplaint | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COMPLAINTS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredComplaint[];
    if (!Array.isArray(parsed)) return null;
    return parsed.find((c) => c.id === id) ?? null;
  } catch {
    return null;
  }
}

function formatDateLabel(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
  });
}

function getEmployeeResolutionMessageForDetails(c: StoredComplaint): string {
  if (c.status !== "RESOLVED") {
    return c.resolutionStatus || "—";
  }

  const action = (c.disciplinaryAction || "").toLowerCase();
  const res = (c.resolutionStatus || "").toLowerCase();

  if (
    ["termination", "suspension", "verbal warning", "written warning"].some(
      (keyword) => action.includes(keyword),
    )
  ) {
    return "Complaint Substantiated – Appropriate action taken";
  }

  if (res.includes("no evidence") || res.includes("unsubstantiated")) {
    if (res.includes("false")) {
      return "Complaint Unsubstantiated – False report confirmed.";
    }
    return "Complaint Unsubstantiated – Insufficient evidence found";
  }

  if (res.includes("mediation")) {
    return "Case Resolved Through Mediation";
  }

  if (res.includes("policy") || res.includes("guidance")) {
    return "Policy Guidance Provided";
  }

  return (
    c.resolutionStatus || "Complaint Substantiated – Appropriate action taken"
  );
}

export default function EmployeeComplaintDetailsPage() {
  const { user } = useCurrentUser();
  const paths = useMemo(() => getPortalPaths(user.role), [user.role]);
  const { theme, toggleTheme } = useTheme();
  const complaintsCardClass = [
    "rounded-[32px] border-none shadow-sm",
    theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]",
  ].join(" ");
  const detailPanelClass =
    theme === "dark"
      ? "rounded-xl border border-[#2e3d62] bg-[#162544]"
      : "rounded-xl border border-border/50 bg-background/70";
  const sectionHeadingClass =
    theme === "dark"
      ? "text-xs font-semibold uppercase tracking-[0.16em] text-[#FFE14E]"
      : "text-xs font-semibold uppercase tracking-[0.16em] text-[#192853]";
  const fieldLabelClass =
    theme === "dark"
      ? "text-xs uppercase tracking-wide text-[#FFE14E]"
      : "text-xs uppercase tracking-wide text-[#192853]";
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const complaint = params?.id ? loadComplaintById(params.id) : null;

  // Guard: allow HR/Auditor roles (full visibility) or the employee who created the complaint
  const hasAccess = useMemo(() => {
    if (!complaint) return true;
    const hrRoles = ["HR_ADMIN", "HR_STAFF", "HR_MANAGER", "DEPARTMENT_MANAGER", "SUPER_ADMIN", "AUDITOR"];
    if (hrRoles.includes(user.role)) return true;
    if (!complaint.createdByEmployeeId) return true;
    return complaint.createdByEmployeeId === user.employeeId;
  }, [complaint, user.role, user.employeeId]);

  const formattedStatus =
    complaint?.status === "FURTHER_INVESTIGATION_REQUIRED"
      ? "Further Investigation Required"
      : complaint?.status
          ?.toString()
          .replace("_", " ")
          .toLowerCase()
          .replace(/\b\w/g, (ch) => ch.toUpperCase()) ?? "—";

  const internalResolutionLabel =
    complaint?.disciplinaryAction && complaint.disciplinaryAction !== "None"
      ? `${complaint.disciplinaryAction} Issued`
      : complaint?.resolutionStatus || "—";

  const resolutionLabel =
    complaint && ("status" in complaint)
      ? getEmployeeResolutionMessageForDetails(complaint)
      : internalResolutionLabel;

  const timelineSteps = useMemo(
    () =>
      complaint
        ? [
            {
              label: "Complaint Submitted",
              date: formatDateLabel(complaint.submittedAt),
            },
            complaint.status === "UNDER_REVIEW" || complaint.status === "SUBMITTED"
              ? {
                  label:
                    complaint.status === "UNDER_REVIEW"
                      ? "HR Review In Progress"
                      : "Further Investigation Requested",
                  date: "",
                }
              : null,
            complaint.status === "RESOLVED" || complaint.status === "WITHDRAWN"
              ? {
                  label:
                    complaint.status === "RESOLVED"
                      ? "Case Closed"
                      : "Complaint Withdrawn",
                  date: "",
                }
              : null,
          ].filter(Boolean) as { label: string; date: string }[]
        : [],
    [complaint],
  );

  const backHref =
    user.role === "HR_ADMIN" || user.role === "SUPER_ADMIN"
      ? `${paths.complaints}?tab=all`
      : user.role === "HR_STAFF"
        ? `${paths.complaints}?panel=dashboard`
        : user.role === "HR_MANAGER" || user.role === "DEPARTMENT_MANAGER"
          ? `${paths.complaints}?panel=overview`
          : user.role === "AUDITOR"
            ? `${paths.complaints}?tab=records`
            : user.role === "EXECUTIVE"
              ? `${paths.complaints}?scope=executive`
              : paths.complaints;

  if (!complaint) {
    return (
      <div className="space-y-4 -mt-2">
        <h1 className="mt-[10px] text-3xl font-semibold tracking-tight text-foreground">
          Complaint Details
        </h1>
        <Card className={complaintsCardClass}>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">
              We couldn&apos;t find this complaint. It may have been removed or is not
              available.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => router.push(backHref)}
            >
              Back to Complaints
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="space-y-4 -mt-2">
        <h1 className="mt-[10px] text-3xl font-semibold tracking-tight text-foreground">
          Complaint Details
        </h1>
        <Card className={complaintsCardClass}>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">
              You don&apos;t have permission to view this complaint.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => router.push(backHref)}
            >
              Back to Complaints
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-[10px] space-y-6">
      {/* Top bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2.5">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Back to Complaints</span>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Complaint Details
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Review the information you submitted and see the final outcome of your
            complaint.
          </p>
        </div>
        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
          <NotificationsBellMenu />
          <SettingsIconLink />
          <TopbarAccountMenu />
        </div>
      </div>

      {/* Header strip with key info */}
      <Card className={complaintsCardClass}>
        <CardContent className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="space-y-2">
            <p className={sectionHeadingClass}>
              Complaint
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-background/40 px-2.5 py-1 text-xs font-semibold tracking-wide text-foreground">
                {complaint.id}
              </span>
              <span className="text-muted-foreground text-sm">•</span>
              <span className="text-sm font-medium text-foreground">
                {complaint.title}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:text-sm">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                Submitted {formatDateLabel(complaint.submittedAt)}
              </span>
              <span>•</span>
              <span>Priority: {complaint.priority}</span>
              <span>•</span>
              <span>Department: {complaint.departmentName}</span>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold">
              {formattedStatus}
            </Badge>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Resolution:{" "}
              <span className="font-medium text-foreground">
                {resolutionLabel}
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Main content grid */}
      <div className="grid gap-5 xl:grid-cols-[1.6fr,1.4fr]">
        {/* Left column: key information + narrative */}
        <Card className={complaintsCardClass}>
          <CardHeader className="border-b border-border/40 pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-4 w-4" />
              Complaint Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-5 text-sm">
            {/* Info grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className={`${detailPanelClass} px-3 py-2.5`}>
                <p className={fieldLabelClass}>Complaint ID</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{complaint.id}</p>
              </div>
              <div className={`${detailPanelClass} px-3 py-2.5`}>
                <p className={fieldLabelClass}>Title</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{complaint.title}</p>
              </div>
              <div className={`${detailPanelClass} px-3 py-2.5`}>
                <p className={fieldLabelClass}>Complaint Type</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{complaint.type}</p>
              </div>
              <div className={`${detailPanelClass} px-3 py-2.5`}>
                <p className={fieldLabelClass}>Date Submitted</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatDateLabel(complaint.submittedAt)}
                </p>
              </div>
              <div className={`${detailPanelClass} px-3 py-2.5`}>
                <p className={fieldLabelClass}>Status</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{formattedStatus}</p>
              </div>
              <div className={`${detailPanelClass} px-3 py-2.5`}>
                <p className={fieldLabelClass}>Resolution</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{resolutionLabel}</p>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <p className={sectionHeadingClass}>
                Complaint Description
              </p>
              <p
                className={`text-sm whitespace-pre-line rounded-xl px-3 py-3 text-foreground ${
                  theme === "dark"
                    ? "border border-dashed border-[#2e3d62] bg-[#162544]"
                    : "border border-dashed border-border/50 bg-background/60"
                }`}
              >
                {complaint.description ||
                  "No description was provided for this complaint."}
              </p>
            </div>

            {/* HR Response */}
            <div className="space-y-2">
              <p className={sectionHeadingClass}>
                HR Response / Final Decision
              </p>
              <div className={`${detailPanelClass} space-y-2 px-3 py-3`}>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {complaint.resolutionStatus
                    ? complaint.resolutionStatus
                    : complaint.status === "RESOLVED"
                    ? "After reviewing your complaint and conducting an internal review, the HR team has closed this case in line with company policies."
                    : "Your complaint is being handled by the HR team in accordance with company guidelines. You will be notified once a final decision has been made."}
                </p>
                {complaint.disciplinaryAction &&
                  complaint.disciplinaryAction !== "None" && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Appropriate disciplinary action has been taken in accordance
                      with company guidelines.
                    </p>
                  )}
                <p className="text-[11px] text-muted-foreground">
                  For confidentiality reasons, specific details about other
                  employees involved are not shown here.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right column: progress + resolution + attachments */}
        <Card className={complaintsCardClass}>
          <CardContent className="space-y-6 pt-5 text-sm">
            {/* Timeline / Progress */}
            <div className="space-y-2">
              <p className={sectionHeadingClass}>
                Complaint Timeline / Progress
              </p>
              {timelineSteps.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Timeline information is not available for this complaint.
                </p>
              ) : (
                <ol className="space-y-2">
                  {timelineSteps.map((step, idx) => {
                    const isLast = idx === timelineSteps.length - 1;
                    return (
                      <li key={idx} className="flex items-start gap-2">
                        <div className="flex flex-col items-center">
                          <div
                            className={`flex h-4 w-4 items-center justify-center rounded-full shadow-sm ${
                              theme === "dark"
                                ? "bg-slate-100 text-[#192853]"
                                : "bg-[#FFE14E] text-[#192853]"
                            }`}
                          >
                            <Check className="h-2 w-2" />
                          </div>
                          {!isLast && (
                            <div
                              className={`h-3 w-px ${
                                theme === "dark" ? "bg-slate-100/80" : "bg-[#192853]/30"
                              }`}
                            />
                          )}
                        </div>
                        <div className="pt-0.5">
                          <p
                            className={`text-xs ${
                              theme === "dark" ? "text-slate-100" : "text-[#192853]"
                            }`}
                          >
                            {step.date ? `${step.date} – ` : ""}
                            <span
                              className={`font-semibold ${
                                theme === "dark" ? "text-slate-50" : "text-[#192853]"
                              }`}
                            >
                              {step.label}
                            </span>
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            {/* Resolution details */}
            <div className="space-y-2">
              <p className={sectionHeadingClass}>
                Resolution Details
              </p>
              <div className={`${detailPanelClass} space-y-1.5 px-3 py-3`}>
                <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)] gap-2">
                  <p className={fieldLabelClass}>Resolution</p>
                  <p className="font-medium text-foreground">{resolutionLabel}</p>
                  <p className={fieldLabelClass}>Details</p>
                  <p className="leading-relaxed text-foreground">
                    {complaint.disciplinaryAction &&
                    complaint.disciplinaryAction !== "None"
                      ? `The responsible employee was subject to ${complaint.disciplinaryAction.toLowerCase()} after HR confirmed policy violations.`
                      : complaint.resolutionStatus
                      ? complaint.resolutionStatus
                      : "Once the case is closed, the final outcome will appear here."}
                  </p>
                </div>
              </div>
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <p className={sectionHeadingClass}>
                Attachments
              </p>
              <div
                className={`rounded-xl border border-dashed px-3 py-3 ${
                  theme === "dark"
                    ? "border-[#2e3d62] bg-[#162544]"
                    : "border-border/50 bg-background/50"
                }`}
              >
                {complaint.attachmentName ? (
                  <ul className="space-y-1.5 text-xs text-foreground">
                    <li className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs">
                        <FileText className="h-3.5 w-3.5" />
                      </span>
                      <span className="truncate">{complaint.attachmentName}</span>
                    </li>
                  </ul>
                ) : (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    No attachments were uploaded with this complaint.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
