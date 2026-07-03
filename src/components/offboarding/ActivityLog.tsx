import {
  CheckCircle2,
  Clock,
  DollarSign,
  Laptop,
  LogIn,
  Shield,
  User,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ActivityLogItem = {
  id: string;
  message: string;
  timestamp: string;
  actor?: string;
  type?: "hr" | "it" | "finance" | "employee" | "system" | "admin";
};

type ActivityLogProps = {
  entries: ActivityLogItem[];
};

const actorIcons: Record<string, React.ReactNode> = {
  hr: <Shield className="size-3.5" />,
  it: <Laptop className="size-3.5" />,
  finance: <DollarSign className="size-3.5" />,
  employee: <User className="size-3.5" />,
  system: <Zap className="size-3.5" />,
  admin: <LogIn className="size-3.5" />,
};

const actorColors: Record<string, string> = {
  hr: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  it: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  finance: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  employee: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  system: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400",
  admin: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
};

export function ActivityLog({ entries }: ActivityLogProps) {
  return (
    <Card className="rounded-3xl border-border/50 shadow-sm dark:bg-[#161b30]">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2.5 text-lg font-bold">
            <Clock className="size-5 text-[#FFE14E]" />
            Activity Log
          </CardTitle>
          <p className="text-xs font-medium text-muted-foreground">
            Audit trail of all offboarding actions. Every step is recorded for accountability.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-1 before:absolute before:left-[15px] before:top-3 before:h-[calc(100%-24px)] before:w-px before:bg-border dark:before:bg-white/10">
          {entries.map((entry) => {
            const actorType = entry.type ?? "system";
            return (
              <div
                key={entry.id}
                className="group relative flex items-start gap-4 rounded-xl px-2 py-3 transition-colors hover:bg-slate-50/50 dark:hover:bg-white/5"
              >
                {/* Timeline node */}
                <div
                  className={cn(
                    "z-10 flex size-8 shrink-0 items-center justify-center rounded-lg",
                    actorColors[actorType]
                  )}
                >
                  {actorIcons[actorType] ?? <CheckCircle2 className="size-3.5" />}
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-foreground">{entry.message}</p>
                    {entry.actor ? (
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        By: {entry.actor}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                    {entry.timestamp}
                  </span>
                </div>
              </div>
            );
          })}

          {entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
              No activity recorded yet.
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
