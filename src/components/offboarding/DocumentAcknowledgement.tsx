"use client";

import { useState } from "react";
import { CheckCircle2, FileCheck, FileText, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DocumentStatus = "Pending" | "Acknowledged";

export type AcknowledgementDocument = {
  id: string;
  title: string;
  required: boolean;
  status: DocumentStatus;
};

type DocumentAcknowledgementProps = {
  initialDocuments: AcknowledgementDocument[];
};

const statusStyles: Record<DocumentStatus, string> = {
  Pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  Acknowledged: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export function DocumentAcknowledgement({ initialDocuments }: DocumentAcknowledgementProps) {
  const [documents, setDocuments] = useState<AcknowledgementDocument[]>(initialDocuments);

  const acknowledgedCount = documents.filter((d) => d.status === "Acknowledged").length;

  function handleAcknowledge(docId: string) {
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === docId ? { ...doc, status: "Acknowledged" as DocumentStatus } : doc
      )
    );
  }

  return (
    <Card className="rounded-3xl border-border/50 shadow-sm dark:bg-[#161b30]">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2.5 text-lg font-bold">
              <FileCheck className="size-5 text-[#FFE14E]" />
              Document Acknowledgement
            </CardTitle>
            <p className="text-xs font-medium text-muted-foreground">
              Review and acknowledge the required offboarding documents below.
            </p>
          </div>
          <Badge
            variant="outline"
            className="rounded-full border-[#FFE14E]/30 bg-[#FFE14E]/10 px-3 py-1 font-bold text-[#FFE14E]"
          >
            {acknowledgedCount} / {documents.length} Acknowledged
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {documents.map((doc) => {
          const isAcknowledged = doc.status === "Acknowledged";
          return (
            <div
              key={doc.id}
              className={cn(
                "flex flex-col gap-3 rounded-2xl border p-4 transition-all sm:flex-row sm:items-center sm:justify-between",
                isAcknowledged
                  ? "border-emerald-200/50 bg-emerald-50/30 dark:border-emerald-900/20 dark:bg-emerald-950/10"
                  : "border-border/60 bg-background"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl",
                    isAcknowledged
                      ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400"
                  )}
                >
                  {isAcknowledged ? (
                    <ShieldCheck className="size-5" />
                  ) : (
                    <FileText className="size-5" />
                  )}
                </div>
                <div className="space-y-0.5">
                  <p className={cn("text-sm font-semibold", isAcknowledged && "text-muted-foreground")}>
                    {doc.title}
                  </p>
                  <div className="flex items-center gap-2">
                    {doc.required ? (
                      <Badge className="border-transparent bg-rose-500/15 px-1.5 py-0 text-[9px] font-bold uppercase text-rose-700 dark:text-rose-300">
                        Required
                      </Badge>
                    ) : (
                      <Badge className="border-transparent bg-slate-500/10 px-1.5 py-0 text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400">
                        Optional
                      </Badge>
                    )}
                    <Badge className={cn("border-transparent", statusStyles[doc.status])}>
                      {doc.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleAcknowledge(doc.id)}
                disabled={isAcknowledged}
                className={cn(
                  "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-bold transition-all",
                  isAcknowledged
                    ? "cursor-not-allowed bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                    : "bg-[#FFE14E] text-[#1B2447] shadow-sm hover:bg-[#F7D93C] active:scale-[0.98]"
                )}
              >
                {isAcknowledged ? (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    Acknowledged
                  </>
                ) : (
                  "Acknowledge"
                )}
              </button>
            </div>
          );
        })}

        {documents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
            No documents require acknowledgement at this time.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
