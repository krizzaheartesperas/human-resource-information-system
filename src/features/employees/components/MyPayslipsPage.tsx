import { redirect } from "next/navigation";

export default function EmployeeMyPayslipsPage() {
  // HR Staff "My Payslip" should reuse the Payroll UI tabs (Overview / Payslips / Payroll History / Payroll Activity Logs),
  // but with employee-like scoping for the logged-in user.
  redirect("/payroll?tab=overview&mode=my-payslips");
}

