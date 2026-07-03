/**
 * One-off scaffold: copy (dashboard) pages → src/features, generate role portal routes.
 * Run from repo root: node scripts/scaffold-portal-routes.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DASH = path.join(ROOT, "src", "app", "(dashboard)");

const portals = [
  { group: "employee", seg: "employee" },
  { group: "manager", seg: "manager" },
  { group: "hr-staff", seg: "hr-staff" },
  { group: "hr-admin", seg: "hr-admin" },
  { group: "hr-manager", seg: "hr-manager" },
  { group: "auditor", seg: "auditor" },
  { group: "executive", seg: "executive" },
  { group: "sys-admin", seg: "sys-admin" },
];

/** Relative path under (dashboard) → import path (no @/ prefix) */
const routeMap = [
  { from: "page.tsx", to: "features/dashboard/components/DashboardHomePage.tsx", importPath: "@/features/dashboard/components/DashboardHomePage" },
  { from: "attendance/page.tsx", to: "features/attendance/components/AttendancePage.tsx", importPath: "@/features/attendance/components/AttendancePage" },
  { from: "leave/page.tsx", to: "features/leave/components/LeavePage.tsx", importPath: "@/features/leave/components/LeavePage" },
  { from: "account/page.tsx", to: "features/account/components/AccountProfilePage.tsx", importPath: "@/features/profile/components/AccountProfilePage" },
  { from: "requests/page.tsx", to: "features/workflow/components/RequestsPage.tsx", importPath: "@/features/workflow/components/RequestsPage" },
  { from: "notifications/page.tsx", to: "features/notifications/components/NotificationsPage.tsx", importPath: "@/features/notifications/components/NotificationsPage" },
  { from: "help/page.tsx", to: "features/help/components/HelpPage.tsx", importPath: "@/features/help/components/HelpPage" },
  { from: "payroll/page.tsx", to: "features/payroll/components/PayrollPage.tsx", importPath: "@/features/payroll/components/PayrollPage" },
  { from: "payroll/PayrollPageClient.tsx", to: "features/payroll/components/PayrollPageClient.tsx", importPath: null },
  { from: "payroll/payslips/[id]/page.tsx", to: "features/payroll/components/PayrollPayslipDetailPage.tsx", importPath: "@/features/payroll/components/PayrollPayslipDetailPage" },
  { from: "employees/page.tsx", to: "features/employees/components/EmployeesPage.tsx", importPath: "@/features/employees/components/EmployeesPage" },
  { from: "employees/[id]/page.tsx", to: "features/employees/components/EmployeeDetailPage.tsx", importPath: "@/features/employees/components/EmployeeDetailPage" },
  { from: "employees/my-payslips/page.tsx", to: "features/employees/components/MyPayslipsPage.tsx", importPath: "@/features/employees/components/MyPayslipsPage" },
  { from: "organization/page.tsx", to: "features/organization/components/OrganizationPage.tsx", importPath: "@/features/organization/components/OrganizationPage" },
  { from: "departments/page.tsx", to: "features/organization/components/DepartmentsPage.tsx", importPath: "@/features/organization/components/DepartmentsPage" },
  { from: "settings/page.tsx", to: "features/settings/components/SettingsPage.tsx", importPath: "@/features/settings/components/SettingsPage" },
  { from: "audit/page.tsx", to: "features/audit/components/AuditPage.tsx", importPath: "@/features/audit/components/AuditPage" },
  { from: "discipline/page.tsx", to: "features/discipline/components/DisciplinePage.tsx", importPath: "@/features/discipline/components/DisciplinePage" },
  { from: "reports/attendance/page.tsx", to: "features/reports/components/ReportsAttendancePage.tsx", importPath: "@/features/reports/components/ReportsAttendancePage" },
  { from: "reports/workflow/page.tsx", to: "features/reports/components/ReportsWorkflowPage.tsx", importPath: "@/features/reports/components/ReportsWorkflowPage" },
  { from: "reports/workforce/page.tsx", to: "features/reports/components/ReportsWorkforcePage.tsx", importPath: "@/features/reports/components/ReportsWorkforcePage" },
  { from: "complaints/page.tsx", to: "features/complaints/components/ComplaintsHubPage.tsx", importPath: "@/features/complaints/components/ComplaintsHubPage" },
  { from: "complaints/[id]/page.tsx", to: "features/complaints/components/ComplaintDetailPage.tsx", importPath: "@/features/complaints/components/ComplaintDetailPage" },
  { from: "complaints/admin/page.tsx", to: "features/complaints/components/ComplaintsAdminPage.tsx", importPath: "@/features/complaints/components/ComplaintsAdminPage" },
  { from: "complaints/audit/page.tsx", to: "features/complaints/components/ComplaintsAuditPage.tsx", importPath: "@/features/complaints/components/ComplaintsAuditPage" },
  { from: "complaints/executive/page.tsx", to: "features/complaints/components/ComplaintsExecutivePage.tsx", importPath: "@/features/complaints/components/ComplaintsExecutivePage" },
  { from: "complaints/staff/page.tsx", to: "features/complaints/components/ComplaintsStaffPage.tsx", importPath: "@/features/complaints/components/ComplaintsStaffPage" },
  { from: "complaints/manager/page.tsx", to: "features/complaints/components/ComplaintsManagerPage.tsx", importPath: "@/features/complaints/components/ComplaintsManagerPage" },
  { from: "complaints/manager/approval/[id]/page.tsx", to: "features/complaints/components/ComplaintManagerApprovalPage.tsx", importPath: "@/features/complaints/components/ComplaintManagerApprovalPage" },
  { from: "complaints/manager/escalated/[id]/page.tsx", to: "features/complaints/components/ComplaintManagerEscalatedPage.tsx", importPath: "@/features/complaints/components/ComplaintManagerEscalatedPage" },
];

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copySourceFiles() {
  for (const row of routeMap) {
    if (!row.importPath) continue;
    const src = path.join(DASH, row.from);
    const dest = path.join(ROOT, "src", row.to);
    ensureDir(path.dirname(dest));
    if (!fs.existsSync(src)) {
      console.warn("Missing source:", src);
      continue;
    }
    fs.copyFileSync(src, dest);
  }
  const clientSrc = path.join(DASH, "payroll", "PayrollPageClient.tsx");
  const clientDest = path.join(ROOT, "src", "features", "payroll", "components", "PayrollPageClient.tsx");
  if (fs.existsSync(clientSrc)) {
    ensureDir(path.dirname(clientDest));
    fs.copyFileSync(clientSrc, clientDest);
  }
}

function fixPayrollPageImport() {
  const p = path.join(ROOT, "src", "features", "payroll", "components", "PayrollPage.tsx");
  if (!fs.existsSync(p)) return;
  let s = fs.readFileSync(p, "utf8");
  s = s.replace(
    `import PayrollPageClient from "./PayrollPageClient";`,
    `import PayrollPageClient from "@/features/payroll/components/PayrollPageClient";`
  );
  fs.writeFileSync(p, s);
}

function appRoutePath(portalSeg, fromDashPath) {
  if (fromDashPath === "page.tsx") return path.join(portalSeg, "dashboard", "page.tsx");
  return path.join(portalSeg, fromDashPath);
}

function writePortalRoutes() {
  const appRoot = path.join(ROOT, "src", "app");
  for (const { group, seg } of portals) {
    const layoutDir = path.join(appRoot, `(${group})`, seg);
    ensureDir(layoutDir);
    const layoutContent = `import RoleDashboardLayout from "@/core/layouts/RoleDashboardLayout";

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleDashboardLayout>{children}</RoleDashboardLayout>;
}
`;
    fs.writeFileSync(path.join(layoutDir, "layout.tsx"), layoutContent);

    for (const row of routeMap) {
      if (!row.importPath) continue;
      const rel = appRoutePath(seg, row.from);
      const full = path.join(appRoot, `(${group})`, rel);
      ensureDir(path.dirname(full));
      const body = `export { default } from "${row.importPath}";
`;
      fs.writeFileSync(full, body);
    }
  }
}

function copyReportsLayout() {
  const src = path.join(DASH, "reports", "layout.tsx");
  const dest = path.join(ROOT, "src", "features", "reports", "components", "ReportsSectionLayout.tsx");
  if (fs.existsSync(src)) {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
  for (const { group, seg } of portals) {
    const rel = path.join(seg, "reports", "layout.tsx");
    const full = path.join(ROOT, "src", "app", `(${group})`, rel);
    ensureDir(path.dirname(full));
    fs.writeFileSync(
      full,
      `export { default } from "@/features/reports/components/ReportsSectionLayout";
`
    );
  }
}

function copyLoading() {
  const src = path.join(DASH, "loading.tsx");
  if (!fs.existsSync(src)) return;
  const dest = path.join(ROOT, "src", "features", "dashboard", "components", "DashboardLoading.tsx");
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  for (const { group, seg } of portals) {
    const full = path.join(ROOT, "src", "app", `(${group})`, seg, "loading.tsx");
    ensureDir(path.dirname(full));
    fs.writeFileSync(
      full,
      `export { default } from "@/features/dashboard/components/DashboardLoading";
`
    );
  }
}

copySourceFiles();
fixPayrollPageImport();
writePortalRoutes();
copyReportsLayout();
copyLoading();
console.log("Portal scaffold done.");
