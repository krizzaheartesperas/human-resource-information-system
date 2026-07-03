import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const ROUTES_TO_WARM = [
  "/dashboard",
  "/my-time",
  "/leave",
  "/requests",
  "/payroll",
  "/organization",
  "/complaints",
  "/handbook",
  "/notifications",
  "/profile",
  "/settings",
  "/help",
];

const shouldWarm = process.env.HRIS_SKIP_ROUTE_WARMUP !== "1";
let localUrl = "http://localhost:3000";
let warmupStarted = false;

// Keep dev UI deterministic: wipe transient Next dev output on each startup.
// This prevents stale chunks from resurfacing older screens after frequent hot-reloads.
for (const dir of [join(process.cwd(), ".next", "dev"), join(process.cwd(), ".next", "cache")]) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore cleanup failures; Next can still start.
  }
}

const child = spawn("next dev --webpack", {
  cwd: process.cwd(),
  env: process.env,
  shell: true,
  stdio: ["inherit", "pipe", "pipe"],
});

function maybeStartWarmup(chunk) {
  const text = chunk.toString();
  const localMatch = text.match(/Local:\s+(http:\/\/[^\s]+)/);
  if (localMatch?.[1]) {
    localUrl = localMatch[1];
  }

  if (!shouldWarm || warmupStarted || !text.includes("Ready")) return;
  warmupStarted = true;
  void warmRoutes();
}

async function warmRoutes() {
  process.stdout.write("\n[dev] Warming HRIS sections for faster first navigation...\n");
  for (const route of ROUTES_TO_WARM) {
    const url = new URL(route, localUrl);
    const startedAt = performance.now();
    try {
      const response = await fetch(url, {
        headers: { purpose: "prefetch" },
        signal: AbortSignal.timeout(60_000),
      });
      const elapsed = Math.round(performance.now() - startedAt);
      process.stdout.write(
        `[dev] Warmed ${route} (${response.status}) in ${elapsed}ms\n`
      );
    } catch (error) {
      const elapsed = Math.round(performance.now() - startedAt);
      process.stdout.write(
        `[dev] Skipped ${route} after ${elapsed}ms: ${error instanceof Error ? error.message : String(error)}\n`
      );
    }
  }
  process.stdout.write("[dev] HRIS section warmup complete.\n\n");
}

child.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  maybeStartWarmup(chunk);
});

child.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.exit(0);
  }
  process.exit(code ?? 0);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}
