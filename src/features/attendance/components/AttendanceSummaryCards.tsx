"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Summary = {
  daysPresent: number;
  daysAbsent: number;
  totalLate: number;
  totalUndertime: number;
  totalOvertime: number;
};

export function AttendanceSummaryCards({ summary }: { summary: Summary }) {
  const kpiCardClass = "border border-[#26335f] bg-[#1B2447] text-slate-100";
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card className={kpiCardClass}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300">Days present</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.daysPresent}</div>
        </CardContent>
      </Card>
      <Card className={kpiCardClass}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300">Days absent</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.daysAbsent}</div>
        </CardContent>
      </Card>
      <Card className={kpiCardClass}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300">Total late</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {summary.totalLate} <span className="text-sm font-normal">mins</span>
          </div>
        </CardContent>
      </Card>
      <Card className={kpiCardClass}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300">Total overtime</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {(summary.totalOvertime / 60).toFixed(1)}{" "}
            <span className="text-sm font-normal">hrs</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
