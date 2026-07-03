const fs = require("fs");
const path = require("path");

const root = process.cwd();
const featuresRoot = path.join(root, "src", "features");

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const pageFiles = walk(featuresRoot).filter((f) => f.endsWith(`${path.sep}pages${path.sep}${path.basename(f)}`) && f.endsWith(".tsx"));
let updated = 0;

for (const file of pageFiles) {
  const src = fs.readFileSync(file, "utf8");
  const m = src.match(/import\s*\{\s*([A-Za-z0-9_]+)\s*\}\s*from\s*"([^"]+)";/);
  if (!m) continue;
  const symbol = m[1];
  const importPath = m[2];
  if (!importPath.includes("/components/")) continue;

  const componentPath = path.join(root, "src", importPath.replace("@/src/", "").replace("@/", ""));
  const componentExists = fs.existsSync(componentPath);
  const componentText = componentExists ? fs.readFileSync(componentPath, "utf8") : "";
  const hasDefault = /\bexport\s+default\b/.test(componentText);

  const next = hasDefault
    ? `import ${symbol}Component from "${importPath}";

export const ${symbol} = ${symbol}Component;
`
    : `import { ${symbol} } from "${importPath}";

export { ${symbol} };
`;

  if (next !== src) {
    fs.writeFileSync(file, next, "utf8");
    updated += 1;
  }
}

console.log(`Updated ${updated} feature page wrappers.`);
