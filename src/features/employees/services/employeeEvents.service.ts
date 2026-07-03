import { employees, getEmployeeById, type Employee, type Role } from "@/lib/mock";
import { appendAuditLog } from "@/features/audit/services/audit.service";
import {
  loadAddedEmployees,
  loadEmployeeOverrides,
  saveEmployeeOverrides,
} from "@/features/employees/services/employeeProfileService";
import { loadRequestsFromStorage } from "@/features/workflow/services/workflowRequests";

const EMPLOYMENT_HISTORY_KEY = "hris-employment-history-records";
const COMPENSATION_HISTORY_KEY = "hris-compensation-history-records";
const EMPLOYEE_EVENT_KEY = "hris-employee-events";
const EMPLOYEE_PENDING_EVENT_KEY = "hris-employee-pending-events";

export type EmployeeEventType =
  | "EDIT_PROFILE"
  | "PROMOTION"
  | "TRANSFER"
  | "SALARY_CHANGE"
  | "TERMINATION"
  | "REHIRE"
  | "SUSPENSION";

type EmploymentStatusValue =
  | "ACTIVE"
  | "ONBOARDING"
  | "OFFBOARDED"
  | "TERMINATED"
  | "SUSPENDED";

export type EmploymentHistoryRecord = {
  id: string;
  employeeId: string;
  title: string;
  departmentId: string;
  managerId: string | null;
  employmentStatus: EmploymentStatusValue;
  employmentType: Employee["employmentType"];
  salarySnapshot?: string;
  effectiveDate: string;
  endDate: string | null;
  changeReason: string;
  createdAt: string;
};

export type CompensationHistoryRecord = {
  id: string;
  employeeId: string;
  amount: string;
  payGrade?: string;
  effectiveDate: string;
  endDate: string | null;
  reason: string;
  createdAt: string;
};

export type EmployeeAuditEvent = {
  id: string;
  employeeId: string;
  eventType: EmployeeEventType;
  fieldChanged: string;
  oldValue: string;
  newValue: string;
  effectiveDate: string;
  changedBy: string;
  timestamp: string;
};

export type PendingEmployeeEvent = {
  id: string;
  employeeId: string;
  eventType: EmployeeEventType;
  fieldChanged: string;
  effectiveDate: string;
  status: "PENDING";
  createdAt: string;
};

type EventInputByType = {
  EDIT_PROFILE: {
    effectiveDate: string;
    changes: Partial<Pick<Employee, "currentAddress" | "personalPhone">>;
    reason: string;
  };
  PROMOTION: {
    effectiveDate: string;
    title: string;
    jobLevel: string;
    salarySnapshot?: string;
    payGrade?: string;
    reason: string;
  };
  TRANSFER: {
    effectiveDate: string;
    departmentId: string;
    managerId: string | null;
    reason: string;
  };
  SALARY_CHANGE: {
    effectiveDate: string;
    amount: string;
    payGrade?: string;
    reason: string;
  };
  TERMINATION: {
    effectiveDate: string;
    reason: string;
  };
  REHIRE: {
    effectiveDate: string;
    title?: string;
    departmentId?: string;
    managerId?: string | null;
    reason: string;
  };
  SUSPENSION: {
    effectiveDate: string;
    reason: string;
  };
};

type EventInput<T extends EmployeeEventType> = EventInputByType[T];

type EventResult =
  | { ok: true; message: string; auditEvents: EmployeeAuditEvent[] }
  | { ok: false; message: string };

function nowIso() {
  return new Date().toISOString();
}

function isDateInFuture(date: string) {
  const d = new Date(date);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return d.getTime() > today.getTime();
}

function loadJson<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveJson<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function getAllEmployeesSnapshot(): Employee[] {
  const overrides = loadEmployeeOverrides();
  const added = loadAddedEmployees();
  return [...employees, ...added].map((e) => ({ ...e, ...(overrides[e.id] ?? {}) }));
}

function hasCircularHierarchy(employeeId: string, managerId: string | null): boolean {
  if (!managerId) return false;
  const byId = new Map(getAllEmployeesSnapshot().map((e) => [e.id, e]));
  const seen = new Set<string>([employeeId]);
  let cursor: string | null = managerId;
  while (cursor) {
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    cursor = byId.get(cursor)?.managerId ?? null;
  }
  return false;
}

function getEmployeePendingEvents(employeeId: string) {
  return loadJson<PendingEmployeeEvent>(EMPLOYEE_PENDING_EVENT_KEY).filter(
    (item) => item.employeeId === employeeId && item.status === "PENDING"
  );
}

function hasEffectiveDateConflict(employeeId: string, effectiveDate: string): boolean {
  const history = loadEmploymentHistory(employeeId);
  return history.some((row) => row.effectiveDate === effectiveDate && row.endDate === null);
}

function ensureUniqueEmployeeNumber(target: Employee) {
  const all = getAllEmployeesSnapshot();
  return !all.some(
    (row) =>
      row.id !== target.id &&
      String(row.employeeNumber).trim().toLowerCase() ===
        String(target.employeeNumber).trim().toLowerCase()
  );
}

function loadEmploymentHistory(employeeId: string): EmploymentHistoryRecord[] {
  const stored = loadJson<EmploymentHistoryRecord>(EMPLOYMENT_HISTORY_KEY).filter(
    (row) => row.employeeId === employeeId
  );
  if (stored.length > 0) return stored.sort((a, b) => (a.effectiveDate < b.effectiveDate ? 1 : -1));
  const base = getEmployeeById(employeeId);
  if (!base) return [];
  return [
    {
      id: `eh-base-${employeeId}`,
      employeeId,
      title: base.jobTitle,
      departmentId: base.departmentId,
      managerId: base.managerId,
      employmentStatus: base.employmentStatus as EmploymentStatusValue,
      employmentType: base.employmentType,
      salarySnapshot: undefined,
      effectiveDate: base.startDate,
      endDate: null,
      changeReason: "Initial Hire",
      createdAt: nowIso(),
    },
  ];
}

function persistEmploymentHistory(records: EmploymentHistoryRecord[]) {
  const all = loadJson<EmploymentHistoryRecord>(EMPLOYMENT_HISTORY_KEY);
  const keep = all.filter(
    (row) => !records.some((next) => next.employeeId === row.employeeId && next.id === row.id)
  );
  saveJson(EMPLOYMENT_HISTORY_KEY, [...keep, ...records]);
}

function loadCompensationHistory(employeeId: string): CompensationHistoryRecord[] {
  return loadJson<CompensationHistoryRecord>(COMPENSATION_HISTORY_KEY)
    .filter((row) => row.employeeId === employeeId)
    .sort((a, b) => (a.effectiveDate < b.effectiveDate ? 1 : -1));
}

function persistCompensationHistory(records: CompensationHistoryRecord[]) {
  const all = loadJson<CompensationHistoryRecord>(COMPENSATION_HISTORY_KEY);
  const keep = all.filter(
    (row) => !records.some((next) => next.employeeId === row.employeeId && next.id === row.id)
  );
  saveJson(COMPENSATION_HISTORY_KEY, [...keep, ...records]);
}

function updateEmployeeOverride(employeeId: string, updates: Partial<Employee>) {
  const map = loadEmployeeOverrides();
  map[employeeId] = { ...(map[employeeId] ?? {}), ...updates };
  saveEmployeeOverrides(map);
}

function pushEmployeeEvents(events: EmployeeAuditEvent[]) {
  const existing = loadJson<EmployeeAuditEvent>(EMPLOYEE_EVENT_KEY);
  saveJson(EMPLOYEE_EVENT_KEY, [...events, ...existing]);
  events.forEach((event) => {
    appendAuditLog({
      actorId: event.changedBy,
      actorName: event.changedBy,
      actorRole: "HR_STAFF",
      action: "PROFILE_CHANGE_AUTO_APPROVED",
      entityType: "EMPLOYEE",
      entityId: event.employeeId,
      summary: `${event.eventType}: ${event.fieldChanged}`,
      before: { value: event.oldValue },
      after: { value: event.newValue, effectiveDate: event.effectiveDate },
    });
  });
}

function validateCommon<T extends EmployeeEventType>(
  actorRole: Role,
  employee: Employee,
  eventType: T,
  input: EventInput<T>
): EventResult | null {
  if (actorRole !== "HR_STAFF" && actorRole !== "HR_ADMIN") {
    return { ok: false, message: "Only HR Staff and HR Admin can apply this action directly." };
  }
  if (!ensureUniqueEmployeeNumber(employee)) {
    return { ok: false, message: "Duplicate employee number detected. Employee ID must stay unique." };
  }
  const pending = getEmployeePendingEvents(employee.id).find(
    (item) => item.fieldChanged === eventType
  );
  if (pending) {
    return {
      ok: false,
      message: `A pending ${eventType} request already exists for this employee.`,
    };
  }
  const workflowTypeByEvent: Record<EmployeeEventType, string> = {
    EDIT_PROFILE: "PERSONAL_INFO_CHANGE",
    PROMOTION: "PROMOTION",
    TRANSFER: "TRANSFER",
    SALARY_CHANGE: "SALARY_CHANGE",
    TERMINATION: "ROLE_CHANGE",
    REHIRE: "ROLE_CHANGE",
    SUSPENSION: "ROLE_CHANGE",
  };
  const pendingWorkflow = loadRequestsFromStorage().find(
    (req) =>
      req.entityId === employee.id &&
      req.type === workflowTypeByEvent[eventType] &&
      String(req.status).startsWith("PENDING")
  );
  if (pendingWorkflow) {
    return {
      ok: false,
      message: `A pending ${pendingWorkflow.type} workflow already exists for this employee.`,
    };
  }
  if (isDateInFuture(input.effectiveDate) && employee.employmentStatus !== "ONBOARDING") {
    return {
      ok: false,
      message: "Effective date cannot be in the future unless employee is Pre-Hire/Onboarding.",
    };
  }
  if (hasEffectiveDateConflict(employee.id, input.effectiveDate)) {
    return {
      ok: false,
      message: "Effective date conflicts with an existing open employment record.",
    };
  }
  return null;
}

export function createEmployeeEvent<T extends EmployeeEventType>(args: {
  actorRole: Role;
  actorName: string;
  employeeId: string;
  eventType: T;
  input: EventInput<T>;
}): EventResult {
  const employee = getAllEmployeesSnapshot().find((row) => row.id === args.employeeId);
  if (!employee) return { ok: false, message: "Employee not found." };

  const commonError = validateCommon(args.actorRole, employee, args.eventType, args.input);
  if (commonError) return commonError;

  const audits: EmployeeAuditEvent[] = [];
  const now = nowIso();
  const history = loadEmploymentHistory(employee.id);
  const latest = history[0] ?? null;

  const endPreviousRecord = (effectiveDate: string) => {
    if (!latest) return;
    latest.endDate = effectiveDate;
  };

  if (args.eventType === "EDIT_PROFILE") {
    const input = args.input as EventInputByType["EDIT_PROFILE"];
    const changes = input.changes;
    const illegal = Object.keys(changes).some(
      (field) => !["currentAddress", "personalPhone"].includes(field)
    );
    if (illegal) {
      return { ok: false, message: "Edit Profile only allows personal/contact non-sensitive fields." };
    }
    if (changes.currentAddress && changes.currentAddress.trim().length < 5) {
      return { ok: false, message: "Current address is too short." };
    }
    if (changes.personalPhone && changes.personalPhone.trim().length < 8) {
      return { ok: false, message: "Personal phone is invalid." };
    }
    updateEmployeeOverride(employee.id, changes);
    Object.entries(changes).forEach(([field, value]) => {
      audits.push({
        id: `audit-${Date.now()}-${field}`,
        employeeId: employee.id,
        eventType: "EDIT_PROFILE",
        fieldChanged: field,
        oldValue: String((employee as unknown as Record<string, unknown>)[field] ?? "—"),
        newValue: String(value ?? "—"),
        effectiveDate: input.effectiveDate,
        changedBy: args.actorName,
        timestamp: now,
      });
    });
  }

  if (args.eventType === "PROMOTION") {
    const input = args.input as EventInputByType["PROMOTION"];
    if (!input.title.trim()) return { ok: false, message: "New job title is required." };
    endPreviousRecord(input.effectiveDate);
    const next: EmploymentHistoryRecord = {
      id: `eh-${Date.now()}`,
      employeeId: employee.id,
      title: input.title,
      departmentId: employee.departmentId,
      managerId: employee.managerId,
      employmentStatus: "ACTIVE",
      employmentType: employee.employmentType,
      salarySnapshot: input.salarySnapshot,
      effectiveDate: input.effectiveDate,
      endDate: null,
      changeReason: input.reason || `Promotion to ${input.jobLevel}`,
      createdAt: now,
    };
    persistEmploymentHistory([next, ...history]);
    updateEmployeeOverride(employee.id, { jobTitle: input.title, employmentStatus: "ACTIVE" });
    audits.push({
      id: `audit-${Date.now()}-promotion`,
      employeeId: employee.id,
      eventType: "PROMOTION",
      fieldChanged: "jobTitle",
      oldValue: employee.jobTitle,
      newValue: input.title,
      effectiveDate: input.effectiveDate,
      changedBy: args.actorName,
      timestamp: now,
    });
  }

  if (args.eventType === "TRANSFER") {
    const input = args.input as EventInputByType["TRANSFER"];
    const dept = input.departmentId.trim();
    if (!dept) return { ok: false, message: "Department is required." };
    const manager = input.managerId ? getEmployeeById(input.managerId) : null;
    if (input.managerId && !manager) return { ok: false, message: "Manager does not exist." };
    if (manager && manager.employmentStatus !== "ACTIVE") {
      return { ok: false, message: "Manager must be active." };
    }
    if (hasCircularHierarchy(employee.id, input.managerId)) {
      return { ok: false, message: "Transfer would create a circular reporting hierarchy." };
    }
    endPreviousRecord(input.effectiveDate);
    const next: EmploymentHistoryRecord = {
      id: `eh-${Date.now()}`,
      employeeId: employee.id,
      title: employee.jobTitle,
      departmentId: dept,
      managerId: input.managerId,
      employmentStatus: "ACTIVE",
      employmentType: employee.employmentType,
      effectiveDate: input.effectiveDate,
      endDate: null,
      changeReason: input.reason || "Transfer",
      createdAt: now,
    };
    persistEmploymentHistory([next, ...history]);
    updateEmployeeOverride(employee.id, { departmentId: dept, managerId: input.managerId });
    audits.push({
      id: `audit-${Date.now()}-transfer`,
      employeeId: employee.id,
      eventType: "TRANSFER",
      fieldChanged: "departmentId",
      oldValue: employee.departmentId,
      newValue: dept,
      effectiveDate: input.effectiveDate,
      changedBy: args.actorName,
      timestamp: now,
    });
  }

  if (args.eventType === "SALARY_CHANGE") {
    const input = args.input as EventInputByType["SALARY_CHANGE"];
    if (!input.amount.trim()) return { ok: false, message: "Salary amount is required." };
    const comp = loadCompensationHistory(employee.id);
    const latestComp = comp[0];
    if (latestComp && latestComp.effectiveDate === input.effectiveDate) {
      return { ok: false, message: "Compensation record already exists for this effective date." };
    }
    if (latestComp) latestComp.endDate = input.effectiveDate;
    const nextComp: CompensationHistoryRecord = {
      id: `comp-${Date.now()}`,
      employeeId: employee.id,
      amount: input.amount,
      payGrade: input.payGrade,
      effectiveDate: input.effectiveDate,
      endDate: null,
      reason: input.reason,
      createdAt: now,
    };
    persistCompensationHistory([nextComp, ...comp]);
    audits.push({
      id: `audit-${Date.now()}-salary`,
      employeeId: employee.id,
      eventType: "SALARY_CHANGE",
      fieldChanged: "salary",
      oldValue: latestComp?.amount ?? "Not provided",
      newValue: input.amount,
      effectiveDate: input.effectiveDate,
      changedBy: args.actorName,
      timestamp: now,
    });
  }

  if (args.eventType === "TERMINATION") {
    const input = args.input as EventInputByType["TERMINATION"];
    if (new Date(input.effectiveDate).getTime() < new Date(employee.startDate).getTime()) {
      return { ok: false, message: "Termination date must be on or after hire date." };
    }
    endPreviousRecord(input.effectiveDate);
    const next: EmploymentHistoryRecord = {
      id: `eh-${Date.now()}`,
      employeeId: employee.id,
      title: employee.jobTitle,
      departmentId: employee.departmentId,
      managerId: employee.managerId,
      employmentStatus: "TERMINATED",
      employmentType: employee.employmentType,
      effectiveDate: input.effectiveDate,
      endDate: null,
      changeReason: input.reason || "Termination",
      createdAt: now,
    };
    persistEmploymentHistory([next, ...history]);
    updateEmployeeOverride(employee.id, { employmentStatus: "OFFBOARDED" });
    audits.push({
      id: `audit-${Date.now()}-termination`,
      employeeId: employee.id,
      eventType: "TERMINATION",
      fieldChanged: "employmentStatus",
      oldValue: employee.employmentStatus,
      newValue: "TERMINATED",
      effectiveDate: input.effectiveDate,
      changedBy: args.actorName,
      timestamp: now,
    });
  }

  if (args.eventType === "REHIRE") {
    const input = args.input as EventInputByType["REHIRE"];
    if (employee.employmentStatus === "ACTIVE") {
      return { ok: false, message: "Employee is already active. Rehire is not allowed." };
    }
    endPreviousRecord(input.effectiveDate);
    const next: EmploymentHistoryRecord = {
      id: `eh-${Date.now()}`,
      employeeId: employee.id,
      title: input.title?.trim() || employee.jobTitle,
      departmentId: input.departmentId?.trim() || employee.departmentId,
      managerId: input.managerId ?? employee.managerId,
      employmentStatus: "ACTIVE",
      employmentType: employee.employmentType,
      effectiveDate: input.effectiveDate,
      endDate: null,
      changeReason: input.reason || "Rehire",
      createdAt: now,
    };
    persistEmploymentHistory([next, ...history]);
    updateEmployeeOverride(employee.id, {
      employmentStatus: "ACTIVE",
      departmentId: next.departmentId,
      managerId: next.managerId,
      jobTitle: next.title,
    });
    audits.push({
      id: `audit-${Date.now()}-rehire`,
      employeeId: employee.id,
      eventType: "REHIRE",
      fieldChanged: "employmentStatus",
      oldValue: employee.employmentStatus,
      newValue: "ACTIVE",
      effectiveDate: input.effectiveDate,
      changedBy: args.actorName,
      timestamp: now,
    });
  }

  if (args.eventType === "SUSPENSION") {
    const input = args.input as EventInputByType["SUSPENSION"];
    if (employee.employmentStatus !== "ACTIVE") {
      return { ok: false, message: "Only active employees can be suspended." };
    }
    endPreviousRecord(input.effectiveDate);
    const next: EmploymentHistoryRecord = {
      id: `eh-${Date.now()}`,
      employeeId: employee.id,
      title: employee.jobTitle,
      departmentId: employee.departmentId,
      managerId: employee.managerId,
      employmentStatus: "SUSPENDED",
      employmentType: employee.employmentType,
      effectiveDate: input.effectiveDate,
      endDate: null,
      changeReason: input.reason || "Suspension",
      createdAt: now,
    };
    persistEmploymentHistory([next, ...history]);
    updateEmployeeOverride(employee.id, { employmentStatus: "SUSPENDED" as Employee["employmentStatus"] });
    audits.push({
      id: `audit-${Date.now()}-suspension`,
      employeeId: employee.id,
      eventType: "SUSPENSION",
      fieldChanged: "employmentStatus",
      oldValue: employee.employmentStatus,
      newValue: "SUSPENDED",
      effectiveDate: input.effectiveDate,
      changedBy: args.actorName,
      timestamp: now,
    });
  }

  pushEmployeeEvents(audits);
  return { ok: true, message: `${args.eventType} event created successfully.`, auditEvents: audits };
}

export function getEmploymentHistoryForEmployee(employeeId: string): EmploymentHistoryRecord[] {
  return loadEmploymentHistory(employeeId);
}

export function getCompensationHistoryForEmployee(
  employeeId: string
): CompensationHistoryRecord[] {
  return loadCompensationHistory(employeeId);
}

export function getEmployeeAuditEvents(employeeId: string): EmployeeAuditEvent[] {
  return loadJson<EmployeeAuditEvent>(EMPLOYEE_EVENT_KEY)
    .filter((row) => row.employeeId === employeeId)
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

