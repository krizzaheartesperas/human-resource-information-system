"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type TaskStatus = "Pending" | "In Progress" | "Completed";

export type OffboardingTask = {
  id: string;
  title: string;
  dueDate: string;
  status: TaskStatus;
  completed: boolean;
};

type MyTasksProps = {
  initialTasks: OffboardingTask[];
  title?: string;
};

const taskStatusStyles: Record<TaskStatus, string> = {
  Pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "In Progress": "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  Completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export function MyTasks({ initialTasks, title = "My Tasks" }: MyTasksProps) {
  const [tasks, setTasks] = useState<OffboardingTask[]>(initialTasks);

  const completedCount = useMemo(
    () => tasks.filter((task) => task.completed || task.status === "Completed").length,
    [tasks]
  );

  function handleMarkComplete(taskId: string) {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? { ...task, completed: true, status: "Completed" as TaskStatus }
          : task
      )
    );
  }

  return (
    <Card className="rounded-3xl border-border/50 shadow-sm dark:bg-[#161b30]">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold">{title}</CardTitle>
            <p className="text-xs font-medium text-muted-foreground">
              These are your personal responsibilities. Complete each item before your separation date.
            </p>
          </div>
          <Badge
            variant="outline"
            className="rounded-full border-[#FFE14E]/30 bg-[#FFE14E]/10 px-3 py-1 font-bold text-[#FFE14E]"
          >
            {completedCount} / {tasks.length} Done
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.map((task) => {
          const isCompleted = task.completed || task.status === "Completed";
          return (
            <button
              key={task.id}
              type="button"
              onClick={() => !isCompleted && handleMarkComplete(task.id)}
              disabled={isCompleted}
              className={cn(
                "group flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all",
                isCompleted
                  ? "border-emerald-200/50 bg-emerald-50/30 dark:border-emerald-900/20 dark:bg-emerald-950/10"
                  : "border-border/60 bg-background hover:border-[#FFE14E]/40 hover:bg-[#FFE14E]/5 dark:hover:bg-[#FFE14E]/5"
              )}
            >
              <div className="flex items-center gap-3">
                {/* Checkbox-style indicator */}
                <div
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-lg border-2 transition-colors",
                    isCompleted
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-300 group-hover:border-[#FFE14E] dark:border-white/20"
                  )}
                >
                  {isCompleted ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3 text-transparent" />}
                </div>

                <div className="space-y-0.5">
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      isCompleted && "text-muted-foreground line-through"
                    )}
                  >
                    {task.title}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
                    Due: {task.dueDate}
                  </p>
                </div>
              </div>

              <Badge className={cn("shrink-0 border-transparent", taskStatusStyles[task.status])}>
                {task.status}
              </Badge>
            </button>
          );
        })}

        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
            No tasks assigned to you at this time.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
