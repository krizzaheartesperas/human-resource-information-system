import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Person name for display: first letter of each word uppercase, rest lowercase (e.g. "glen ramos" → "Glen Ramos").
 */
export function formatPersonName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return name;
  return trimmed
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * UUID-like id; falls back when `crypto.randomUUID` is missing (some mobile WebViews / older browsers).
 */
export function randomUUID(): string {
  const c =
    typeof globalThis !== "undefined" && "crypto" in globalThis
      ? globalThis.crypto
      : undefined;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Sequential leave request id in the format LR-00001.
 * Computes the next number from existing ids in memory.
 */
export function generateLeaveRequestId(existingIds: string[]): string {
  let max = 0;
  for (const id of existingIds) {
    const match = id.match(/^LR-(\d{5})$/);
    if (!match) continue;
    const n = parseInt(match[1] ?? "0", 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  const next = Math.min(max + 1, 99999);
  return `LR-${String(next).padStart(5, "0")}`;
}
