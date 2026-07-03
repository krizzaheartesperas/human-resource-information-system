export type AttendanceFeature = Record<string, never>;

export type AttendanceCorrectionType =
  | "MISSING_CLOCK_IN"
  | "MISSING_CLOCK_OUT"
  | "WRONG_TIME"
  | "OTHER";

export type AttendanceCorrectionRequest = {
  id: string;
  date: string;
  type: AttendanceCorrectionType;
  reason: string;
  proofUrl?: string;
  status: "PENDING";
};
