"use client";

import { memo } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { CalendarDays, FileText, User2 } from "lucide-react";
import type { DisciplinaryCase } from "@/features/discipline/types";
import { formatDisciplinaryDateLabel } from "@/features/discipline/services/disciplinaryCases";

export const DisciplineCasesTable = memo(function DisciplineCasesTable({
  orderedRecords,
  recordsLoading,
}: {
  orderedRecords: DisciplinaryCase[];
  recordsLoading: boolean;
}) {
  return (
    <Card className="border-border/60 bg-card/80 shadow-sm rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          Disciplinary Cases
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {recordsLoading ? (
          <Table scrollable>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Case ID</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Violation</TableHead>
                <TableHead>Linked Complaint</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Date Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableSkeletonRows columns={6} prefix="discipline-sk" />
            </TableBody>
          </Table>
        ) : orderedRecords.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            No disciplinary cases have been recorded yet. When a false or serious misconduct
            complaint is confirmed, HR can choose to open a disciplinary case and it will appear
            here.
          </p>
        ) : (
          <Table scrollable>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Case ID</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Violation</TableHead>
                <TableHead>Linked Complaint</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Date Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderedRecords.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.id}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs">
                        <User2 className="h-3.5 w-3.5" />
                      </span>
                      <div className="flex flex-col">
                        <span className="text-sm text-foreground">{r.employeeName}</span>
                        {r.employeeId && (
                          <span className="text-[11px] text-muted-foreground">ID: {r.employeeId}</span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.violation}</Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/complaints/${r.complaintId}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <span>{r.complaintId}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-foreground">{r.createdBy}</TableCell>
                  <TableCell className="text-sm text-foreground">
                    <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="h-3 w-3" />
                      <span>{formatDisciplinaryDateLabel(r.createdAt)}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
});
