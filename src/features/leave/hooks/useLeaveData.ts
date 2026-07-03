import { useEffect } from "react";
import type { MutableRefObject } from "react";
import type { LeaveRequest } from "@/lib/mock";
import {
  fetchLeaveRequestsFromSupabase,
  isSupabaseLeaveConfigured,
  pushLeaveRequestsToSupabase,
} from "@/features/leave/services/leaveSupabaseService";
import {
  clearLeaveRequestsStorage,
  loadLeaveRequestsFromStorage,
  saveLeaveRequestsToStorage,
} from "@/features/leave/utils/leavePageHelpers";
import { migrateLeaveType } from "@/features/leave/utils/leaveFormatting";
import { ensureExampleAuditLogs, loadAuditLogs, type AuditLogEntry } from "@/features/leave/services/leaveAuditService";

type Args = {
  hasLoadedStorage: boolean;
  setHasLoadedStorage: (value: boolean) => void;
  requests: LeaveRequest[];
  setRequests: (value: LeaveRequest[] | ((prev: LeaveRequest[]) => LeaveRequest[])) => void;
  requestsRef: MutableRefObject<LeaveRequest[]>;
  supabaseLeaveReady: boolean;
  setSupabaseLeaveReady: (value: boolean) => void;
  requestLeaveOpen: boolean;
  setSupportingDocument: (value: File | null) => void;
  supportDocInputRef: MutableRefObject<HTMLInputElement | null>;
  setAuditLogs: (value: AuditLogEntry[]) => void;
};

export function useLeaveData({
  hasLoadedStorage,
  setHasLoadedStorage,
  requests,
  setRequests,
  requestsRef,
  supabaseLeaveReady,
  setSupabaseLeaveReady,
  requestLeaveOpen,
  setSupportingDocument,
  supportDocInputRef,
  setAuditLogs,
}: Args) {
  useEffect(() => {
    if (!isSupabaseLeaveConfigured()) {
      const stored = loadLeaveRequestsFromStorage();
      if (stored.length > 0) {
        setRequests(stored.map((r) => ({ ...r, type: migrateLeaveType(r.type as string) })));
      }
    }
    setHasLoadedStorage(true);
  }, [setHasLoadedStorage, setRequests]);

  useEffect(() => {
    if (!hasLoadedStorage || !isSupabaseLeaveConfigured()) return;
    let cancelled = false;
    setSupabaseLeaveReady(false);
    (async () => {
      const { data, error } = await fetchLeaveRequestsFromSupabase();
      if (cancelled) return;
      if (error) {
        console.warn("[leave] Supabase load failed — using local/mock data:", error.message);
        if (!cancelled) setSupabaseLeaveReady(true);
        return;
      }
      if (data.length > 0) {
        setRequests(data);
      } else {
        const snapshot = requestsRef.current;
        const { error: pushError } = await pushLeaveRequestsToSupabase(snapshot);
        if (cancelled) return;
        if (pushError) {
          console.warn(
            "[leave] Supabase seed (optional):",
            pushError.message,
            "— new requests can still sync if your employee_code matches mock (e.g. E001).",
          );
        }
      }
      if (cancelled) return;
      clearLeaveRequestsStorage();
      setSupabaseLeaveReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [hasLoadedStorage, requestsRef, setRequests, setSupabaseLeaveReady]);

  useEffect(() => {
    if (!hasLoadedStorage) return;
    if (isSupabaseLeaveConfigured()) return;
    saveLeaveRequestsToStorage(requests);
  }, [requests, hasLoadedStorage]);

  useEffect(() => {
    if (!hasLoadedStorage || !supabaseLeaveReady || !isSupabaseLeaveConfigured()) return;
    const t = window.setTimeout(() => {
      void pushLeaveRequestsToSupabase(requests).then(({ error, skipped }) => {
        if (error) console.warn("[leave] Supabase sync:", error.message);
        else if (skipped > 0) console.warn("[leave] Supabase sync skipped", skipped, "row(s) (missing employee mapping)");
      });
    }, 650);
    return () => window.clearTimeout(t);
  }, [requests, hasLoadedStorage, supabaseLeaveReady]);

  useEffect(() => {
    if (!requestLeaveOpen) return;
    setSupportingDocument(null);
    if (supportDocInputRef.current) supportDocInputRef.current.value = "";
  }, [requestLeaveOpen, setSupportingDocument, supportDocInputRef]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    ensureExampleAuditLogs();
    setAuditLogs(loadAuditLogs());
  }, [setAuditLogs]);
}
