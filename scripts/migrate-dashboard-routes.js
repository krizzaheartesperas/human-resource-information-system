const fs = require("fs");
const path = require("path");

const projectRoot = process.cwd();
const appRoot = path.join(projectRoot, "src", "app");
const dashboardRoot = path.join(appRoot, "(dashboard)");
const roles = [
  "employee",
  "manager",
  "hr-staff",
  "hr-admin",
  "hr-manager",
  "auditor",
  "executive",
  "sys-admin",
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function toPageWrapper(importPath) {
  const rawName = importPath.split("/").pop() || "FeaturePage";
  const safeName = rawName.replace(/[^A-Za-z0-9_]/g, "") || "FeaturePage";
  return `import { ${safeName} } from "${importPath}";

export default function Page() {
  return <${safeName} />;
}
`;
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function copyIfMissing(from, to) {
  if (fs.existsSync(from) && !fs.existsSync(to)) {
    ensureDir(to);
    fs.copyFileSync(from, to);
  }
}

fs.mkdirSync(dashboardRoot, { recursive: true });
const seen = new Set();

for (const role of roles) {
  const roleRoot = path.join(appRoot, `(${role})`, role);
  if (!fs.existsSync(roleRoot)) continue;

  const files = walk(roleRoot);
  for (const file of files) {
    if (!file.endsWith(`${path.sep}page.tsx`)) continue;
    const relative = path.relative(roleRoot, file);
    const key = relative.split(path.sep).join("/");
    if (seen.has(key)) continue;

    const target = path.join(dashboardRoot, relative);
    const source = fs.readFileSync(file, "utf8");
    const match = source.match(/export\s*\{\s*default\s*\}\s*from\s*["']([^"']+)["'];?/);

    ensureDir(target);
    if (match) fs.writeFileSync(target, toPageWrapper(match[1]), "utf8");
    else fs.writeFileSync(target, source, "utf8");
    seen.add(key);
  }

  copyIfMissing(path.join(roleRoot, "layout.tsx"), path.join(dashboardRoot, "layout.tsx"));
  copyIfMissing(path.join(roleRoot, "loading.tsx"), path.join(dashboardRoot, "loading.tsx"));
  copyIfMissing(
    path.join(roleRoot, "reports", "layout.tsx"),
    path.join(dashboardRoot, "reports", "layout.tsx"),
  );
}

console.log(`Generated ${seen.size} dashboard routes.`);
