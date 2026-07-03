import type { WorkflowRequest } from "@/lib/mock";

export const REQUESTS_STORAGE_KEY = "hris-workflow-requests";

export function loadRequestsFromStorage(): WorkflowRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REQUESTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WorkflowRequest[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRequestsToStorage(items: WorkflowRequest[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}
