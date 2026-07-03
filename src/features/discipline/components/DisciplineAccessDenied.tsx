"use client";

import { Card, CardContent } from "@/components/ui/card";

export function DisciplineAccessDenied() {
  return (
    <div className="space-y-4 -mt-2">
      <h1 className="mt-[10px] text-3xl font-semibold tracking-tight text-foreground">
        Disciplinary Records
      </h1>
      <Card>
        <CardContent className="py-8">
          <p className="text-sm text-muted-foreground">
            This section is restricted to HR staff and managers.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
