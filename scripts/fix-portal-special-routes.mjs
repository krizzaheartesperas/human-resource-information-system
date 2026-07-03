import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const APP = path.join(ROOT, "src", "app");

const portals = [
  ["employee", "employee"],
  ["manager", "manager"],
  ["hr-staff", "hr-staff"],
  ["hr-admin", "hr-admin"],
  ["hr-manager", "hr-manager"],
  ["auditor", "auditor"],
  ["executive", "executive"],
  ["sys-admin", "sys-admin"],
];

for (const [group, seg] of portals) {
  const base = path.join(APP, `(${group})`, seg);
  const accountDir = path.join(base, "account");
  const myPayslipsDir = path.join(base, "employees", "my-payslips");
  fs.rmSync(accountDir, { recursive: true, force: true });
  fs.rmSync(myPayslipsDir, { recursive: true, force: true });

  const profilePage = path.join(base, "profile", "page.tsx");
  fs.mkdirSync(path.dirname(profilePage), { recursive: true });
  fs.writeFileSync(
    profilePage,
    `export { default } from "@/features/profile/components/AccountProfilePage";\n`
  );

  const payslipsPage = path.join(base, "payslips", "page.tsx");
  fs.mkdirSync(path.dirname(payslipsPage), { recursive: true });
  fs.writeFileSync(
    payslipsPage,
    `export { default } from "@/features/employees/components/MyPayslipsPage";\n`
  );
}

console.log("Fixed profile + payslips routes for all portals.");
