import type { Employee } from "@/lib/mock";

const ADDED_EMPLOYEES_KEY = "hris-added-employees";
const EMPLOYEE_OVERRIDES_KEY = "hris-employee-overrides";

type EmployeeOverrides = Record<string, Partial<Employee>>;

export function loadAddedEmployees(): Employee[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ADDED_EMPLOYEES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Employee[];
  } catch {
    return [];
  }
}

export function loadEmployeeOverrides(): EmployeeOverrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(EMPLOYEE_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as EmployeeOverrides;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveEmployeeOverrides(map: EmployeeOverrides) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(EMPLOYEE_OVERRIDES_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function formatBirthday(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatEmploymentType(type: string) {
  return type.replace(/_/g, " ");
}

export function isLikelyValidAddress(address: string) {
  const trimmed = address.trim();
  if (trimmed.length < 5) return false;
  const hasLetter = /[A-Za-z]/.test(trimmed);
  const hasDigit = /\d/.test(trimmed);
  const hasSpace = /\s/.test(trimmed);
  return hasLetter && hasSpace && (hasDigit || trimmed.length >= 8);
}

export function formatPhilippinePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const withoutCountry = digits.startsWith("63") ? digits.slice(2) : digits;
  const limited = withoutCountry.slice(0, 10);
  let formatted = "+63";
  if (limited.length > 0) formatted += " " + limited.slice(0, 3);
  if (limited.length > 3) formatted += " " + limited.slice(3, 6);
  if (limited.length > 6) formatted += " " + limited.slice(6, 10);
  return formatted;
}
