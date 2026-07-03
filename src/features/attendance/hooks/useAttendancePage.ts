"use client";

import { useMemo, useState } from "react";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import {
  MOCK_ATTENDANCE_HISTORY_LEGACY,
  mergeTodayFromStorage,
  type EmployeeAttendanceDay,
} from "@/features/attendance/services/employeeAttendanceHistory";
import type {
  AttendanceCorrectionRequest,
  AttendanceCorrectionType,
} from "@/features/attendance/types";

export function useAttendancePage() {
  const { user: currentUser } = useCurrentUser();
  const isEmployee = currentUser.role === "EMPLOYEE";
  const [corrections, setCorrections] = useState<AttendanceCorrectionRequest[]>([]);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionDate, setCorrectionDate] = useState("");
  const [correctionType, setCorrectionType] =
    useState<AttendanceCorrectionType>("MISSING_CLOCK_IN");
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionProofUrl, setCorrectionProofUrl] = useState("");
  const [error, setError] = useState("");
  const [tablesReady] = useState(true);

  const history: EmployeeAttendanceDay[] = useMemo(() => {
    if (isEmployee) {
      return mergeTodayFromStorage([...MOCK_ATTENDANCE_HISTORY_LEGACY]);
    }
    return MOCK_ATTENDANCE_HISTORY_LEGACY;
  }, [isEmployee]);

  const summary = useMemo(() => {
    const daysPresent = history.filter((d) => d.status === "PRESENT").length;
    const daysAbsent = history.filter((d) => d.status === "ABSENT").length;
    const totalLate = history.reduce((sum, d) => sum + d.lateMinutes, 0);
    const totalUndertime = history.reduce((sum, d) => sum + d.undertimeMinutes, 0);
    const totalOvertime = history.reduce((sum, d) => sum + d.overtimeMinutes, 0);
    return { daysPresent, daysAbsent, totalLate, totalUndertime, totalOvertime };
  }, [history]);

  const handleSubmitCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!correctionDate) {
      setError("Please choose the date you want to correct.");
      return;
    }
    if (!correctionReason.trim()) {
      setError("Please provide a short reason for the correction.");
      return;
    }
    const req: AttendanceCorrectionRequest = {
      id: `corr-${Date.now()}`,
      date: correctionDate,
      type: correctionType,
      reason: correctionReason.trim(),
      proofUrl: correctionProofUrl.trim() || undefined,
      status: "PENDING",
    };
    setCorrections((prev) => [req, ...prev]);
    setCorrectionDate("");
    setCorrectionType("MISSING_CLOCK_IN");
    setCorrectionReason("");
    setCorrectionProofUrl("");
    setCorrectionOpen(false);
  };

  return {
    isEmployee,
    history,
    summary,
    corrections,
    tablesReady,
    correctionOpen,
    setCorrectionOpen,
    correctionDate,
    setCorrectionDate,
    correctionType,
    setCorrectionType,
    correctionReason,
    setCorrectionReason,
    correctionProofUrl,
    setCorrectionProofUrl,
    error,
    handleSubmitCorrection,
  };
}
