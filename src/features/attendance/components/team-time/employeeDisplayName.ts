import type { EmployeeRow } from "@/lib/supabase/client";
import { demoUsersByRole, getDemoNameForEmail } from "@/lib/mock";

export function employeeDisplayName(
  e: Partial<
    Pick<
      EmployeeRow,
      | "first_name"
      | "last_name"
      | "full_name"
      | "name"
      | "employee_number"
      | "employee_code"
      | "email"
      | "id"
    >
  >
): string {
  const fn = (e.first_name ?? "").trim();
  const ln = (e.last_name ?? "").trim();
  const combined = `${fn} ${ln}`.trim();
  if (combined) return combined;
  const full = (e.full_name ?? "").trim();
  if (full) return full;
  const single = (e.name ?? "").trim();
  if (single) return single;

  const empNo = (e.employee_number ?? e.employee_code ?? "").toString().trim().toUpperCase();
  if (empNo) {
    const demoByEmployeeNo = Object.values(demoUsersByRole).find(
      (u) => (u.employeeNumber ?? "").trim().toUpperCase() === empNo
    );
    if (demoByEmployeeNo?.name) return demoByEmployeeNo.name;
  }

  const demoByEmail = getDemoNameForEmail((e.email ?? "").toString());
  if (demoByEmail) return demoByEmail;
  const no = (e.employee_number ?? e.employee_code ?? "").toString().trim();
  if (no) return no;
  return (e.id ?? "").toString().trim() || "—";
}
