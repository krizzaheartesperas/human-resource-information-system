"use client";

import { randomUUID } from "@/lib/utils";

export type PayrollExportRun = {
  id: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  generatedBy: string;
  generatedById: string;
  mappingVersion: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  format: "CSV" | "Excel" | "JSON";
  template: string;
  employeeCount: number;
  approvalStatus?: "Pending Approval" | "Approved" | "Rejected" | "Exported";
  approvedBy?: string;
  approvedById?: string;
  approvedAt?: string;
  approvalRemarks?: string;
  rejectionReason?: string;
  exportedAt?: string;
  createdAt: string;
  errors?: string[];
};

const STORAGE_KEY = "hris-payroll-export-runs";

export function loadExportRuns(): PayrollExportRun[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Partial<PayrollExportRun>>;
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed
      .map((r) => {
        const approvalStatus: PayrollExportRun["approvalStatus"] =
          r.approvalStatus ?? (r.status === "FAILED" ? "Rejected" : "Pending Approval");
        return {
          ...(r as PayrollExportRun),
          mappingVersion: r.mappingVersion ?? "MAP-v1.0",
          approvalStatus,
        };
      })
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
    return normalized;
  } catch {
    return [];
  }
}

export function saveExportRun(run: Omit<PayrollExportRun, "id" | "createdAt">): PayrollExportRun {
  const full: PayrollExportRun = {
    ...run,
    mappingVersion: run.mappingVersion ?? "MAP-v1.0",
    approvalStatus: run.approvalStatus ?? (run.status === "FAILED" ? "Rejected" : "Pending Approval"),
    id: `RUN-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
  };
  if (typeof window === "undefined") return full;
  try {
    const existing = loadExportRuns();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([full, ...existing]));
  } catch {
    // ignore
  }
  return full;
}

export function seedExportRunsIfEmpty(): void {
  if (typeof window === "undefined") return;
  const existing = loadExportRuns();
  if (existing.length > 0) return;
  const demo: PayrollExportRun[] = [
    {
      id: "RUN-DEMO-001",
      periodLabel: "February 2026 · 1st half (1–15)",
      periodStart: "2026-02-01",
      periodEnd: "2026-02-15",
      generatedBy: "Maria Santos",
      generatedById: "emp-1",
      mappingVersion: "MAP-v1.0",
      status: "SUCCESS",
      format: "Excel",
      template: "Default PH Payroll",
      employeeCount: 42,
      approvalStatus: "Pending Approval",
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      errors: [],
    },
  ];
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
  } catch {
    // ignore
  }
}

export function updateExportRun(runId: string, patch: Partial<PayrollExportRun>): PayrollExportRun | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = loadExportRuns();
    const idx = existing.findIndex((r) => r.id === runId);
    if (idx < 0) return null;
    const current = existing[idx];
    const next: PayrollExportRun = {
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
      mappingVersion: patch.mappingVersion ?? current.mappingVersion ?? "MAP-v1.0",
      approvalStatus:
        patch.approvalStatus ??
        current.approvalStatus ??
        (current.status === "FAILED" ? "Rejected" : "Pending Approval"),
    };
    const updated = [...existing];
    updated[idx] = next;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return next;
  } catch {
    return null;
  }
}
