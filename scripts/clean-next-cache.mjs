import fs from "node:fs/promises";

const TARGETS = [".next", ".turbo", "node_modules/.cache"];

async function removePath(target) {
  try {
    await fs.rm(target, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

const removed = [];
for (const target of TARGETS) {
  // eslint-disable-next-line no-await-in-loop
  const ok = await removePath(target);
  if (ok) removed.push(target);
}

const message =
  removed.length > 0
    ? `Removed: ${removed.join(", ")}`
    : "Nothing to remove (no cache directories found).";

process.stdout.write(`${message}\n`);

