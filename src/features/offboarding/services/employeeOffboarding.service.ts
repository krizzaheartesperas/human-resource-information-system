"use client";

export type EmployeeOffboardingRequestStatus =
  | "Draft"
  | "Scheduled"
  | "In Progress"
  | "Awaiting Final Approval"
  | "Cancelled"
  | "Completed"
  | "Inactive";

export type EmployeeOffboardingApprovalStatus = "Pending" | "Approved" | "Rejected";

export type EmployeeOffboardingRequestForm = {
  requestType: string;
  submissionDate: string;
  employeeName: string;
  employeeId: string;
  department: string;
  position: string;
  reportingManager: string;
  preferredExitDate: string;
  lastWorkingDay: string;
  noticePeriod: string;
  reasonForExit: string;
  detailedExplanation: string;
  activeProjects: string;
  pendingDeliverables: string;
  suggestedHandoverPerson: string;
  handoverNotes: string;
  assetsInPossession: string[];
  needImmediateExit: boolean;
  immediateExitJustification: string;
  contactNumberAfterExit: string;
  personalEmail: string;
  forwardingNotes: string;
  ackInfoCorrect: boolean;
  ackSubjectToReview: boolean;
  ackFinalPayClearance: boolean;
};

export type EmployeeOffboardingRequest = EmployeeOffboardingRequestForm & {
  id: string;
  status: EmployeeOffboardingRequestStatus;
  managerApproval: EmployeeOffboardingApprovalStatus;
  hrApproval: EmployeeOffboardingApprovalStatus;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeOffboardingChecklistTask = {
  id: string;
  category: string;
  label: string;
  owner: string;
  ownerType: "employee" | "department";
  dueDate: string;
  status: "Pending" | "Waiting Review" | "In Progress" | "Completed";
  completed: boolean;
};

export type EmployeeOffboardingHandoverItem = {
  id: string;
  task: string;
  assignedTo: string;
  dueDate: string;
  status: "Pending" | "In Progress" | "Completed";
  notes: string;
};

export type EmployeeOffboardingActivity = {
  id: string;
  activity: string;
  actor: string;
  happenedAt: string;
  type: "request" | "checklist" | "handover" | "document" | "policy" | "system";
};

export type EmployeeOffboardingDocument = {
  id: string;
  title: string;
  required: boolean;
  status: "Pending" | "Acknowledged";
  acknowledgedAt?: string;
};

export type EmployeeFinalPayStatus = "Pending Clearance" | "On Hold" | "Ready for Payroll";

export type EmployeeOffboardingState = {
  request: EmployeeOffboardingRequest | null;
  checklist: EmployeeOffboardingChecklistTask[];
  handoverItems: EmployeeOffboardingHandoverItem[];
  documents: EmployeeOffboardingDocument[];
  finalPayStatus: EmployeeFinalPayStatus;
  activities: EmployeeOffboardingActivity[];
};

const STORAGE_PREFIX = "hris.employee.offboarding.v1";

function storageKey(employeeId: string) {
  return `${STORAGE_PREFIX}.${employeeId}`;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function formatDate(date: Date, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", opts ?? { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function displayStamp(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function plusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function newId(prefix: string) {
  const uuid = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${uuid}`;
}

function seededChecklist(): EmployeeOffboardingChecklistTask[] {
  return [
    { id: "hr-form", category: "HR Clearance", label: "Submit offboarding form", owner: "You", ownerType: "employee", dueDate: plusDays(3), status: "Pending", completed: false },
    { id: "hr-review", category: "HR Clearance", label: "Review employee separation record", owner: "HR Operations", ownerType: "department", dueDate: plusDays(5), status: "Waiting Review", completed: false },
    { id: "hr-exit", category: "HR Clearance", label: "Complete exit interview", owner: "You", ownerType: "employee", dueDate: plusDays(7), status: "Pending", completed: false },
    { id: "mgr-handover", category: "Manager Clearance", label: "Manager reviews handover completeness", owner: "Reporting Manager", ownerType: "department", dueDate: plusDays(10), status: "Pending", completed: false },
    { id: "mgr-signoff", category: "Manager Clearance", label: "Manager final sign-off", owner: "Reporting Manager", ownerType: "department", dueDate: plusDays(12), status: "Pending", completed: false },
    { id: "it-access", category: "IT Clearance", label: "Disable standard system access", owner: "IT Security", ownerType: "department", dueDate: plusDays(12), status: "Pending", completed: false },
    { id: "it-assets", category: "IT Clearance", label: "Confirm issued devices in inventory", owner: "IT Support", ownerType: "department", dueDate: plusDays(12), status: "Pending", completed: false },
    { id: "fin-payroll", category: "Finance Clearance", label: "Finance reviews final pay readiness", owner: "Finance Team", ownerType: "department", dueDate: plusDays(13), status: "Pending", completed: false },
    { id: "asset-laptop", category: "Asset Return", label: "Mark laptop as returned", owner: "You", ownerType: "employee", dueDate: plusDays(11), status: "Pending", completed: false },
    { id: "asset-id", category: "Asset Return", label: "Mark company ID and access card as returned", owner: "You", ownerType: "employee", dueDate: plusDays(11), status: "Pending", completed: false },
    { id: "asset-verify", category: "Asset Return", label: "Admin verifies returned assets", owner: "Admin Team", ownerType: "department", dueDate: plusDays(13), status: "Pending", completed: false },
  ];
}

function seededDocuments(): EmployeeOffboardingDocument[] {
  return [
    { id: "doc-clearance", title: "Clearance Form", required: true, status: "Pending" },
    { id: "doc-exit-agreement", title: "Exit Agreement", required: true, status: "Pending" },
    { id: "doc-property-return", title: "Company Property Return Confirmation", required: true, status: "Pending" },
    { id: "doc-final-receipt", title: "Final Document Receipt", required: true, status: "Pending" },
  ];
}

function seededHandoverItems(): EmployeeOffboardingHandoverItem[] {
  return [
    {
      id: "handover-1",
      task: "Project Titan documentation",
      assignedTo: "Jane Smith",
      dueDate: plusDays(6),
      status: "In Progress",
      notes: "Transfer final notes and architecture references.",
    },
    {
      id: "handover-2",
      task: "Client onboarding checklist",
      assignedTo: "Bob Wilson",
      dueDate: plusDays(8),
      status: "Pending",
      notes: "Share open items and escalation paths.",
    },
  ];
}

function defaultState(): EmployeeOffboardingState {
  return {
    request: null,
    checklist: seededChecklist(),
    handoverItems: seededHandoverItems(),
    documents: seededDocuments(),
    finalPayStatus: "Pending Clearance",
    activities: [
      {
        id: "seed-1",
        activity: "Opened Offboarding workspace",
        actor: "System",
        happenedAt: displayStamp(nowIso()),
        type: "system",
      },
    ],
  };
}

function normalizeChecklist(tasks?: EmployeeOffboardingChecklistTask[]) {
  if (!tasks?.length) return seededChecklist();
  return tasks.map((task) => ({
  ...task,
  owner:
    task.owner ??
    (task.category.includes("Asset") ||
    task.id === "hr-form" ||
    task.id === "hr-exit"
      ? "You"
      : task.category.includes("HR")
        ? "HR Operations"
        : task.category.includes("Manager")
          ? "Reporting Manager"
          : task.category.includes("IT")
            ? "IT Security"
            : "Finance Team"),
  ownerType:
    task.ownerType ??
    (task.category === "Asset Return" ||
    task.id === "hr-form" ||
    task.id === "hr-exit"
      ? "employee"
      : "department"),
}));
}

function normalizeActivities(activities?: EmployeeOffboardingActivity[]) {
  if (!activities?.length) return defaultState().activities;
  return activities.map((entry) => ({
    actor: entry.actor ?? (entry.type === "system" ? "System" : "You"),
    ...entry,
  }));
}

function normalizeDocuments(documents?: EmployeeOffboardingDocument[]) {
  if (!documents?.length) return seededDocuments();
  return documents.map((doc) => ({
    required: doc.required ?? true,
    status: doc.status ?? "Pending",
    ...doc,
  }));
}

function normalizeState(parsed: EmployeeOffboardingState | null): EmployeeOffboardingState | null {
  if (!parsed) return null;
  return {
    request: parsed.request,
    checklist: normalizeChecklist(parsed.checklist),
    handoverItems: parsed.handoverItems?.length ? parsed.handoverItems : seededHandoverItems(),
    documents: normalizeDocuments(parsed.documents),
    finalPayStatus: parsed.finalPayStatus ?? "Pending Clearance",
    activities: normalizeActivities(parsed.activities),
  };
}

export function loadEmployeeOffboardingState(employeeId: string): EmployeeOffboardingState {
  if (typeof window === "undefined") return defaultState();
  const parsed = normalizeState(safeParse<EmployeeOffboardingState>(window.localStorage.getItem(storageKey(employeeId))));
  if (parsed) return parsed;
  const seeded = defaultState();
  window.localStorage.setItem(storageKey(employeeId), JSON.stringify(seeded));
  return seeded;
}

export function saveEmployeeOffboardingState(employeeId: string, state: EmployeeOffboardingState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(employeeId), JSON.stringify(state));
}

export function createEmployeeOffboardingRequest(
  previous: EmployeeOffboardingState,
  form: EmployeeOffboardingRequestForm
): EmployeeOffboardingState {
  const createdAt = nowIso();
  const request: EmployeeOffboardingRequest = {
    ...form,
    id: `REQ-EXIT-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 100)}`,
    status: "Scheduled",
    managerApproval: "Pending",
    hrApproval: "Pending",
    createdAt,
    updatedAt: createdAt,
  };

  const nextChecklist = previous.checklist.map((task) =>
    task.id === "hr-form" ? { ...task, completed: true, status: "Completed" as const } : task
  );

  return {
    request,
    checklist: nextChecklist,
    handoverItems:
      previous.handoverItems.length > 0
        ? previous.handoverItems
        : seededHandoverItems(),
    documents: previous.documents.length > 0 ? previous.documents : seededDocuments(),
    finalPayStatus: "Pending Clearance",
    activities: [
      {
        id: newId("act"),
        activity: `Submitted ${form.requestType.toLowerCase()} request`,
        actor: "You",
        happenedAt: displayStamp(createdAt),
        type: "request",
      },
      {
        id: newId("act"),
        activity: "HR initiated offboarding",
        actor: "HR",
        happenedAt: displayStamp(createdAt),
        type: "system",
      },
      ...previous.activities,
    ],
  };
}

export function updateEmployeeOffboardingRequest(
  previous: EmployeeOffboardingState,
  updates: Partial<EmployeeOffboardingRequestForm>
): EmployeeOffboardingState {
  if (!previous.request) return previous;
  const updatedAt = nowIso();
  return {
    ...previous,
    request: {
      ...previous.request,
      ...updates,
      status: previous.request.status === "Cancelled" ? "Scheduled" : previous.request.status,
      updatedAt,
    },
    activities: [
      {
        id: newId("act"),
        activity: "Updated exit request details",
        actor: "You",
        happenedAt: displayStamp(updatedAt),
        type: "request",
      },
      ...previous.activities,
    ],
  };
}

export function cancelEmployeeOffboardingRequest(previous: EmployeeOffboardingState): EmployeeOffboardingState {
  if (!previous.request) return previous;
  const updatedAt = nowIso();
  return {
    ...previous,
    request: {
      ...previous.request,
      status: "Cancelled",
      updatedAt,
    },
    activities: [
      {
        id: newId("act"),
        activity: "Cancelled exit request",
        actor: "You",
        happenedAt: displayStamp(updatedAt),
        type: "request",
      },
      ...previous.activities,
    ],
  };
}

export function toggleEmployeeChecklistTask(
  previous: EmployeeOffboardingState,
  taskId: string
): EmployeeOffboardingState {
  const target = previous.checklist.find((task) => task.id === taskId);
  if (!target) return previous;
  if (target.ownerType !== "employee") return previous;
  const completed = !target.completed;
  const nextChecklist = previous.checklist.map((task) =>
    task.id === taskId
      ? {
          ...task,
          completed,
          status: completed
            ? ("Completed" as const)
            : task.status === "Waiting Review"
              ? ("Waiting Review" as const)
              : ("Pending" as const),
        }
      : task
  );
  return {
    ...previous,
    checklist: nextChecklist,
    activities: [
      {
        id: newId("act"),
        activity: `${completed ? "Completed" : "Re-opened"} ${target.label}`,
        actor: "You",
        happenedAt: displayStamp(nowIso()),
        type: "checklist",
      },
      ...previous.activities,
    ],
  };
}

export function addEmployeeHandoverItem(
  previous: EmployeeOffboardingState,
  input: Omit<EmployeeOffboardingHandoverItem, "id">
): EmployeeOffboardingState {
  const item: EmployeeOffboardingHandoverItem = { ...input, id: newId("handover") };
  return {
    ...previous,
    handoverItems: [item, ...previous.handoverItems],
    activities: [
      {
        id: newId("act"),
        activity: `Added handover item: ${input.task}`,
        actor: "You",
        happenedAt: displayStamp(nowIso()),
        type: "handover",
      },
      ...previous.activities,
    ],
  };
}

export function cycleEmployeeHandoverStatus(
  previous: EmployeeOffboardingState,
  itemId: string
): EmployeeOffboardingState {
  const current = previous.handoverItems.find((item) => item.id === itemId);
  if (!current) return previous;
  const nextStatus =
    current.status === "Pending"
      ? "In Progress"
      : current.status === "In Progress"
        ? "Completed"
        : "Pending";
  return {
    ...previous,
    handoverItems: previous.handoverItems.map((item) =>
      item.id === itemId ? { ...item, status: nextStatus } : item
    ),
    activities: [
      {
        id: newId("act"),
        activity: `Updated handover item "${current.task}" to ${nextStatus}`,
        actor: "You",
        happenedAt: displayStamp(nowIso()),
        type: "handover",
      },
      ...previous.activities,
    ],
  };
}

export function acknowledgeEmployeeOffboardingDocument(
  previous: EmployeeOffboardingState,
  documentId: string
): EmployeeOffboardingState {
  const target = previous.documents.find((doc) => doc.id === documentId);
  if (!target || target.status === "Acknowledged") return previous;
  const happenedAt = nowIso();
  return {
    ...previous,
    documents: previous.documents.map((doc) =>
      doc.id === documentId ? { ...doc, status: "Acknowledged", acknowledgedAt: displayStamp(happenedAt) } : doc
    ),
    activities: [
      {
        id: newId("act"),
        activity: `Acknowledged ${target.title}`,
        actor: "You",
        happenedAt: displayStamp(happenedAt),
        type: "document",
      },
      ...previous.activities,
    ],
  };
}

export function logEmployeeOffboardingActivity(
  previous: EmployeeOffboardingState,
  activity: string,
  type: EmployeeOffboardingActivity["type"],
  actor = "You"
): EmployeeOffboardingState {
  return {
    ...previous,
    activities: [
      {
        id: newId("act"),
        activity,
        actor,
        happenedAt: displayStamp(nowIso()),
        type,
      },
      ...previous.activities,
    ],
  };
}

export function getChecklistProgress(checklist: EmployeeOffboardingChecklistTask[]) {
  const total = checklist.length;
  const completed = checklist.filter((task) => task.completed).length;
  const pending = total - completed;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, completed, pending, percent };
}

export function getOffboardingCurrentStatus(state: EmployeeOffboardingState): EmployeeOffboardingRequestStatus {
  if (!state.request) return "Draft";
  if (state.request.status === "Cancelled" || state.request.status === "Completed" || state.request.status === "Inactive") {
    return state.request.status;
  }
  const progress = getChecklistProgress(state.checklist);
  const effectivity = new Date(state.request.lastWorkingDay || state.request.preferredExitDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!Number.isNaN(effectivity.getTime()) && effectivity <= today) return "Inactive";
  if (progress.percent === 100) return "Completed";
  const myPending = state.checklist.filter((task) => task.ownerType === "employee" && !task.completed).length;
  if (myPending === 0 && progress.completed > 0) return "Awaiting Final Approval";
  if (progress.completed > 0) return "In Progress";
  return "Scheduled";
}

export function getFinalPayReadiness(state: EmployeeOffboardingState): EmployeeFinalPayStatus {
  if (!state.request) return "Pending Clearance";
  const myPending = state.checklist.filter((task) => task.ownerType === "employee" && !task.completed).length;
  const docsPending = state.documents.filter((doc) => doc.required && doc.status !== "Acknowledged").length;
  const departmentPending = state.checklist.filter((task) => task.ownerType === "department" && !task.completed).length;
  const effectivity = new Date(state.request.lastWorkingDay || state.request.preferredExitDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if ((myPending > 0 || docsPending > 0) && !Number.isNaN(effectivity.getTime()) && effectivity <= today) return "On Hold";
  if (myPending === 0 && docsPending === 0 && departmentPending <= 1) return "Ready for Payroll";
  return "Pending Clearance";
}

export function buildDocumentText(
  name: string,
  state: EmployeeOffboardingState
) {
  const request = state.request;
  const checklist = getChecklistProgress(state.checklist);
  const lines = [
    name,
    "",
    `Generated: ${formatDate(new Date(), {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })}`,
    "",
  ];

  if (request) {
    lines.push(
      `Request ID: ${request.id}`,
      `Employee: ${request.employeeName}`,
      `Department: ${request.department}`,
      `Position: ${request.position}`,
      `Exit Type: ${request.requestType}`,
      `Preferred Exit Date: ${request.preferredExitDate || "N/A"}`,
      `Last Working Day: ${request.lastWorkingDay || "N/A"}`,
      `Status: ${request.status}`,
      `Manager Approval: ${request.managerApproval}`,
      `HR Approval: ${request.hrApproval}`,
      `Final Pay Readiness: ${getFinalPayReadiness(state)}`,
      ""
    );
  }

  lines.push(
    `Checklist Completed: ${checklist.completed}/${checklist.total}`,
    "",
    "Checklist Items:"
  );

  for (const task of state.checklist) {
    lines.push(`- [${task.completed ? "x" : " "}] ${task.label} (${task.category} | ${task.owner})`);
  }

  lines.push("", "Document Acknowledgements:");

  for (const document of state.documents) {
    lines.push(`- ${document.title}: ${document.status}`);
  }

  return lines.join("\n");
}
