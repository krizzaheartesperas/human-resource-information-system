export type RequestType = "overtime" | "attendanceIssue";

type Matrix = Record<string, { overtime: string[]; attendanceIssue: string[] }>;

// Requester -> allowed approver employee numbers.
const APPROVER_MATRIX: Matrix = {
  "EMP-0002": { overtime: ["EMP-0003"], attendanceIssue: ["EMP-0005"] }, // Glean
  "EMP-0003": { overtime: ["EMP-0006"], attendanceIssue: ["EMP-0005"] }, // Jon
  "EMP-0004": { overtime: ["EMP-0006"], attendanceIssue: ["EMP-0005"] }, // Clinton
  "EMP-0005": { overtime: ["EMP-0006"], attendanceIssue: ["EMP-0006"] }, // Kath
  "EMP-0006": { overtime: ["EMP-0008"], attendanceIssue: ["EMP-0004"] }, // Randy
  "EMP-0007": { overtime: ["EMP-0006"], attendanceIssue: ["EMP-0005"] }, // Francis
  "EMP-0008": { overtime: ["EMP-0006", "EMP-0004"], attendanceIssue: ["EMP-0004"] }, // Lani
  "EMP-0009": { overtime: ["EMP-0006"], attendanceIssue: ["EMP-0005"] }, // Anthony
};

export function canApproveByMatrix(params: {
  requesterEmployeeNumber: string | null | undefined;
  actorEmployeeNumber: string | null | undefined;
  requestType: RequestType;
}): boolean {
  const requester = (params.requesterEmployeeNumber ?? "").trim().toUpperCase();
  const actor = (params.actorEmployeeNumber ?? "").trim().toUpperCase();
  if (!requester || !actor) return false;
  const rules = APPROVER_MATRIX[requester];
  if (!rules) return false;
  return rules[params.requestType].includes(actor);
}
