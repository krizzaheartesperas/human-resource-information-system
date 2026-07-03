"use server";

import { loadActorFromAccessToken } from "@/actions/attendance/actorFromToken";
import { canApproveByMatrix } from "@/lib/attendance/approverMatrix";

export type CorrectionApprovalResult = { ok: true } | { ok: false; error: string };

export async function approveCorrection(
  accessToken: string,
  input: {
    requestId: string;
    status: "APPROVED" | "REJECTED";
    remarks?: string | null;
  }
): Promise<CorrectionApprovalResult> {
  const { supabase, actor, error } = await loadActorFromAccessToken(accessToken);
  if (error || !actor?.id) {
    return { ok: false, error: error ?? "Unauthorized" };
  }

  const { data: row, error: fetchErr } = await supabase
    .from("attendance_correction_requests")
    .select("id, employee_id, status")
    .eq("id", input.requestId)
    .maybeSingle();

  if (fetchErr) {
    return { ok: false, error: fetchErr.message };
  }
  if (!row) {
    return { ok: false, error: "Request not found." };
  }
  if (row.status !== "PENDING") {
    return { ok: false, error: "This request is no longer pending." };
  }
  if (row.employee_id === actor.id) {
    return { ok: false, error: "You cannot approve or reject your own correction request." };
  }

  const [{ data: requester, error: reqErr }, { data: actorRow, error: actorErr }] = await Promise.all([
    supabase
      .from("employees")
      .select("employee_number, employee_code")
      .eq("id", row.employee_id)
      .maybeSingle(),
    supabase
      .from("employees")
      .select("employee_number, employee_code")
      .eq("id", actor.id)
      .maybeSingle(),
  ]);

  if (reqErr) return { ok: false, error: reqErr.message };
  if (actorErr) return { ok: false, error: actorErr.message };

  const allowedApprover = canApproveByMatrix({
    requesterEmployeeNumber: requester?.employee_number ?? requester?.employee_code,
    actorEmployeeNumber: actorRow?.employee_number ?? actorRow?.employee_code,
    requestType: "attendanceIssue",
  });

  if (!allowedApprover) {
    return { ok: false, error: "You are not the assigned approver for this attendance issue." };
  }

  const remarks =
    typeof input.remarks === "string" && input.remarks.trim() !== "" ? input.remarks.trim() : null;

  const { error: upErr } = await supabase
    .from("attendance_correction_requests")
    .update({
      status: input.status,
      approved_by: actor.id,
      approved_at: new Date().toISOString(),
      remarks,
    })
    .eq("id", input.requestId)
    .eq("status", "PENDING");

  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  return { ok: true };
}
