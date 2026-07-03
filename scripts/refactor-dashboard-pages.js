const fs = require("fs");
const path = require("path");

const root = process.cwd();
const dashboardRoot = path.join(root, "src", "app", "(dashboard)");

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const pages = walk(dashboardRoot).filter((f) => f.endsWith(`${path.sep}page.tsx`));
let updated = 0;
let created = 0;

for (const file of pages) {
  const source = fs.readFileSync(file, "utf8");
  const importMatch = source.match(
    /import\s*\{\s*([A-Za-z0-9_]+)\s*\}\s*from\s*["'](@\/features\/([^/]+)\/components\/[^"']+)["'];?/,
  );
  if (!importMatch) continue;

  const symbol = importMatch[1];
  const componentImport = importMatch[2];
  const domain = importMatch[3];
  const pageImport = componentImport.replace("/components/", "/pages/");
  const pageFile = path.join(root, "src", "features", domain, "pages", `${symbol}.tsx`);

  if (!fs.existsSync(pageFile)) {
    fs.mkdirSync(path.dirname(pageFile), { recursive: true });
    fs.writeFileSync(
      pageFile,
      `import { ${symbol} } from "${componentImport}";

export { ${symbol} };
`,
      "utf8",
    );
    created += 1;
  }

  const replaced = source.replace(componentImport, pageImport);
  if (replaced !== source) {
    fs.writeFileSync(file, replaced, "utf8");
    updated += 1;
  }
}

console.log(`Updated ${updated} app pages, created ${created} feature page files.`);
