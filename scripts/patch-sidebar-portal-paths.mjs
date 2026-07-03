import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const f = path.join(__dirname, "../src/components/layout/Sidebar.tsx");
let s = fs.readFileSync(f, "utf8");

const pairs = [
  [
    `pathname === "/payroll" || pathname.startsWith("/payroll")`,
    `pathname === paths.payroll || pathname.startsWith(\`\${paths.payroll}/\`)`,
  ],
  [`pathname === "/payroll"`, `pathname === paths.payroll`],
  [`pathname === "/audit"`, `pathname === paths.audit`],
  [`pathname === "/discipline"`, `pathname === paths.discipline`],
  [`pathname === "/notifications"`, `pathname === paths.notifications`],
  [`pathname === "/requests"`, `pathname === paths.requests`],
  [`pathname === "/organization" || pathname === "/departments"`, `pathname === paths.organization || pathname === paths.departments`],
  [`pathname === "/organization"`, `pathname === paths.organization`],
  [`pathname === "/employees"`, `pathname === paths.employees`],
  [`pathname === "/account"`, `pathname === paths.profile`],
  [`pathname === "/settings"`, `pathname === paths.settings`],
  [`pathname === "/help"`, `pathname === paths.help`],
  [`pathname.startsWith("/reports/attendance")`, `pathname.startsWith(paths.reportsAttendance)`],
  [`pathname.startsWith("/reports/workforce")`, `pathname.startsWith(paths.reportsWorkforce)`],
  [`pathname === "/leave"`, `pathMatchesLeave(pathname, paths.leave)`],
  [`pathname.startsWith("/complaints/manager")`, `pathname.startsWith(paths.complaintsManager)`],
  [`pathname.startsWith("/complaints/admin")`, `pathname.startsWith(paths.complaintsAdmin)`],
  [`pathname.startsWith("/complaints/audit")`, `pathname.startsWith(paths.complaintsAudit)`],
  [`pathname.startsWith("/complaints/executive")`, `pathname.startsWith(paths.complaintsExecutive)`],
  [`pathname.startsWith("/complaints/staff")`, `pathname.startsWith(paths.complaintsStaff)`],
  [`href="/complaints/executive"`, `href={paths.complaintsExecutive}`],
  [`href="/complaints/admin"`, `href={paths.complaintsAdmin}`],
  [`href="/complaints/manager"`, `href={paths.complaintsManager}`],
  [`href="/audit"`, `href={paths.audit}`],
  [`href="/discipline"`, `href={paths.discipline}`],
  [`href="/notifications"`, `href={paths.notifications}`],
  [`href="/settings"`, `href={paths.settings}`],
  [`href="/help"`, `href={paths.help}`],
  [`href="/account"`, `href={paths.profile}`],
  [`href="/requests"`, `href={paths.requests}`],
  [`href="/payroll"`, `href={paths.payroll}`],
  [`href="/organization"`, `href={paths.organization}`],
  [`href="/departments"`, `href={paths.departments}`],
  [`href="/complaints"`, `href={paths.complaints}`],
  [`href="/leave"`, `href={paths.leave}`],
  [`href="/"`, `href={paths.dashboard}`],
  [`pathname === "/"`, `pathname === paths.dashboard`],
  [`item.href === "/"`, `item.href === paths.dashboard`],
  [`item.href !== "/"`, `item.href !== paths.dashboard`],
  [`item.href === "/payroll"`, `item.href === paths.payroll`],
  [`item.href === "/leave"`, `item.href === paths.leave`],
];

for (const [a, b] of pairs) {
  const n = s.split(a).length - 1;
  if (n > 0) {
    s = s.split(a).join(b);
    console.log("replaced", n, "x", a.slice(0, 50));
  }
}

// href="/payroll?... — convert to template (remaining double-quoted payroll links)
s = s.replace(/href="\/payroll\?([^"]+)"/g, "href={`${paths.payroll}?$1`}");
s = s.replace(/href="\/audit\?([^"]+)"/g, "href={`${paths.audit}?$1`}");
s = s.replace(/href="\/reports\/attendance\?([^"]+)"/g, "href={`${paths.reportsAttendance}?$1`}");
s = s.replace(/href="\/reports\/workforce\?([^"]+)"/g, "href={`${paths.reportsWorkforce}?$1`}");
s = s.replace(/href="\/leave\?([^"]+)"/g, "href={`${paths.leave}?$1`}");
s = s.replace(/href="\/employees(\?[^"]*)?"/g, (_, q) =>
  q ? "href={`${paths.employees}" + q + "`}" : "href={paths.employees}"
);

// Fix broken employees pattern - the regex might be wrong
// Re-read file if needed

fs.writeFileSync(f, s);
console.log("Sidebar patch done.");
