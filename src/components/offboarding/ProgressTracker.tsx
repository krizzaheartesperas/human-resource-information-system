import { CheckCircle2, CircleDot, Circle, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StepStatus =
  | "Completed"
  | "In Progress"
  | "Pending"
  | "Blocked";

export type OffboardingStep = {
  id: string;
  title: string;
  responsible: string;
  status: StepStatus;
  timestamp?: string;
};

type ProgressTrackerProps = {
  steps: OffboardingStep[];
};

const stepStatusStyles: Record<StepStatus, string> = {
  Completed: "text-emerald-600 dark:text-emerald-400",
  "In Progress": "text-blue-600 dark:text-blue-400",
  Pending: "text-slate-400 dark:text-slate-500",
  Blocked: "text-red-600 dark:text-red-400",
};

const stepBadgeStyles: Record<StepStatus, string> = {
  Completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "In Progress": "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  Pending: "bg-slate-500/10 text-slate-500 dark:text-slate-400",
};

function StepStatusIcon({ status }: { status: StepStatus }) {
  if (status === "Completed") return <CheckCircle2 className="size-5" />;
  if (status === "In Progress") return <CircleDot className="size-5 animate-pulse" />;
  return <Circle className="size-5" />;
}

export function ProgressTracker({ steps }: ProgressTrackerProps) {
  const completedCount = steps.filter((s) => s.status === "Completed").length;

  return (
    <Card className="rounded-3xl border-border/50 shadow-sm dark:bg-[#161b30]">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2.5 text-lg font-bold">
            Progress Tracker
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:bg-white/10">
              <Eye className="size-3" />
              Read-Only
            </div>
            <Badge
              variant="outline"
              className="rounded-full border-[#FFE14E]/30 bg-[#FFE14E]/10 px-3 py-1 font-bold text-[#FFE14E]"
            >
              {completedCount} / {steps.length} Steps
            </Badge>
          </div>
        </div>
        <p className="mt-1 text-xs font-medium text-muted-foreground">
          All clearance steps are visible, accountable, and auditable. You cannot modify these steps directly.
        </p>
      </CardHeader>

      <CardContent>
        <ol className="space-y-1">
          {steps.map((step, index) => (
            <li
              key={step.id}
              className={cn(
                "relative flex gap-4 rounded-xl px-3 py-3 transition-colors",
                step.status === "In Progress" && "bg-blue-500/5 dark:bg-blue-500/10"
              )}
            >
              {/* Vertical connector line */}
              {index < steps.length - 1 ? (
                <span
                  className={cn(
                    "absolute left-[23px] top-[42px] h-[calc(100%-18px)] w-px",
                    step.status === "Completed"
                      ? "bg-emerald-300 dark:bg-emerald-700"
                      : "bg-border dark:bg-white/10"
                  )}
                  aria-hidden
                />
              ) : null}

              {/* Step icon */}
              <span className={cn("z-10 mt-0.5 shrink-0", stepStatusStyles[step.status])}>
                <StepStatusIcon status={step.status} />
              </span>

              {/* Step content */}
              <div className="flex flex-1 flex-col gap-1 pb-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pb-0">
                <div className="space-y-0.5">
                  <p className={cn("text-sm font-semibold", step.status === "Pending" && "text-muted-foreground")}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Responsible: <span className="font-medium">{step.responsible}</span>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {step.timestamp ? (
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {step.timestamp}
                    </span>
                  ) : null}
                  <Badge className={cn("shrink-0 border-transparent text-[10px]", stepBadgeStyles[step.status])}>
                    {step.status}
                  </Badge>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
