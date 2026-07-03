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

const pageFiles = walk(featuresRoot).filter((f) => /[\\/]pages[\\/].+\.tsx$/.test(f));
let updated = 0;

for (const pageFile of pageFiles) {
  const text = fs.readFileSync(pageFile, "utf8");
  const m = text.match(/import\s+\{\s*([A-Za-z0-9_]+)\s*\}\s+from\s+"(@\/features\/[^"]+\/components\/[^"]+)";/);
  if (!m) continue;

  const symbol = m[1];
  const importPath = m[2];
  if (!text.includes(`export { ${symbol} };`)) continue;
  const componentFsPath = path.join(root, "src", importPath.replace("@/", ""));
  if (!fs.existsSync(componentFsPath)) continue;

  const componentText = fs.readFileSync(componentFsPath, "utf8");
  const hasDefault = /\bexport\s+default\b/.test(componentText);
  if (!hasDefault) continue;

  const replacement = `import ${symbol}Component from "${importPath}";

export const ${symbol} = ${symbol}Component;
`;

  fs.writeFileSync(pageFile, replacement, "utf8");
  updated += 1;
}

console.log(`Updated ${updated} page wrappers.`);
