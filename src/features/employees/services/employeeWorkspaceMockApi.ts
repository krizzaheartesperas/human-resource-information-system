import {
  getDepartmentById,
  getEmployeeById,
  getJobHistoryByEmployeeId,
  type Employee,
} from "@/lib/mock";
import { loadAddedEmployees, loadEmployeeOverrides } from "@/features/employees/services/employeeProfileService";
import { supabase } from "@/lib/supabase/client";

export type EmployeeWorkspaceDocument = {
  id: string;
  name: string;
  type: string;
  updatedAt: string;
};

export type EmployeeWorkspaceHistory = {
  id: string;
  field: string;
  oldValue: string;
  newValue: string;
  effectiveDate: string;
  changedBy: string;
  timestamp: string;
};

export type EmployeeWorkspaceData = {
  employee: Employee;
  managerName: string;
  departmentName: string;
  statusLabel: "Active" | "Pre-Hire" | "Terminated" | "Inactive";
  pendingChange: { message: string; effectiveDate: string } | null;
  managerInvalid: boolean;
  missingData: string[];
  personal: {
    middleName: string;
    dob: string;
    gender: string;
    civilStatus: string;
    nationality: string;
    sss: string;
    philHealth: string;
    pagIbig: string;
    tin: string;
  };
  contact: {
    workEmail: string;
    personalEmail: string;
    phone: string;
    currentAddress: string;
    permanentAddress: string;
    emergencyContact: { name: string; relationship: string; phone: string }[];
  };
  employment: {
    regularizationDate: string;
    separationDate: string;
    jobLevel: string;
    effectiveDate: string;
    endDate: string;
    changeReason: string;
  };
  compensation: {
    basicSalary: string;
    allowances: string;
    payGrade: string;
    effectiveDate: string;
  };
  documents: EmployeeWorkspaceDocument[];
  insights: {
    tenure: string;
    lastPromotion: string;
    lastUpdate: string;
  };
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function resolveEmployee(id: string): Promise<Employee | null> {
  const base = getEmployeeById(id);
  if (base) return { ...base, ...(loadEmployeeOverrides()[id] ?? {}) } as Employee;
  const added = loadAddedEmployees().find((e) => e.id === id);
  if (added) return { ...added, ...(loadEmployeeOverrides()[id] ?? {}) } as Employee;

  // Fallback for DB-backed employee IDs coming from /employees list.
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return null;

    const resp = await fetch("/api/employees", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as { employees?: Employee[] };
    const fromApi = Array.isArray(json.employees)
      ? json.employees.find((e) => String(e.id) === String(id))
      : null;
    return fromApi ? ({ ...fromApi, ...(loadEmployeeOverrides()[id] ?? {}) } as Employee) : null;
  } catch {
    return null;
  }
}

function toStatusLabel(status: string): EmployeeWorkspaceData["statusLabel"] {
  const raw = String(status ?? "").toUpperCase();
  if (raw === "ACTIVE") return "Active";
  if (raw === "ONBOARDING" || raw === "PRE_HIRE") return "Pre-Hire";
  if (raw === "OFFBOARDED" || raw === "TERMINATED") return "Terminated";
  return "Inactive";
}

function computeTenure(startDate: string): string {
  const start = new Date(startDate || "2024-01-15");
  const now = new Date();
  const months = Math.max(
    0,
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  );
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return `${years} year${years !== 1 ? "s" : ""} ${remMonths} month${remMonths !== 1 ? "s" : ""}`;
}

export async function getEmployeeByIdForWorkspace(
  id: string
): Promise<EmployeeWorkspaceData | null> {
  await wait(650);
  // Optional failure simulation for robust error handling UX
  if (Math.random() < 0.05) {
    throw new Error("Mock API network error while loading employee profile.");
  }

  const employee = await resolveEmployee(id);
  if (!employee) return null;

  const departmentName = getDepartmentById(employee.departmentId)?.name ?? "Unassigned";
  const manager = employee.managerId ? getEmployeeById(employee.managerId) : null;
  const managerName = manager ? `${manager.firstName} ${manager.lastName}` : "Unassigned";
  const managerInvalid = Boolean(manager && manager.employmentStatus !== "ACTIVE");

  const missingData: string[] = [];
  if (!employee.birthday) missingData.push("Date of birth");
  if (!employee.personalPhone) missingData.push("Phone number");
  if (!employee.currentAddress) missingData.push("Current address");

  return {
    employee,
    managerName,
    departmentName,
    statusLabel: toStatusLabel(employee.employmentStatus),
    pendingChange: {
      message: "Promotion to Senior HR Specialist",
      effectiveDate: "May 1, 2026",
    },
    managerInvalid,
    missingData,
    personal: {
      middleName: "—",
      dob: employee.birthday ?? "—",
      gender: "Male",
      civilStatus: "Single",
      nationality: "Filipino",
      sss: "12-3456789-0",
      philHealth: "1234-5678-9012",
      pagIbig: "1234-5678-9012",
      tin: "123-456-789",
    },
    contact: {
      workEmail: employee.email,
      personalEmail: "juan@email.com",
      phone: employee.personalPhone ?? "0917-123-4567",
      currentAddress: employee.currentAddress ?? "Makati City",
      permanentAddress: "Camarines Norte",
      emergencyContact: [
        { name: "Maria Santos", relationship: "Mother", phone: "0918-999-8888" },
      ],
    },
    employment: {
      regularizationDate: "Jul 15, 2024",
      separationDate: "—",
      jobLevel: "Mid-Level",
      effectiveDate: "Jan 15, 2024",
      endDate: "—",
      changeReason: "Initial Hire",
    },
    compensation: {
      basicSalary: "₱45,000",
      allowances: "₱5,000",
      payGrade: "PG-5",
      effectiveDate: "Jan 2024",
    },
    documents: [
      { id: "doc-1", name: "Resume.pdf", type: "PDF", updatedAt: "2026-03-01" },
      { id: "doc-2", name: "Contract.pdf", type: "PDF", updatedAt: "2026-02-18" },
      { id: "doc-3", name: "ID_Scan.png", type: "PNG", updatedAt: "2026-01-11" },
    ],
    insights: {
      tenure: computeTenure(employee.startDate),
      lastPromotion: "None",
      lastUpdate: "March 10, 2026",
    },
  };
}

export async function getEmployeeHistoryForWorkspace(
  id: string
): Promise<EmployeeWorkspaceHistory[]> {
  await wait(500);
  const employee = await resolveEmployee(id);
  if (!employee) return [];

  const baseHistory = getJobHistoryByEmployeeId(employee.id).map((h, idx) => ({
    id: `job-${idx}`,
    field: "Position",
    oldValue: idx === 0 ? "Junior Dev" : "—",
    newValue: h.jobTitle,
    effectiveDate: h.startDate,
    changedBy: "Admin",
    timestamp: `${h.startDate} 09:00`,
  }));

  const auditHistory: EmployeeWorkspaceHistory[] = [
    {
      id: "audit-1",
      field: "Department",
      oldValue: "IT",
      newValue: "Engineering",
      effectiveDate: "Jan 2024",
      changedBy: "Admin",
      timestamp: "Jan 10, 2024 10:20",
    },
    {
      id: "audit-2",
      field: "Position",
      oldValue: "Junior Dev",
      newValue: "Software Eng",
      effectiveDate: "Jan 2024",
      changedBy: "Admin",
      timestamp: "Jan 10, 2024 10:22",
    },
  ];

  return [...auditHistory, ...baseHistory];
}
