import type { ItAccountActionRequest } from "@/features/it-account-actions/types";

const STORAGE_KEY = "hris-it-account-actions";

function safeParseArray(raw: string | null): ItAccountActionRequest[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as ItAccountActionRequest[];
  } catch {
    return [];
  }
}

export function loadItAccountActionRequests(): ItAccountActionRequest[] {
  if (typeof window === "undefined") return [];
  return safeParseArray(localStorage.getItem(STORAGE_KEY));
}

export function saveItAccountActionRequests(items: ItAccountActionRequest[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function createItAccountActionRequest(
  input: Omit<ItAccountActionRequest, "id" | "requestedAt" | "status">
): ItAccountActionRequest {
  const req: ItAccountActionRequest = {
    ...input,
    id: `itreq-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    requestedAt: new Date().toISOString(),
    status: "PENDING",
  };
  const all = loadItAccountActionRequests();
  saveItAccountActionRequests([req, ...all].slice(0, 200));
  return req;
}

export function markItAccountActionRequestCompleted(id: string) {
  const all = loadItAccountActionRequests();
  const next = all.map((r) => (r.id === id ? { ...r, status: "COMPLETED" as const } : r));
  saveItAccountActionRequests(next);
}

export function getPendingItAccountActionRequests(): ItAccountActionRequest[] {
  return loadItAccountActionRequests().filter((r) => r.status === "PENDING");
}

