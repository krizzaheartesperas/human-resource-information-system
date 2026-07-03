"use client";

import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import type { DisciplinaryCase } from "@/features/discipline/types";
import { loadDisciplinaryCases } from "@/features/discipline/services/disciplinaryCases";

export function useDisciplinePage() {
  const { user } = useCurrentUser();
  const [records] = useState<DisciplinaryCase[]>(() => loadDisciplinaryCases());
  const [recordsLoading, setRecordsLoading] = useState(true);

  useEffect(() => {
    setRecordsLoading(false);
  }, []);

  const isHrRole =
    user.role === "SUPER_ADMIN" ||
    user.role === "HR_ADMIN" ||
    user.role === "HR_MANAGER" ||
    user.role === "HR_STAFF";

  const orderedRecords = useMemo(
    () =>
      [...records].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [records],
  );

  const initials = user.name
    .split(" ")
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return { user, isHrRole, orderedRecords, recordsLoading, recordsLength: records.length, initials };
}
