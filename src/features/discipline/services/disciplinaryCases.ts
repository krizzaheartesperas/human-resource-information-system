import type { DisciplinaryCase } from "@/features/discipline/types";

export const DISCIPLINARY_STORAGE_KEY = "hris-disciplinary-cases";

export function loadDisciplinaryCases(): DisciplinaryCase[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DISCIPLINARY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DisciplinaryCase[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function formatDisciplinaryDateLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}
