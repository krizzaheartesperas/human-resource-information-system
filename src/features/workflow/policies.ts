import type { RequestType, Role, WorkflowRequest } from "@/lib/mock";

export type WorkflowStage =
  | "DEPARTMENT_MANAGER"
  | "HR_MANAGER"
  | "HR_STAFF"
  | "HR_ADMIN"
  | "CURRENT_MANAGER"
  | "TARGET_MANAGER"
  | "NEW_MANAGER"
  | "EXECUTIVE";

type WorkflowPolicy = {
  submitterRoles: Role[];
  selfOnlyForEmployee?: boolean;
  chain: WorkflowStage[];
};

const GENERAL_SUBMITTERS: Role[] = [
  "EMPLOYEE",
  "DEPARTMENT_MANAGER",
  "HR_STAFF",
  "HR_ADMIN",
  "HR_MANAGER",
];

export const WORKFLOW_POLICIES: Record<RequestType, WorkflowPolicy> = {
  PROMOTION: {
    submitterRoles: GENERAL_SUBMITTERS,
    selfOnlyForEmployee: true,
    chain: ["DEPARTMENT_MANAGER", "HR_MANAGER", "HR_ADMIN"],
  },
  TRANSFER: {
    submitterRoles: GENERAL_SUBMITTERS,
    selfOnlyForEmployee: true,
    chain: ["DEPARTMENT_MANAGER", "HR_STAFF", "HR_ADMIN"],
  },
  ROLE_CHANGE: {
    submitterRoles: ["DEPARTMENT_MANAGER", "HR_STAFF", "HR_ADMIN", "HR_MANAGER"],
    selfOnlyForEmployee: true,
    chain: ["DEPARTMENT_MANAGER", "HR_MANAGER", "HR_ADMIN"],
  },
  DEPARTMENT_CHANGE: {
    submitterRoles: ["DEPARTMENT_MANAGER"],
    chain: ["CURRENT_MANAGER", "TARGET_MANAGER", "HR_ADMIN"],
  },
  SALARY_CHANGE: {
    submitterRoles: GENERAL_SUBMITTERS,
    selfOnlyForEmployee: true,
    chain: ["DEPARTMENT_MANAGER", "HR_MANAGER", "HR_ADMIN"],
  },
  MANAGER_CHANGE: {
    submitterRoles: ["DEPARTMENT_MANAGER", "HR_STAFF", "HR_ADMIN", "HR_MANAGER"],
    chain: ["CURRENT_MANAGER", "NEW_MANAGER", "HR_ADMIN"],
  },
  PERSONAL_INFO_CHANGE: {
    submitterRoles: ["EMPLOYEE"],
    selfOnlyForEmployee: true,
    chain: ["HR_STAFF", "HR_ADMIN", "EXECUTIVE"],
  },
};

const STAGE_ROLES: Record<WorkflowStage, Role[]> = {
  DEPARTMENT_MANAGER: ["DEPARTMENT_MANAGER"],
  HR_MANAGER: ["HR_MANAGER"],
  HR_STAFF: ["HR_STAFF"],
  HR_ADMIN: ["HR_ADMIN"],
  CURRENT_MANAGER: ["MANAGER", "DEPARTMENT_MANAGER"],
  TARGET_MANAGER: ["MANAGER", "DEPARTMENT_MANAGER"],
  NEW_MANAGER: ["MANAGER", "DEPARTMENT_MANAGER"],
  EXECUTIVE: ["EXECUTIVE"],
};

export function canRoleSubmitRequestType(role: Role, type: RequestType): boolean {
  if (role === "AUDITOR" || role === "EXECUTIVE" || role === "SUPER_ADMIN") return false;
  return WORKFLOW_POLICIES[type].submitterRoles.includes(role);
}

export function getAllowedRequestTypesForRole(role: Role): RequestType[] {
  return (Object.keys(WORKFLOW_POLICIES) as RequestType[]).filter((type) =>
    canRoleSubmitRequestType(role, type)
  );
}

export function getInitialStageForType(type: RequestType): WorkflowStage {
  return WORKFLOW_POLICIES[type].chain[0];
}

export function canSubmitForApproval(request: WorkflowRequest, actorRole: Role): boolean {
  return canRoleSubmitRequestType(actorRole, request.type) && request.status === "CREATED";
}

export function canCreateWorkflowRequest(input: {
  actorRole: Role;
  actorEmployeeId: string;
  targetEmployeeId?: string;
  type: RequestType;
}): { allowed: boolean; reason?: string } {
  const { actorRole, actorEmployeeId, targetEmployeeId, type } = input;
  if (!canRoleSubmitRequestType(actorRole, type)) {
    return { allowed: false, reason: "You are not allowed to submit this request type." };
  }
  if (type === "PERSONAL_INFO_CHANGE" && actorRole !== "EMPLOYEE") {
    return { allowed: false, reason: "Personal info change can only be submitted by employee." };
  }
  if (actorRole === "EMPLOYEE" && targetEmployeeId && targetEmployeeId !== actorEmployeeId) {
    return { allowed: false, reason: "Employees can only submit requests for themselves." };
  }
  return { allowed: true };
}

export function canRoleActOnStage(role: Role, stage: WorkflowStage): boolean {
  return STAGE_ROLES[stage].includes(role);
}

export function getNextStage(type: RequestType, currentStage: WorkflowStage): WorkflowStage | null {
  const chain = WORKFLOW_POLICIES[type].chain;
  const idx = chain.indexOf(currentStage);
  if (idx < 0 || idx >= chain.length - 1) return null;
  return chain[idx + 1];
}

export function canApproveRequestAtCurrentStage(
  role: Role,
  request: WorkflowRequest,
): { allowed: boolean; reason?: string } {
  if (role === "EMPLOYEE") return { allowed: false, reason: "Employees cannot approve requests." };
  const stage = (request.reviewStage as WorkflowStage | undefined) ?? getInitialStageForType(request.type);
  if (!canRoleActOnStage(role, stage)) {
    return { allowed: false, reason: "This request is not assigned to your role at the current stage." };
  }
  return { allowed: true };
}
