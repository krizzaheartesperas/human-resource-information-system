"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  FileText,
  Pencil,
  Upload,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { getPortalPaths } from "@/core/routes/portal-routes";
import {
  getEmployeeByIdForWorkspace,
  getEmployeeHistoryForWorkspace,
  type EmployeeWorkspaceData,
  type EmployeeWorkspaceHistory,
} from "@/features/employees/services/employeeWorkspaceMockApi";
import { loadRequestsFromStorage, saveRequestsToStorage } from "@/features/workflow/services/workflowRequests";
import { departments, employees, workflowRequests, type WorkflowRequest } from "@/lib/mock";
import { appendAuditLog } from "@/features/audit/services/audit.service";
import {
  createEmployeeEvent,
  getCompensationHistoryForEmployee,
  getEmploymentHistoryForEmployee,
  type EmployeeEventType,
} from "@/features/employees/services/employeeEvents.service";

type DetailTab =
  | "overview"
  | "personal"
  | "contact"
  | "employment"
  | "compensation"
  | "documents"
  | "history";

const TABS: DetailTab[] = [
  "overview",
  "personal",
  "contact",
  "employment",
  "compensation",
  "documents",
  "history",
];

const TAB_LABEL: Record<DetailTab, string> = {
  overview: "Overview",
  personal: "Personal",
  contact: "Contact",
  employment: "Employment",
  compensation: "Compensation",
  documents: "Documents",
  history: "History",
};

type GovIdField = "SSS" | "PHILHEALTH" | "PAGIBIG" | "TIN";
type GovIdDraft = {
  sss: string;
  philHealth: string;
  pagIbig: string;
  tin: string;
};
type HrActionEventType = Exclude<EmployeeEventType, "EDIT_PROFILE"> | "EDIT_PROFILE";
type ActionFormState = {
  effectiveDate: string;
  reason: string;
  title: string;
  jobLevel: string;
  salaryAmount: string;
  payGrade: string;
  departmentId: string;
  managerId: string;
  personalPhone: string;
  currentAddress: string;
};

function statusClass(status: string) {
  if (status === "Active")
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  if (status === "Pre-Hire")
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  if (status === "Terminated")
    return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
  return "bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200";
}

function TabButton({ value, activeTab }: { value: DetailTab; activeTab: DetailTab }) {
  return (
    <TabsTrigger
      value={value}
      className={`relative rounded-none px-4 py-2 text-sm transition-colors data-[state=active]:!text-[#192853] data-[state=active]:text-[#192853] ${
        activeTab === value
          ? "font-semibold text-[#192853] after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[#192853]"
          : "text-[#3f4f76] hover:text-[#192853] after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[#192853] after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-200"
      }`}
    >
      {TAB_LABEL[value]}
    </TabsTrigger>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user: currentUser } = useCurrentUser();
  const paths = useMemo(() => getPortalPaths(currentUser.role), [currentUser.role]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [employeeData, setEmployeeData] = useState<EmployeeWorkspaceData | null>(null);
  const [historyRows, setHistoryRows] = useState<EmployeeWorkspaceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSalary, setShowSalary] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [govIdDraft, setGovIdDraft] = useState<GovIdDraft>({
    sss: "",
    philHealth: "",
    pagIbig: "",
    tin: "",
  });
  const [govIdErrors, setGovIdErrors] = useState<Partial<Record<keyof GovIdDraft, string>>>({});
  const [govIdMessage, setGovIdMessage] = useState<string | null>(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestField, setRequestField] = useState<GovIdField>("SSS");
  const [requestNewValue, setRequestNewValue] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [eventType, setEventType] = useState<HrActionEventType>("EDIT_PROFILE");
  const [eventSubmitting, setEventSubmitting] = useState(false);
  const [eventMessage, setEventMessage] = useState<string | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  const [actionForm, setActionForm] = useState<ActionFormState>({
    effectiveDate: new Date().toISOString().slice(0, 10),
    reason: "",
    title: "",
    jobLevel: "",
    salaryAmount: "",
    payGrade: "",
    departmentId: "",
    managerId: "",
    personalPhone: "",
    currentAddress: "",
  });

  useEffect(() => {
    const tabFromQuery = searchParams.get("tab");
    if (tabFromQuery && TABS.includes(tabFromQuery as DetailTab)) {
      setActiveTab(tabFromQuery as DetailTab);
      return;
    }
    const saved = typeof window !== "undefined" ? localStorage.getItem(`emp-profile-tab:${id}`) : null;
    if (saved && TABS.includes(saved as DetailTab)) {
      setActiveTab(saved as DetailTab);
    }
  }, [id, searchParams]);

  const updateTab = useCallback(
    (tab: DetailTab) => {
      setActiveTab(tab);
      if (typeof window !== "undefined") {
        localStorage.setItem(`emp-profile-tab:${id}`, tab);
      }
      const next = new URLSearchParams(searchParams.toString());
      next.set("tab", tab);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [id, pathname, router, searchParams]
  );

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [emp, hist] = await Promise.all([
        getEmployeeByIdForWorkspace(id),
        getEmployeeHistoryForWorkspace(id),
      ]);
      setEmployeeData(emp);
      setHistoryRows(hist);
      if (!emp) {
        setError("No employee records found");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load employee data");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!employeeData) return;
    setGovIdDraft({
      sss: employeeData.personal.sss || "",
      philHealth: employeeData.personal.philHealth || "",
      pagIbig: employeeData.personal.pagIbig || "",
      tin: employeeData.personal.tin || "",
    });
  }, [employeeData]);

  const openActionDialog = (nextEvent: HrActionEventType) => {
    if (!employeeData) return;
    setEventType(nextEvent);
    setEventError(null);
    setEventMessage(null);
    setActionForm({
      effectiveDate: new Date().toISOString().slice(0, 10),
      reason: "",
      title: employeeData.employee.jobTitle,
      jobLevel: employeeData.employment.jobLevel,
      salaryAmount: employeeData.compensation.basicSalary,
      payGrade: employeeData.compensation.payGrade,
      departmentId: employeeData.employee.departmentId,
      managerId: employeeData.employee.managerId ?? "",
      personalPhone: employeeData.contact.phone,
      currentAddress: employeeData.contact.currentAddress,
    });
    setEventDialogOpen(true);
  };

  const actionHandler = (action: string) => {
    if (action === "Upload File" || action.startsWith("View ") || action.startsWith("Download ")) {
      void `${action}:${id}`;
      return;
    }
    const map: Record<string, HrActionEventType> = {
      "Edit Profile": "EDIT_PROFILE",
      Promote: "PROMOTION",
      Transfer: "TRANSFER",
      "Change Salary": "SALARY_CHANGE",
      Terminate: "TERMINATION",
      Rehire: "REHIRE",
      Suspend: "SUSPENSION",
    };
    const next = map[action];
    if (!next) return;
    openActionDialog(next);
  };

  const submitActionEvent = () => {
    if (!employeeData) return;
    setEventSubmitting(true);
    setEventError(null);
    let result:
      | ReturnType<typeof createEmployeeEvent>
      | { ok: false; message: string } = { ok: false, message: "Invalid action" };

    if (eventType === "EDIT_PROFILE") {
      result = createEmployeeEvent({
        actorRole: currentUser.role,
        actorName: currentUser.name,
        employeeId: employeeData.employee.id,
        eventType,
        input: {
          effectiveDate: actionForm.effectiveDate,
          reason: actionForm.reason,
          changes: {
            currentAddress: actionForm.currentAddress,
            personalPhone: actionForm.personalPhone,
          },
        },
      });
    } else if (eventType === "PROMOTION") {
      result = createEmployeeEvent({
        actorRole: currentUser.role,
        actorName: currentUser.name,
        employeeId: employeeData.employee.id,
        eventType,
        input: {
          effectiveDate: actionForm.effectiveDate,
          reason: actionForm.reason,
          title: actionForm.title,
          jobLevel: actionForm.jobLevel,
          salarySnapshot: actionForm.salaryAmount,
          payGrade: actionForm.payGrade,
        },
      });
    } else if (eventType === "TRANSFER") {
      result = createEmployeeEvent({
        actorRole: currentUser.role,
        actorName: currentUser.name,
        employeeId: employeeData.employee.id,
        eventType,
        input: {
          effectiveDate: actionForm.effectiveDate,
          reason: actionForm.reason,
          departmentId: actionForm.departmentId,
          managerId: actionForm.managerId || null,
        },
      });
    } else if (eventType === "SALARY_CHANGE") {
      result = createEmployeeEvent({
        actorRole: currentUser.role,
        actorName: currentUser.name,
        employeeId: employeeData.employee.id,
        eventType,
        input: {
          effectiveDate: actionForm.effectiveDate,
          reason: actionForm.reason,
          amount: actionForm.salaryAmount,
          payGrade: actionForm.payGrade,
        },
      });
    } else if (eventType === "TERMINATION") {
      result = createEmployeeEvent({
        actorRole: currentUser.role,
        actorName: currentUser.name,
        employeeId: employeeData.employee.id,
        eventType,
        input: {
          effectiveDate: actionForm.effectiveDate,
          reason: actionForm.reason,
        },
      });
    } else if (eventType === "REHIRE") {
      result = createEmployeeEvent({
        actorRole: currentUser.role,
        actorName: currentUser.name,
        employeeId: employeeData.employee.id,
        eventType,
        input: {
          effectiveDate: actionForm.effectiveDate,
          reason: actionForm.reason,
          title: actionForm.title,
          departmentId: actionForm.departmentId,
          managerId: actionForm.managerId || null,
        },
      });
    } else if (eventType === "SUSPENSION") {
      result = createEmployeeEvent({
        actorRole: currentUser.role,
        actorName: currentUser.name,
        employeeId: employeeData.employee.id,
        eventType,
        input: {
          effectiveDate: actionForm.effectiveDate,
          reason: actionForm.reason,
        },
      });
    }

    if (!result.ok) {
      setEventSubmitting(false);
      setEventError(result.message);
      return;
    }

    const latestEmployment = getEmploymentHistoryForEmployee(employeeData.employee.id)[0];
    const latestCompensation = getCompensationHistoryForEmployee(employeeData.employee.id)[0];
    if (latestEmployment) {
      setEmployeeData((prev) =>
        prev
          ? {
              ...prev,
              employee: {
                ...prev.employee,
                jobTitle: latestEmployment.title,
                departmentId: latestEmployment.departmentId,
                managerId: latestEmployment.managerId,
                employmentStatus:
                  latestEmployment.employmentStatus === "TERMINATED"
                    ? "OFFBOARDED"
                    : latestEmployment.employmentStatus === "SUSPENDED"
                    ? "OFFBOARDED"
                    : "ACTIVE",
              },
              departmentName:
                departments.find((d) => d.id === latestEmployment.departmentId)?.name ?? prev.departmentName,
              managerName:
                managerOptions.find((m) => m.id === latestEmployment.managerId)
                  ? `${managerOptions.find((m) => m.id === latestEmployment.managerId)!.firstName} ${managerOptions.find((m) => m.id === latestEmployment.managerId)!.lastName}`
                  : "Unassigned",
              employment: {
                ...prev.employment,
                effectiveDate: latestEmployment.effectiveDate,
                endDate: latestEmployment.endDate ?? "—",
                changeReason: latestEmployment.changeReason,
                jobLevel: actionForm.jobLevel || prev.employment.jobLevel,
                separationDate:
                  latestEmployment.employmentStatus === "TERMINATED"
                    ? latestEmployment.effectiveDate
                    : prev.employment.separationDate,
              },
              statusLabel:
                latestEmployment.employmentStatus === "TERMINATED"
                  ? "Terminated"
                  : latestEmployment.employmentStatus === "ONBOARDING"
                  ? "Pre-Hire"
                  : "Active",
            }
          : prev
      );
    }
    if (latestCompensation) {
      setEmployeeData((prev) =>
        prev
          ? {
              ...prev,
              compensation: {
                ...prev.compensation,
                basicSalary: latestCompensation.amount,
                payGrade: latestCompensation.payGrade ?? prev.compensation.payGrade,
                effectiveDate: latestCompensation.effectiveDate,
              },
            }
          : prev
      );
    }
    setHistoryRows((prev) => [
      ...result.auditEvents.map((evt) => ({
        id: evt.id,
        field: evt.fieldChanged,
        oldValue: evt.oldValue,
        newValue: evt.newValue,
        effectiveDate: evt.effectiveDate,
        changedBy: evt.changedBy,
        timestamp: evt.timestamp,
      })),
      ...prev,
    ]);
    setEventSubmitting(false);
    setEventDialogOpen(false);
    setEventMessage(result.message);
  };

  const canEditGovernmentIds =
    currentUser.role === "HR_STAFF" || currentUser.role === "HR_ADMIN";
  const canManageEmploymentEvents = canEditGovernmentIds;
  const isReadOnlyApprover = currentUser.role === "HR_MANAGER";
  const managerOptions = useMemo(
    () => employees.filter((e) => e.employmentStatus === "ACTIVE"),
    []
  );
  const canViewGovernmentIds =
    canEditGovernmentIds ||
    currentUser.role === "EMPLOYEE" ||
    currentUser.role === "HR_MANAGER" ||
    currentUser.role === "AUDITOR";
  const canRequestGovernmentIdUpdate = currentUser.role === "EMPLOYEE";

  const validateGovId = (
    field: keyof GovIdDraft,
    value: string,
    values: GovIdDraft
  ): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return "Value is required.";

    const normalized = trimmed.toLowerCase();
    const duplicates = Object.entries(values).filter(
      ([key, val]) => key !== field && val.trim().toLowerCase() === normalized
    );
    if (duplicates.length > 0) return "Potential duplicate detected. Please review.";

    if (field === "sss" && !/^\d{2}-\d{7}-\d$/.test(trimmed)) {
      return "Use SSS format 12-3456789-0.";
    }
    if ((field === "philHealth" || field === "pagIbig") && !/^\d{4}-\d{4}-\d{4}$/.test(trimmed)) {
      return "Use format 1234-5678-9012.";
    }
    if (field === "tin" && !/^\d{3}-\d{3}-\d{3}$/.test(trimmed)) {
      return "Use TIN format 123-456-789.";
    }
    return null;
  };

  const formatGovIdInput = (field: keyof GovIdDraft, raw: string): string => {
    const digits = raw.replace(/\D/g, "");
    if (field === "sss") {
      const p1 = digits.slice(0, 2);
      const p2 = digits.slice(2, 9);
      const p3 = digits.slice(9, 10);
      return [p1, p2, p3].filter(Boolean).join("-");
    }
    if (field === "philHealth" || field === "pagIbig") {
      const p1 = digits.slice(0, 4);
      const p2 = digits.slice(4, 8);
      const p3 = digits.slice(8, 12);
      return [p1, p2, p3].filter(Boolean).join("-");
    }
    const p1 = digits.slice(0, 3);
    const p2 = digits.slice(3, 6);
    const p3 = digits.slice(6, 9);
    return [p1, p2, p3].filter(Boolean).join("-");
  };

  const applyGovernmentIdUpdate = () => {
    if (!employeeData || !canEditGovernmentIds) return;
    const nextErrors: Partial<Record<keyof GovIdDraft, string>> = {};
    (Object.keys(govIdDraft) as Array<keyof GovIdDraft>).forEach((field) => {
      const err = validateGovId(field, govIdDraft[field], govIdDraft);
      if (err) nextErrors[field] = err;
    });
    setGovIdErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setGovIdMessage("Please fix validation issues before saving.");
      return;
    }

    const currentValues: GovIdDraft = {
      sss: employeeData.personal.sss,
      philHealth: employeeData.personal.philHealth,
      pagIbig: employeeData.personal.pagIbig,
      tin: employeeData.personal.tin,
    };
    const changes: Array<{ field: GovIdField; oldValue: string; newValue: string }> = [];
    if (currentValues.sss !== govIdDraft.sss) changes.push({ field: "SSS", oldValue: currentValues.sss, newValue: govIdDraft.sss });
    if (currentValues.philHealth !== govIdDraft.philHealth) changes.push({ field: "PHILHEALTH", oldValue: currentValues.philHealth, newValue: govIdDraft.philHealth });
    if (currentValues.pagIbig !== govIdDraft.pagIbig) changes.push({ field: "PAGIBIG", oldValue: currentValues.pagIbig, newValue: govIdDraft.pagIbig });
    if (currentValues.tin !== govIdDraft.tin) changes.push({ field: "TIN", oldValue: currentValues.tin, newValue: govIdDraft.tin });

    if (changes.length === 0) {
      setGovIdMessage("No changes to save.");
      return;
    }

    setEmployeeData({
      ...employeeData,
      personal: {
        ...employeeData.personal,
        sss: govIdDraft.sss,
        philHealth: govIdDraft.philHealth,
        pagIbig: govIdDraft.pagIbig,
        tin: govIdDraft.tin,
      },
    });
    setHistoryRows((prev) => [
      ...changes.map((c, idx) => ({
        id: `gov-${Date.now()}-${idx}`,
        field: c.field,
        oldValue: c.oldValue || "Not provided",
        newValue: c.newValue,
        effectiveDate: new Date().toISOString().slice(0, 10),
        changedBy: currentUser.name,
        timestamp: new Date().toLocaleString(),
      })),
      ...prev,
    ]);
    changes.forEach((c) => {
      appendAuditLog({
        actorId: currentUser.employeeId,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action: "PROFILE_CHANGE_AUTO_APPROVED",
        entityType: "EMPLOYEE",
        entityId: id,
        summary: `Government ID ${c.field} updated.`,
        before: { field: c.field, value: c.oldValue || "Not provided" },
        after: { field: c.field, value: c.newValue },
      });
    });
    setGovIdMessage("Government IDs updated successfully.");
  };

  const openRequestUpdateModal = (field: GovIdField) => {
    if (!employeeData) return;
    const currentValue =
      field === "SSS"
        ? employeeData.personal.sss
        : field === "PHILHEALTH"
        ? employeeData.personal.philHealth
        : field === "PAGIBIG"
        ? employeeData.personal.pagIbig
        : employeeData.personal.tin;
    setRequestField(field);
    setRequestNewValue(currentValue || "");
    setRequestReason("");
    setRequestError(null);
    setRequestModalOpen(true);
  };

  const submitGovernmentIdRequest = () => {
    if (!employeeData) return;
    const currentValue =
      requestField === "SSS"
        ? employeeData.personal.sss
        : requestField === "PHILHEALTH"
        ? employeeData.personal.philHealth
        : requestField === "PAGIBIG"
        ? employeeData.personal.pagIbig
        : employeeData.personal.tin;
    if (!requestNewValue.trim()) {
      setRequestError("New value is required.");
      return;
    }
    if (!requestReason.trim()) {
      setRequestError("Reason is required.");
      return;
    }
    if (requestNewValue.trim() === (currentValue || "").trim()) {
      setRequestError("New value must be different from current value.");
      return;
    }
    const req: WorkflowRequest = {
      id: `req-${Date.now()}`,
      type: "PERSONAL_INFO_CHANGE",
      title: `Government ID change request: ${requestField}`,
      createdBy: currentUser.employeeId,
      createdByName: currentUser.name,
      status: "PENDING",
      createdAt: new Date().toISOString(),
      entityId: id,
      entityType: "employee",
      effectiveDate: new Date().toISOString().slice(0, 10),
      personalInfoField: requestField,
      currentValue: currentValue || "Not provided",
      newValue: requestNewValue.trim(),
      reason: requestReason.trim(),
      reviewStage: "HR_STAFF",
      description: `${requestField} update requested by employee.`,
    };
    const existing = loadRequestsFromStorage();
    const list = existing.length > 0 ? [...existing] : [...workflowRequests];
    list.unshift(req);
    saveRequestsToStorage(list);
    appendAuditLog({
      actorId: currentUser.employeeId,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: "PROFILE_CHANGE_REQUESTED",
      entityType: "WORKFLOW_REQUEST",
      entityId: req.id,
      summary: `${currentUser.name} requested ${requestField} update.`,
      before: { value: currentValue || "Not provided" },
      after: { value: requestNewValue.trim(), reason: requestReason.trim() },
    });
    setRequestModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={paths.employees}>
          <ArrowLeft className="size-4 mr-2" />
          Back to employee records
        </Link>
      </Button>

      {loading && (
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-6">
            <div className="rounded-2xl border border-slate-200/70 bg-white px-6 py-4 text-sm font-medium text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              Loading employee details...
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && error && (
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-6 space-y-3">
            <p className="text-sm text-rose-600 dark:text-rose-300">Failed to load employee data</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => void loadProfile()} size="sm">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && employeeData && (
        <>
          {employeeData.pendingChange ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="mr-2 inline size-4" />
              Pending Change Request - {employeeData.pendingChange.message} effective {employeeData.pendingChange.effectiveDate}
            </div>
          ) : null}

          {employeeData.managerInvalid ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
              <AlertTriangle className="mr-2 inline size-4" />
              Manager is inactive or invalid.
            </div>
          ) : null}

          {employeeData.missingData.length > 0 ? (
            <div className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
              <AlertTriangle className="mr-2 inline size-4" />
              Missing required employee data: {employeeData.missingData.join(", ")}
            </div>
          ) : null}

          <Card className="sticky top-0 z-20 rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative size-16 overflow-hidden rounded-full bg-muted">
                    {employeeData.employee.profilePhoto ? (
                      <Image
                        src={employeeData.employee.profilePhoto}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="64px"
                        unoptimized={employeeData.employee.profilePhoto.startsWith("data:")}
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <User className="size-7 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                      {employeeData.employee.firstName} {employeeData.employee.lastName}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {employeeData.employee.jobTitle} • {employeeData.departmentName}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(employeeData.statusLabel)}`}>
                        {employeeData.statusLabel}
                      </span>
                      <span className="text-muted-foreground">
                        Employee ID: <span className="font-medium text-foreground">{employeeData.employee.employeeNumber}</span>
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span>Manager: {employeeData.managerName}</span>
                      <span>Hire Date: {new Date(employeeData.employee.startDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={!canManageEmploymentEvents} onClick={() => actionHandler("Edit Profile")}>Edit Profile</Button>
                  <Button variant="outline" disabled={!canManageEmploymentEvents} onClick={() => actionHandler("Promote")}>Promote</Button>
                  <Button variant="outline" disabled={!canManageEmploymentEvents} onClick={() => actionHandler("Transfer")}>Transfer</Button>
                  <Button variant="outline" disabled={!canManageEmploymentEvents} onClick={() => actionHandler("Change Salary")}>Change Salary</Button>
                  <Button variant="outline" disabled={!canManageEmploymentEvents} onClick={() => actionHandler("Terminate")}>Terminate</Button>
                  <Button variant="ghost" disabled={!canManageEmploymentEvents} onClick={() => setMoreActionsOpen((v) => !v)}>
                    More Actions
                    <ChevronDown className="ml-2 size-4" />
                  </Button>
                  {moreActionsOpen && (
                    <div className="w-full rounded-xl border bg-card p-2 text-sm">
                      <button className="block w-full rounded px-2 py-1 text-left hover:bg-muted" onClick={() => actionHandler("Rehire")}>Rehire</button>
                      <button className="block w-full rounded px-2 py-1 text-left hover:bg-muted" onClick={() => actionHandler("Suspend")}>Suspend</button>
                    </div>
                  )}
                  {!canManageEmploymentEvents && (
                    <p className="w-full text-xs text-muted-foreground">
                      {isReadOnlyApprover
                        ? "HR Manager has read + approval access only. Direct edits are disabled."
                        : "Only HR Staff and HR Admin can execute employment events."}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          {eventMessage ? (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {eventMessage}
            </div>
          ) : null}

          <Tabs value={activeTab} onValueChange={(v) => updateTab(v as DetailTab)} className="space-y-4">
            <div className="sticky top-[150px] z-10 bg-white dark:bg-background">
              <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto scrollbar-hide bg-transparent p-0">
                {TABS.map((tab) => (
                  <TabButton key={tab} value={tab} activeTab={activeTab} />
                ))}
              </TabsList>
            </div>

            <TabsContent value="overview" className="space-y-4 transition-all duration-200">
              <InfoCard title="Employee Summary">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                  <p>Employee ID: {employeeData.employee.employeeNumber}</p>
                  <p>Status: {employeeData.statusLabel}</p>
                  <p>Department: {employeeData.departmentName}</p>
                  <p>Position: {employeeData.employee.jobTitle}</p>
                  <p>Manager: {employeeData.managerName}</p>
                  <p>Hire Date: {new Date(employeeData.employee.startDate).toLocaleDateString()}</p>
                  <p>Employment Type: {(employeeData.employee.employmentType ?? "—").replace(/_/g, " ")}</p>
                </div>
              </InfoCard>
              <div className="grid gap-4 md:grid-cols-3">
                <InfoCard title="Tenure">{employeeData.insights.tenure}</InfoCard>
                <InfoCard title="Last Promotion">{employeeData.insights.lastPromotion}</InfoCard>
                <InfoCard title="Last Update">{employeeData.insights.lastUpdate}</InfoCard>
              </div>
            </TabsContent>

            <TabsContent value="personal" className="transition-all duration-200">
              <div className="space-y-4">
                <InfoCard title="Personal">
                  <div className="grid gap-3 sm:grid-cols-2 text-sm">
                    <p>Full Name: {employeeData.employee.firstName} {employeeData.personal.middleName} {employeeData.employee.lastName}</p>
                    <p>Date of Birth: {employeeData.personal.dob}</p>
                    <p>Gender: {employeeData.personal.gender}</p>
                    <p>Civil Status: {employeeData.personal.civilStatus}</p>
                    <p>Nationality: {employeeData.personal.nationality}</p>
                  </div>
                </InfoCard>
                {canViewGovernmentIds ? (
                  <InfoCard title="Government IDs">
                    <div className="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      {canEditGovernmentIds
                        ? "HR-controlled data. Only HR Staff and HR Admin can edit."
                        : "Managed by HR Staff"}
                    </div>
                    {canEditGovernmentIds ? (
                      <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor="gov-sss">SSS</Label>
                            <Input
                              id="gov-sss"
                              className="rounded-sm"
                              value={govIdDraft.sss}
                              onChange={(e) =>
                                setGovIdDraft((p) => ({
                                  ...p,
                                  sss: formatGovIdInput("sss", e.target.value),
                                }))
                              }
                              placeholder="00-0000000-0"
                            />
                            {govIdErrors.sss ? <p className="text-xs text-destructive">{govIdErrors.sss}</p> : null}
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="gov-ph">PhilHealth</Label>
                            <Input
                              id="gov-ph"
                              className="rounded-sm"
                              value={govIdDraft.philHealth}
                              onChange={(e) =>
                                setGovIdDraft((p) => ({
                                  ...p,
                                  philHealth: formatGovIdInput("philHealth", e.target.value),
                                }))
                              }
                              placeholder="0000-0000-0000"
                            />
                            {govIdErrors.philHealth ? <p className="text-xs text-destructive">{govIdErrors.philHealth}</p> : null}
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="gov-pagibig">Pag-IBIG</Label>
                            <Input
                              id="gov-pagibig"
                              className="rounded-sm"
                              value={govIdDraft.pagIbig}
                              onChange={(e) =>
                                setGovIdDraft((p) => ({
                                  ...p,
                                  pagIbig: formatGovIdInput("pagIbig", e.target.value),
                                }))
                              }
                              placeholder="0000-0000-0000"
                            />
                            {govIdErrors.pagIbig ? <p className="text-xs text-destructive">{govIdErrors.pagIbig}</p> : null}
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="gov-tin">TIN</Label>
                            <Input
                              id="gov-tin"
                              className="rounded-sm"
                              value={govIdDraft.tin}
                              onChange={(e) =>
                                setGovIdDraft((p) => ({
                                  ...p,
                                  tin: formatGovIdInput("tin", e.target.value),
                                }))
                              }
                              placeholder="000-000-000"
                            />
                            {govIdErrors.tin ? <p className="text-xs text-destructive">{govIdErrors.tin}</p> : null}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const sssInput = document.getElementById("gov-sss") as HTMLInputElement | null;
                              sssInput?.focus();
                              sssInput?.select();
                            }}
                          >
                            <Pencil className="mr-1.5 size-4" />
                            Edit
                          </Button>
                          <Button size="sm" onClick={applyGovernmentIdUpdate}>
                            Save Government IDs
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            Validation includes required values, format checks, and mock duplicate detection.
                          </p>
                        </div>
                        {govIdMessage ? <p className="text-xs text-primary">{govIdMessage}</p> : null}
                      </div>
                    ) : (
                      <div className="space-y-3 text-sm">
                        <p>SSS: {employeeData.personal.sss || "Not provided"}</p>
                        <p>PhilHealth: {employeeData.personal.philHealth || "Not provided"}</p>
                        <p>Pag-IBIG: {employeeData.personal.pagIbig || "Not provided"}</p>
                        <p>TIN: {employeeData.personal.tin || "Not provided"}</p>
                        {canRequestGovernmentIdUpdate ? (
                          <div className="flex flex-wrap gap-2 pt-2">
                            <Button size="sm" variant="outline" onClick={() => openRequestUpdateModal("SSS")}>Request SSS Update</Button>
                            <Button size="sm" variant="outline" onClick={() => openRequestUpdateModal("PHILHEALTH")}>Request PhilHealth Update</Button>
                            <Button size="sm" variant="outline" onClick={() => openRequestUpdateModal("PAGIBIG")}>Request Pag-IBIG Update</Button>
                            <Button size="sm" variant="outline" onClick={() => openRequestUpdateModal("TIN")}>Request TIN Update</Button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </InfoCard>
                ) : (
                  <InfoCard title="Government IDs">
                    <p className="text-sm text-muted-foreground">Government IDs are restricted for your role.</p>
                  </InfoCard>
                )}
              </div>
            </TabsContent>

            <TabsContent value="contact" className="space-y-4 transition-all duration-200">
              <InfoCard title="Contact">
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <p>Work Email: {employeeData.contact.workEmail}</p>
                  <p>Personal Email: {employeeData.contact.personalEmail}</p>
                  <p>Phone Number: {employeeData.contact.phone}</p>
                  <p>Current Address: {employeeData.contact.currentAddress}</p>
                  <p>Permanent Address: {employeeData.contact.permanentAddress}</p>
                </div>
              </InfoCard>
              <InfoCard title="Emergency Contacts">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Relationship</TableHead>
                      <TableHead>Phone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeeData.contact.emergencyContact.map((c) => (
                      <TableRow key={`${c.name}-${c.phone}`}>
                        <TableCell>{c.name}</TableCell>
                        <TableCell>{c.relationship}</TableCell>
                        <TableCell>{c.phone}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </InfoCard>
            </TabsContent>

            <TabsContent value="employment" className="space-y-4 transition-all duration-200">
              <InfoCard title="Current Employment">
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <p>Status: {employeeData.statusLabel}</p>
                  <p>Hire Date: {new Date(employeeData.employee.startDate).toLocaleDateString()}</p>
                  <p>Regularization Date: {employeeData.employment.regularizationDate}</p>
                  <p>Separation Date: {employeeData.employment.separationDate}</p>
                  <p>Department: {employeeData.departmentName}</p>
                  <p>Position: {employeeData.employee.jobTitle}</p>
                  <p>Job Level: {employeeData.employment.jobLevel}</p>
                  <p>Employment Type: {(employeeData.employee.employmentType ?? "—").replace(/_/g, " ")}</p>
                  <p>Manager: {employeeData.managerName}</p>
                  <p>Effective Date: {employeeData.employment.effectiveDate}</p>
                  <p>End Date: {employeeData.employment.endDate}</p>
                  <p>Change Reason: {employeeData.employment.changeReason}</p>
                </div>
              </InfoCard>
              <InfoCard title="Employment History (Effective-Dated)">
                <div className="space-y-3 text-sm">
                  <div className="rounded-xl border p-4">
                    <p className="font-medium">{new Date(employeeData.employee.startDate).toLocaleDateString()} - Present</p>
                    <p>Position: {employeeData.employee.jobTitle}</p>
                    <p>Department: {employeeData.departmentName}</p>
                    <p className="text-muted-foreground">Change Reason: Initial Hire</p>
                  </div>
                  <div className="rounded-xl border p-4">
                    <p className="font-medium">May 2026</p>
                    <p>Position: Senior Software Engineer</p>
                    <p className="text-muted-foreground">Change Reason: Promotion</p>
                  </div>
                </div>
              </InfoCard>
            </TabsContent>

            <TabsContent value="compensation" className="transition-all duration-200">
              <InfoCard title="Compensation">
                <div className="mb-3">
                  <Button variant="outline" size="sm" onClick={() => setShowSalary((v) => !v)}>
                    {showSalary ? <EyeOff className="size-4 mr-2" /> : <Eye className="size-4 mr-2" />}
                    {showSalary ? "Hide Salary" : "Show Salary"}
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <p>Basic Salary: <span className={showSalary ? "" : "blur-sm select-none"}>{employeeData.compensation.basicSalary}</span></p>
                  <p>Allowances: <span className={showSalary ? "" : "blur-sm select-none"}>{employeeData.compensation.allowances}</span></p>
                  <p>Pay Grade: <span className={showSalary ? "" : "blur-sm select-none"}>{employeeData.compensation.payGrade}</span></p>
                  <p>Effective Date: {employeeData.compensation.effectiveDate}</p>
                </div>
              </InfoCard>
            </TabsContent>

            <TabsContent value="documents" className="space-y-4 transition-all duration-200">
              <InfoCard title="Documents">
                <div className="mb-3">
                  <Button variant="outline" size="sm" onClick={() => actionHandler("Upload File")}>
                    <Upload className="size-4 mr-2" />
                    Upload File
                  </Button>
                </div>
                {employeeData.documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No documents uploaded</p>
                ) : (
                  <div className="space-y-2">
                    {employeeData.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between rounded-xl border p-3">
                        <div className="flex items-center gap-3 text-sm">
                          <FileText className="size-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{doc.name}</p>
                            <p className="text-muted-foreground">{doc.type}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => actionHandler(`View ${doc.name}`)}>View</Button>
                          <Button variant="ghost" size="sm" onClick={() => actionHandler(`Download ${doc.name}`)}>
                            <Download className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </InfoCard>
            </TabsContent>

            <TabsContent value="history" className="transition-all duration-200">
              <InfoCard title="Audit Trail">
                {historyRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No changes recorded</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Field Changed</TableHead>
                        <TableHead>Old Value</TableHead>
                        <TableHead>New Value</TableHead>
                        <TableHead>Effective Date</TableHead>
                        <TableHead>Changed By</TableHead>
                        <TableHead>Timestamp</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.field}</TableCell>
                          <TableCell>{row.oldValue}</TableCell>
                          <TableCell>{row.newValue}</TableCell>
                          <TableCell>{row.effectiveDate}</TableCell>
                          <TableCell>{row.changedBy}</TableCell>
                          <TableCell>{row.timestamp}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </InfoCard>
            </TabsContent>
          </Tabs>
          <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{eventType.replace(/_/g, " ")}</DialogTitle>
                <DialogDescription>
                  This action creates an employment event and preserves historical versions.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="event-effective-date">Effective Date</Label>
                    <Input
                      id="event-effective-date"
                      type="date"
                      className="rounded-sm"
                      value={actionForm.effectiveDate}
                      onChange={(e) =>
                        setActionForm((prev) => ({ ...prev, effectiveDate: e.target.value }))
                      }
                    />
                  </div>
                  {(eventType === "PROMOTION" || eventType === "REHIRE") && (
                    <div className="space-y-1.5">
                      <Label htmlFor="event-title">Job Title</Label>
                      <Input
                        id="event-title"
                        className="rounded-sm"
                        value={actionForm.title}
                        onChange={(e) =>
                          setActionForm((prev) => ({ ...prev, title: e.target.value }))
                        }
                        placeholder="e.g. Mid-Level Developer"
                      />
                    </div>
                  )}
                  {eventType === "PROMOTION" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="event-level">Job Level</Label>
                      <Input
                        id="event-level"
                        className="rounded-sm"
                        value={actionForm.jobLevel}
                        onChange={(e) =>
                          setActionForm((prev) => ({ ...prev, jobLevel: e.target.value }))
                        }
                        placeholder="e.g. Mid-Level"
                      />
                    </div>
                  )}
                  {(eventType === "SALARY_CHANGE" || eventType === "PROMOTION") && (
                    <div className="space-y-1.5">
                      <Label htmlFor="event-salary">Salary</Label>
                      <Input
                        id="event-salary"
                        className="rounded-sm"
                        value={actionForm.salaryAmount}
                        onChange={(e) =>
                          setActionForm((prev) => ({ ...prev, salaryAmount: e.target.value }))
                        }
                        placeholder="e.g. ₱55,000"
                      />
                    </div>
                  )}
                  {(eventType === "SALARY_CHANGE" || eventType === "PROMOTION") && (
                    <div className="space-y-1.5">
                      <Label htmlFor="event-grade">Pay Grade</Label>
                      <Input
                        id="event-grade"
                        className="rounded-sm"
                        value={actionForm.payGrade}
                        onChange={(e) =>
                          setActionForm((prev) => ({ ...prev, payGrade: e.target.value }))
                        }
                        placeholder="e.g. PG-6"
                      />
                    </div>
                  )}
                  {(eventType === "TRANSFER" || eventType === "REHIRE") && (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="event-department">Department</Label>
                        <select
                          id="event-department"
                          value={actionForm.departmentId}
                          onChange={(e) =>
                            setActionForm((prev) => ({ ...prev, departmentId: e.target.value }))
                          }
                          className="flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Select department</option>
                          {departments.map((dep) => (
                            <option key={dep.id} value={dep.id}>
                              {dep.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="event-manager">Manager</Label>
                        <select
                          id="event-manager"
                          value={actionForm.managerId}
                          onChange={(e) =>
                            setActionForm((prev) => ({ ...prev, managerId: e.target.value }))
                          }
                          className="flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Unassigned</option>
                          {managerOptions.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.firstName} {m.lastName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                  {eventType === "EDIT_PROFILE" && (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="event-phone">Personal Phone</Label>
                        <Input
                          id="event-phone"
                          className="rounded-sm"
                          value={actionForm.personalPhone}
                          onChange={(e) =>
                            setActionForm((prev) => ({ ...prev, personalPhone: e.target.value }))
                          }
                          placeholder="e.g. +63 912 345 6789"
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="event-address">Current Address</Label>
                        <Input
                          id="event-address"
                          className="rounded-sm"
                          value={actionForm.currentAddress}
                          onChange={(e) =>
                            setActionForm((prev) => ({ ...prev, currentAddress: e.target.value }))
                          }
                          placeholder="e.g. Makati City"
                        />
                      </div>
                    </>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="event-reason">Change Reason</Label>
                  <textarea
                    id="event-reason"
                    value={actionForm.reason}
                    onChange={(e) =>
                      setActionForm((prev) => ({ ...prev, reason: e.target.value }))
                    }
                    rows={3}
                    className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Provide business reason for this event"
                  />
                </div>
                {eventError ? <p className="text-xs text-destructive">{eventError}</p> : null}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEventDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={submitActionEvent} disabled={eventSubmitting}>
                  {eventSubmitting ? "Saving..." : "Create Event"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={requestModalOpen} onOpenChange={setRequestModalOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Request Government ID Update</DialogTitle>
                <DialogDescription>
                  Submit a pending change request. HR Staff or HR Admin must approve before applying.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                  <p><span className="font-medium">Field:</span> {requestField}</p>
                  <p><span className="font-medium">Current Value:</span> {(() => {
                    if (!employeeData) return "Not provided";
                    if (requestField === "SSS") return employeeData.personal.sss || "Not provided";
                    if (requestField === "PHILHEALTH") return employeeData.personal.philHealth || "Not provided";
                    if (requestField === "PAGIBIG") return employeeData.personal.pagIbig || "Not provided";
                    return employeeData.personal.tin || "Not provided";
                  })()}</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gov-request-new">New Value</Label>
                  <Input
                    id="gov-request-new"
                    className="rounded-sm"
                    value={requestNewValue}
                    onChange={(e) => setRequestNewValue(e.target.value)}
                    placeholder="Enter updated value"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gov-request-reason">Reason</Label>
                  <textarea
                    id="gov-request-reason"
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                    rows={4}
                    className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Explain why this update is needed"
                  />
                </div>
                {requestError ? <p className="text-xs text-destructive">{requestError}</p> : null}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRequestModalOpen(false)}>Cancel</Button>
                <Button onClick={submitGovernmentIdRequest}>Submit Request</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
