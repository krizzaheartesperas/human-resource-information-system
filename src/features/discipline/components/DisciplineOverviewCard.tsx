"use client";

import { Card, CardContent } from "@/components/ui/card";

export function DisciplineOverviewCard({
  userName,
  recordsCount,
  initials,
}: {
  userName: string;
  recordsCount: number;
  initials: string;
}) {
  return (
    <Card className="border-border/60 bg-card/80 shadow-sm rounded-2xl">
      <CardContent className="py-4 px-4 sm:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Overview
          </p>
          <p className="text-sm text-muted-foreground">
            Total disciplinary cases:{" "}
            <span className="font-semibold text-foreground">{recordsCount}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end text-xs text-muted-foreground">
            <span>Signed in as</span>
            <span className="font-medium text-foreground">{userName}</span>
          </div>
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
            {initials}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
