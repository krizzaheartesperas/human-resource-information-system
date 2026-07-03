import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Briefcase, Calendar, Hash, ShieldCheck, User } from "lucide-react";

export type OffboardingStatus =
  | "Scheduled"
  | "In Progress"
  | "Awaiting Final Approval"
  | "Completed"
  | "Inactive";

export type EmploymentStatus = "Active" | "On Notice" | "Separated" | "Inactive";

type OffboardingOverviewProps = {
  employeeName: string;
  employeeId: string;
  position: string;
  department: string;
  exitType: string;
  effectiveSeparationDate: string;
  employmentStatus: EmploymentStatus;
  offboardingStatus: OffboardingStatus;
  progress: number;
};

const offboardingStatusStyles: Record<OffboardingStatus, string> = {
  Scheduled: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "In Progress": "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "Awaiting Final Approval": "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  Completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  Inactive: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
};

const employmentStatusStyles: Record<EmploymentStatus, string> = {
  Active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "On Notice": "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  Separated: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  Inactive: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
};

const offboardingStatusDot: Record<OffboardingStatus, string> = {
  Scheduled: "bg-sky-500",
  "In Progress": "bg-blue-500",
  "Awaiting Final Approval": "bg-amber-500 animate-pulse",
  Completed: "bg-emerald-500",
  Inactive: "bg-slate-400",
};

export function OffboardingOverview({
  employeeName,
  employeeId,
  position,
  department,
  exitType,
  effectiveSeparationDate,
  employmentStatus,
  offboardingStatus,
  progress,
}: OffboardingOverviewProps) {
  return (
    <Card className="relative overflow-hidden rounded-3xl border-none bg-[#1B2447] text-white shadow-xl">
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-[#FFE14E]/8 blur-3xl" />
      <div className="pointer-events-none absolute -left-10 bottom-0 size-40 rounded-full bg-blue-500/5 blur-3xl" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2.5 text-xl font-black text-white">
            <div className="flex size-8 items-center justify-center rounded-xl bg-[#FFE14E]/15">
              <User className="size-4 text-[#FFE14E]" />
            </div>
            Offboarding Overview
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className={cn("size-2 rounded-full", offboardingStatusDot[offboardingStatus])} />
            <Badge className={cn("border-transparent font-bold", offboardingStatusStyles[offboardingStatus])}>
              {offboardingStatus}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <Separator className="bg-white/10" />

        {/* Employee details grid */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm sm:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <User className="size-3" />
              Employee Name
            </dt>
            <dd className="text-base font-bold">{employeeName}</dd>
          </div>

          <div className="flex flex-col gap-1.5">
            <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <Hash className="size-3" />
              Employee ID
            </dt>
            <dd className="font-semibold text-slate-200">{employeeId}</dd>
          </div>

          <div className="flex flex-col gap-1.5">
            <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <Briefcase className="size-3" />
              Position / Department
            </dt>
            <dd className="font-semibold text-slate-200">
              {position}
              <span className="mx-1 text-slate-500">·</span>
              <span className="text-slate-300">{department}</span>
            </dd>
          </div>

          <div className="flex flex-col gap-1.5">
            <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <ShieldCheck className="size-3" />
              Exit Type
            </dt>
            <dd className="font-semibold text-slate-200">{exitType}</dd>
          </div>

          <div className="flex flex-col gap-1.5">
            <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <Calendar className="size-3" />
              Effective Separation Date
            </dt>
            <dd className="font-bold text-[#FFE14E]">{effectiveSeparationDate}</dd>
          </div>

          <div className="flex flex-col gap-1.5">
            <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Employment Status
            </dt>
            <dd>
              <Badge className={cn("border-transparent font-bold", employmentStatusStyles[employmentStatus])}>
                {employmentStatus}
              </Badge>
            </dd>
          </div>

          <div className="col-span-2 flex flex-col gap-1.5">
            <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Overall Progress
            </dt>
            <dd className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-[#FFE14E]">{progress}%</span>
                <span className="text-xs font-semibold text-slate-400">
                  {progress < 100 ? "In progress" : "Complete"}
                </span>
              </div>
              <Progress
                value={progress}
                className="h-2 bg-white/10"
                indicatorClassName="bg-[#FFE14E]"
              />
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
