import type { TimeOffType } from "@/lib/mock";

export function getLeaveTypeColorClasses(_type: TimeOffType): string {
  return "bg-amber-50 text-amber-900 border-amber-200";
}
