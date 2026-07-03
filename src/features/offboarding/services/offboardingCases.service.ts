import type { Role } from "@/lib/mock";

export type OffboardingCaseStatus = "Pending" | "In Progress" | "Completed" | "Blocked";

export type OffboardingCase = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber?: string;
  employeeEmail?: string;
  departmentId: string;
  departmentName: string;
  exitType: string;
  lastDay: string; // YYYY-MM-DD
  status: OffboardingCaseStatus;
  progress: number; // 0-100
  currentStep: number; // 1-8 aligned with ProgressTracker
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

export type OffboardingAuditEntry = {
  id: string;
  when: string; // YYYY-MM-DD HH:mm (display)
  actor: string;
  actorRole?: Role;
  action: string;
  target: string;
  caseId?: string;
};

const CASES_KEY = "hris.offboarding.cases.v1";
const AUDIT_KEY = "hris.offboarding.audit.v1";

function safeParseJson<T>(raw: string | null): T | null {
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

function formatWhen(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function newId(prefix: string) {
  const uuid = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : null;
  return `${prefix}-${uuid ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function seedCases(): OffboardingCase[] {
  const createdAt = nowIso();
  return [
    {
      id: "case-1",
      employeeId: "emp-demo-1",
      employeeName: "Isla Dela Cruz",
      employeeNumber: "EMP-00124",
      employeeEmail: "isla.delacruz@workzen.demo",
      departmentId: "dept-2",
      departmentName: "Engineering",
      exitType: "Resignation",
      lastDay: "2026-04-30",
      status: "In Progress",
      progress: 65,
      currentStep: 6,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "case-2",
      employeeId: "emp-demo-2",
      employeeName: "Glean Ramos",
      employeeNumber: "EMP-00110",
      employeeEmail: "glean.ramos@workzen.demo",
      departmentId: "dept-3",
      departmentName: "Information Technology",
      exitType: "End of Contract",
      lastDay: "2026-05-03",
      status: "Pending",
      progress: 10,
      currentStep: 2,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "case-3",
      employeeId: "emp-demo-3",
      employeeName: "Lisa Chen",
      employeeNumber: "EMP-00077",
      employeeEmail: "lisa.chen@workzen.demo",
      departmentId: "dept-4",
      departmentName: "Finance",
      exitType: "Resignation",
      lastDay: "2026-04-26",
      status: "Completed",
      progress: 100,
      currentStep: 8,
      createdAt,
      updatedAt: createdAt,
    },
  ];
}

function seedAudit(): OffboardingAuditEntry[] {
  return [
    {
      id: "au-1",
      when: "2026-04-20 11:05",
      actor: "Engineering Manager",
      action: "Approved offboarding",
      target: "Isla Dela Cruz",
      caseId: "case-1",
    },
    {
      id: "au-2",
      when: "2026-04-21 16:10",
      actor: "IT Team",
      action: "Started account deactivation checklist",
      target: "Isla Dela Cruz",
      caseId: "case-1",
    },
    {
      id: "au-3",
      when: "2026-04-23 14:30",
      actor: "HR Staff",
      action: "Scheduled exit interview",
      target: "Isla Dela Cruz",
      caseId: "case-1",
    },
  ];
}

function readCasesRaw(): OffboardingCase[] {
  if (typeof window === "undefined") return seedCases();
  const parsed = safeParseJson<OffboardingCase[]>(window.localStorage.getItem(CASES_KEY));
  if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  const seeded = seedCases();
  window.localStorage.setItem(CASES_KEY, JSON.stringify(seeded));
  return seeded;
}

function writeCases(cases: OffboardingCase[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CASES_KEY, JSON.stringify(cases));
}

function readAuditRaw(): OffboardingAuditEntry[] {
  if (typeof window === "undefined") return seedAudit();
  const parsed = safeParseJson<OffboardingAuditEntry[]>(window.localStorage.getItem(AUDIT_KEY));
  if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  const seeded = seedAudit();
  window.localStorage.setItem(AUDIT_KEY, JSON.stringify(seeded));
  return seeded;
}

function writeAudit(entries: OffboardingAuditEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUDIT_KEY, JSON.stringify(entries));
}

export function getOffboardingCases(): OffboardingCase[] {
  return readCasesRaw();
}

export function getOffboardingAudit(): OffboardingAuditEntry[] {
  return readAuditRaw();
}

export function createOffboardingCase(input: {
  employeeId: string;
  employeeName: string;
  employeeNumber?: string;
  employeeEmail?: string;
  departmentId: string;
  departmentName: string;
  exitType: string;
  lastDay: string;
  createdByName: string;
  createdByRole: Role;
}): OffboardingCase {
  const ts = nowIso();
  const newCase: OffboardingCase = {
    id: newId("case"),
    employeeId: input.employeeId,
    employeeName: input.employeeName,
    employeeNumber: input.employeeNumber,
    employeeEmail: input.employeeEmail,
    departmentId: input.departmentId,
    departmentName: input.departmentName,
    exitType: input.exitType,
    lastDay: input.lastDay,
    status: "Pending",
    progress: 5,
    currentStep: 2, // HR initiation completed, awaiting manager approval
    createdAt: ts,
    updatedAt: ts,
  };
  const cases = readCasesRaw();
  writeCases([newCase, ...cases]);

  addOffboardingAudit({
    actor: input.createdByName,
    actorRole: input.createdByRole,
    action: "Initiated offboarding case",
    target: input.employeeName,
    caseId: newCase.id,
  });

  return newCase;
}

export function updateOffboardingCase(caseId: string, patch: Partial<OffboardingCase>): OffboardingCase | null {
  const cases = readCasesRaw();
  const idx = cases.findIndex((c) => c.id === caseId);
  if (idx < 0) return null;
  const updated: OffboardingCase = { ...cases[idx], ...patch, updatedAt: nowIso() };
  const next = cases.slice();
  next[idx] = updated;
  writeCases(next);
  return updated;
}

export function advanceOffboardingCase(input: {
  caseId: string;
  nextStep: number;
  actor: string;
  actorRole?: Role;
  action: string;
}): OffboardingCase | null {
  const nextStep = Math.max(1, Math.min(8, input.nextStep));
  const progress = Math.round(((nextStep - 1) / 7) * 100);
  const status: OffboardingCaseStatus =
    nextStep >= 8 ? "Completed" : nextStep >= 2 ? "In Progress" : "Pending";
  const updated = updateOffboardingCase(input.caseId, {
    currentStep: nextStep,
    progress: nextStep >= 8 ? 100 : Math.max(5, progress),
    status,
  });
  if (!updated) return null;
  addOffboardingAudit({
    actor: input.actor,
    actorRole: input.actorRole,
    action: input.action,
    target: updated.employeeName,
    caseId: updated.id,
  });
  return updated;
}

export function blockOffboardingCase(input: {
  caseId: string;
  actor: string;
  actorRole?: Role;
  reason: string;
}): OffboardingCase | null {
  const updated = updateOffboardingCase(input.caseId, { status: "Blocked" });
  if (!updated) return null;
  addOffboardingAudit({
    actor: input.actor,
    actorRole: input.actorRole,
    action: `Blocked case: ${input.reason}`,
    target: updated.employeeName,
    caseId: updated.id,
  });
  return updated;
}

export function addOffboardingAudit(input: {
  actor: string;
  actorRole?: Role;
  action: string;
  target: string;
  caseId?: string;
}) {
  const entries = readAuditRaw();
  const entry: OffboardingAuditEntry = {
    id: newId("au"),
    when: formatWhen(new Date()),
    actor: input.actor,
    actorRole: input.actorRole,
    action: input.action,
    target: input.target,
    caseId: input.caseId,
  };
  writeAudit([entry, ...entries]);
}
