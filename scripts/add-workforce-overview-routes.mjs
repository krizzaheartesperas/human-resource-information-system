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

const body = `export { default } from "@/features/reports/components/ReportsWorkforcePage";
`;

for (const [group, seg] of portals) {
  const dir = path.join(APP, `(${group})`, seg, "workforce-overview");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "page.tsx"), body);
}

console.log("workforce-overview routes added.");
