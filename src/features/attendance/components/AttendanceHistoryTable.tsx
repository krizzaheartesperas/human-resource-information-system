"use client";

import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeletonRows } from "@/components/ui/table-skeleton";
import { Badge } from "@/components/ui/badge";
import type { EmployeeAttendanceDay } from "@/features/attendance/services/employeeAttendanceHistory";

export const AttendanceHistoryTable = memo(function AttendanceHistoryTable({
  history,
  tablesReady,
}: {
  history: EmployeeAttendanceDay[];
  tablesReady: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Attendance history (demo)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-border max-h-[60vh] overflow-y-auto scrollbar-hide">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Clock in</TableHead>
                <TableHead>Clock out</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Late (min)</TableHead>
                <TableHead>Undertime (min)</TableHead>
                <TableHead>Overtime (min)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!tablesReady ? (
                <TableSkeletonRows columns={7} prefix="attendance-history-sk" />
              ) : (
                history.map((day) => (
                  <TableRow key={day.date}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(day.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{day.clockIn ?? "—"}</TableCell>
                    <TableCell>{day.clockOut ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={day.status === "PRESENT" ? "success" : "secondary"}>
                        {day.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{day.lateMinutes || "—"}</TableCell>
                    <TableCell>{day.undertimeMinutes || "—"}</TableCell>
                    <TableCell>{day.overtimeMinutes || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
});
