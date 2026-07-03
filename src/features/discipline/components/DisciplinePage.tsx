"use client";

import { useDisciplinePage } from "@/features/discipline/hooks/useDisciplinePage";
import { DisciplineAccessDenied } from "@/features/discipline/components/DisciplineAccessDenied";
import { DisciplineCasesTable } from "@/features/discipline/components/DisciplineCasesTable";
import { DisciplineOverviewCard } from "@/features/discipline/components/DisciplineOverviewCard";
import { DisciplinePageTopBar } from "@/features/discipline/components/DisciplinePageTopBar";

export default function DisciplinaryRecordsPage() {
  const { user, isHrRole, orderedRecords, recordsLoading, recordsLength, initials } =
    useDisciplinePage();

  if (!isHrRole) {
    return <DisciplineAccessDenied />;
  }

  return (
    <div className="space-y-6 -mt-2">
      <DisciplinePageTopBar />
      <DisciplineOverviewCard
        userName={user.name}
        recordsCount={recordsLength}
        initials={initials}
      />
      <DisciplineCasesTable orderedRecords={orderedRecords} recordsLoading={recordsLoading} />
    </div>
  );
}
