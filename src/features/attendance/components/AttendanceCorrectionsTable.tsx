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
import type { AttendanceCorrectionRequest } from "@/features/attendance/types";

export const AttendanceCorrectionsTable = memo(function AttendanceCorrectionsTable({
  corrections,
  tablesReady,
}: {
  corrections: AttendanceCorrectionRequest[];
  tablesReady: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Submitted corrections (demo)</CardTitle>
      </CardHeader>
      <CardContent>
        {!tablesReady ? (
          <div className="rounded-md border border-border max-h-64 overflow-y-auto scrollbar-hide">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Proof</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableSkeletonRows columns={5} prefix="attendance-corr-sk" />
              </TableBody>
            </Table>
          </div>
        ) : corrections.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You have not submitted any attendance correction requests yet.
          </p>
        ) : (
          <div className="rounded-md border border-border max-h-64 overflow-y-auto scrollbar-hide">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Proof</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {corrections.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(c.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-xs">{c.type.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-sm max-w-md">
                      <span className="line-clamp-2">{c.reason}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.proofUrl ? (
                        <a
                          href={c.proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline underline-offset-2"
                        >
                          View proof
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">Pending</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
