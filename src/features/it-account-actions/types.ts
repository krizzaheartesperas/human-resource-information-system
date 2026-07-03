import type { Role } from "@/lib/mock";

export type ItAccountAction = "DISABLE_ACCESS" | "DELETE_ACCOUNT";
export type ItAccountActionStatus = "PENDING" | "COMPLETED" | "CANCELLED";

export type ItAccountActionRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail?: string;
  employeeNumber?: string;
  departmentId?: string;
  action: ItAccountAction;
  reason: string;
  requestedAt: string; // ISO timestamp
  requestedByName: string;
  requestedByRole: Role;
  status: ItAccountActionStatus;
};

