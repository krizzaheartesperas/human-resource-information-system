import { leaveTypeMetadata, type TimeOffType } from "@/lib/mock";

export function getLeaveTypeOptions(): { value: TimeOffType; label: string }[] {
  return (Object.entries(leaveTypeMetadata) as [TimeOffType, (typeof leaveTypeMetadata)[TimeOffType]][])
    .map(([value, meta]) => ({ value, label: meta.label }));
}
