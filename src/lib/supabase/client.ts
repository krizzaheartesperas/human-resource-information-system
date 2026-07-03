import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase URL or anon key missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
  );
}

/** Browser/client Supabase client. Use in client components and API routes. */
export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** Type helper: use for typed table access, e.g. supabase.from('employees').select().returns<EmployeeRow[]>() */
export type Database = {
  public: {
    Tables: {
      departments: { Row: DepartmentRow; Insert: DepartmentInsert; Update: DepartmentUpdate };
      employees: { Row: EmployeeRow; Insert: EmployeeInsert; Update: EmployeeUpdate };
      profiles: { Row: ProfileRow; Insert: ProfileInsert; Update: ProfileUpdate };
      job_history: { Row: JobHistoryRow; Insert: JobHistoryInsert; Update: JobHistoryUpdate };
      leave_requests: { Row: LeaveRequestRow; Insert: LeaveRequestInsert; Update: LeaveRequestUpdate };
      leave_balances: { Row: LeaveBalanceRow; Insert: LeaveBalanceInsert; Update: LeaveBalanceUpdate };
      workflow_requests: { Row: WorkflowRequestRow; Insert: WorkflowRequestInsert; Update: WorkflowRequestUpdate };
      personal_info_changes: { Row: PersonalInfoChangeRow; Insert: PersonalInfoChangeInsert; Update: PersonalInfoChangeUpdate };
      promotion_requests: { Row: PromotionRequestRow; Insert: PromotionRequestInsert; Update: PromotionRequestUpdate };
      role_change_request: { Row: RoleChangeRequestRow; Insert: RoleChangeRequestInsert; Update: RoleChangeRequestUpdate };
      salary_change_requests: { Row: SalaryChangeRequestRow; Insert: SalaryChangeRequestInsert; Update: SalaryChangeRequestUpdate };
      transfer_requests: { Row: TransferRequestRow; Insert: TransferRequestInsert; Update: TransferRequestUpdate };
      department_change_requests: { Row: DepartmentChangeRequestRow; Insert: DepartmentChangeRequestInsert; Update: DepartmentChangeRequestUpdate };
      workflow_logs: { Row: WorkflowLogRow; Insert: WorkflowLogInsert; Update: WorkflowLogUpdate };
      request_attachments: { Row: RequestAttachmentRow; Insert: RequestAttachmentInsert; Update: RequestAttachmentUpdate };
      employee_salary: { Row: EmployeeSalaryRow; Insert: EmployeeSalaryInsert; Update: EmployeeSalaryUpdate };
      attendance: { Row: AttendanceRow; Insert: AttendanceInsert; Update: AttendanceUpdate };
      attendance_correction_requests: {
        Row: AttendanceCorrectionRequestRow;
        Insert: AttendanceCorrectionRequestInsert;
        Update: AttendanceCorrectionRequestUpdate;
      };
      overtime_requests: { Row: OvertimeRequestRow; Insert: OvertimeRequestInsert; Update: OvertimeRequestUpdate };
      audit_logs: { Row: AuditLogRow; Insert: AuditLogInsert; Update: AuditLogUpdate };
      sso_handoff_tickets: {
        Row: SsoHandoffTicketRow;
        Insert: SsoHandoffTicketInsert;
        Update: SsoHandoffTicketUpdate;
      };
      sso_handoff_audit: {
        Row: SsoHandoffAuditRow;
        Insert: SsoHandoffAuditInsert;
        Update: never;
      };
    };
  };
};

export type SsoHandoffTicketRow = {
  id: string;
  secret_hash: string;
  user_id: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
};

export type SsoHandoffTicketInsert = {
  id?: string;
  secret_hash: string;
  user_id: string;
  expires_at: string;
  used_at?: string | null;
  created_at?: string;
  metadata?: Record<string, unknown>;
};

export type SsoHandoffTicketUpdate = Partial<
  Omit<SsoHandoffTicketRow, "id" | "secret_hash" | "user_id" | "created_at">
>;

export type SsoHandoffAuditRow = {
  id: number;
  event: string;
  ticket_id: string | null;
  user_id: string | null;
  ip: string | null;
  user_agent: string | null;
  detail: Record<string, unknown>;
  created_at: string;
};

export type SsoHandoffAuditInsert = {
  id?: number;
  event: string;
  ticket_id?: string | null;
  user_id?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  detail?: Record<string, unknown>;
  created_at?: string;
};

export type DepartmentRow = {
  id: string;
  name: string;
  code: string;
  parent_id: string | null;
  manager_id: string | null;
  created_at: string;
  updated_at: string;
};

export type DepartmentInsert = Omit<DepartmentRow, "created_at" | "updated_at"> & {
  created_at?: string;
  updated_at?: string;
};

export type DepartmentUpdate = Partial<Omit<DepartmentRow, "id">>;

/**
 * public.employees row — supports HRIS-style columns and teammate schemas
 * (e.g. employee_code, position, user_id). Leave sync uses employee_number ?? employee_code.
 */
export type EmployeeRow = {
  id: string;
  department_id: string;
  created_at?: string;
  updated_at?: string;
  employment_status?: string | null;
  /** HRIS / seed */
  employee_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  /** Some schemas use a single full-name column */
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  job_title?: string | null;
  manager_id?: string | null;
  start_date?: string | null;
  role?: string | null;
  employment_type?: string | null;
  birthday?: string | null;
  current_address?: string | null;
  personal_phone?: string | null;
  profile_photo?: string | null;
  auth_user_id?: string | null;
  /** Alternate teammate columns */
  user_id?: string | null;
  employee_code?: string | null;
  position?: string | null;
  portal_role?: string | null;
  account_status?: string | null;
  /** Masked PAN only, e.g. **** **** **** 3210 */
  card_number?: string | null;
  card_holder_name?: string | null;
  payout_preference?: string | null;
};

export type EmployeeInsert = Omit<EmployeeRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type EmployeeUpdate = Partial<Omit<EmployeeRow, "id">>;

export type ProfileRow = {
  id: string | number;
  user_id?: string | number | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  birthday?: string | null;
  current_address?: string | null;
  currentAddress?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ProfileInsert = Omit<ProfileRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type ProfileUpdate = Partial<Omit<ProfileRow, "id">>;

export type JobHistoryRow = {
  id: string;
  employee_id: string;
  job_title: string;
  department_id: string;
  department_name: string;
  manager_id: string | null;
  start_date: string;
  end_date: string | null;
  created_at: string;
};

export type JobHistoryInsert = Omit<JobHistoryRow, "id" | "created_at"> & { id?: string; created_at?: string };
export type JobHistoryUpdate = Partial<Omit<JobHistoryRow, "id">>;

/** DB row; type/status are unconstrained text in Postgres after alignment migration. */
export type LeaveRequestRow = {
  id: string;
  employee_id: string;
  type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
  metadata: Record<string, unknown>;
};

export type LeaveRequestInsert = Omit<LeaveRequestRow, "created_at"> & { created_at?: string };
export type LeaveRequestUpdate = Partial<Omit<LeaveRequestRow, "id">>;

export type LeaveBalanceRow = {
  id: string;
  employee_id: string;
  type: "VACATION_LEAVE" | "SICK_LEAVE" | "EMERGENCY_LEAVE" | "BEREAVEMENT_LEAVE" | "MATERNITY_LEAVE" | "PATERNITY_LEAVE" | "SOLO_PARENT_LEAVE" | "UNPAID_LEAVE";
  year: number;
  total_days: number;
  used_days: number;
  pending_days: number;
  created_at: string;
  updated_at: string;
};

export type LeaveBalanceInsert = Omit<LeaveBalanceRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type LeaveBalanceUpdate = Partial<Omit<LeaveBalanceRow, "id">>;

export type WorkflowRequestRow = {
  id: string;
  request_code?: string | null;
  employee_id?: string;
  type:
    | "promotion"
    | "transfer"
    | "role_change"
    | "salary_change"
    | "department_change"
    | "personal_info_change"
    | "PROMOTION"
    | "TRANSFER"
    | "ROLE_CHANGE"
    | "MANAGER_CHANGE"
    | "DEPARTMENT_CHANGE"
    | "SALARY_CHANGE"
    | "PERSONAL_INFO_CHANGE";
  title: string;
  status: "created" | "pending" | "approved" | "rejected" | "applied" | "closed" | "CREATED" | "PENDING" | "APPROVED" | "REJECTED" | "APPLIED" | "CLOSED";
  current_step?: "hr_staff" | "department_manager" | "hr_manager" | "hr_admin" | "executive" | null;
  remarks?: string | null;
  updated_at?: string;
  // Backward-compat columns used by current app state
  created_by?: string;
  created_at: string;
  entity_id?: string | null;
  entity_type?: string | null;
};

export type WorkflowRequestInsert = Omit<WorkflowRequestRow, "id" | "created_at"> & { id?: string; created_at?: string };
export type WorkflowRequestUpdate = Partial<Omit<WorkflowRequestRow, "id">>;

export type PersonalInfoChangeRow = {
  id: string;
  change_code?: string | null;
  request_id: string;
  field_name: "email" | "birthdate" | "fullname" | "address" | "contact_number" | "civil_status";
  old_value: string | null;
  new_value: string;
  reason: string | null;
  supporting_document_url?: string | null;
  supporting_document_name?: string | null;
};
export type PersonalInfoChangeInsert = Omit<PersonalInfoChangeRow, "id"> & { id?: string };
export type PersonalInfoChangeUpdate = Partial<Omit<PersonalInfoChangeRow, "id">>;

export type PromotionRequestRow = {
  id: string;
  request_id: string;
  current_position: string | null;
  proposed_position: string;
  effective_date: string | null;
  justification: string | null;
};
export type PromotionRequestInsert = Omit<PromotionRequestRow, "id"> & { id?: string };
export type PromotionRequestUpdate = Partial<Omit<PromotionRequestRow, "id">>;

export type RoleChangeRequestRow = {
  id: string;
  request_id: string;
  current_department: string | null;
  current_position: string | null;
  new_position: string;
  effective_date: string | null;
  reason: string | null;
};
export type RoleChangeRequestInsert = Omit<RoleChangeRequestRow, "id"> & { id?: string };
export type RoleChangeRequestUpdate = Partial<Omit<RoleChangeRequestRow, "id">>;

export type SalaryChangeRequestRow = {
  id: string;
  request_id: string;
  current_salary: number | null;
  percentage_increase: string | null;
  reason: string | null;
  budget_justification?: string | null;
};
export type SalaryChangeRequestInsert = Omit<SalaryChangeRequestRow, "id"> & { id?: string };
export type SalaryChangeRequestUpdate = Partial<Omit<SalaryChangeRequestRow, "id">>;

export type TransferRequestRow = {
  id: string;
  request_id: string;
  reason: string | null;
  current_location?: string | null;
  new_location?: string | null;
  current_team?: string | null;
  target_team?: string | null;
  target_team_branch?: string | null;
  effective_date?: string | null;
  impact_notes?: string | null;
};
export type TransferRequestInsert = Omit<TransferRequestRow, "id"> & { id?: string };
export type TransferRequestUpdate = Partial<Omit<TransferRequestRow, "id">>;

export type DepartmentChangeRequestRow = {
  id: string;
  request_id: string;
  current_department: string | null;
  new_department: string;
  reason: string | null;
};
export type DepartmentChangeRequestInsert = Omit<DepartmentChangeRequestRow, "id"> & { id?: string };
export type DepartmentChangeRequestUpdate = Partial<Omit<DepartmentChangeRequestRow, "id">>;

export type WorkflowLogRow = {
  id: string;
  log_code?: string | null;
  request_id: string;
  action_by: string;
  role: string;
  action: "submitted" | "forwarded" | "approved" | "rejected" | "applied";
  remarks: string | null;
  created_at: string;
};
export type WorkflowLogInsert = Omit<WorkflowLogRow, "id" | "created_at"> & { id?: string; created_at?: string };
export type WorkflowLogUpdate = Partial<Omit<WorkflowLogRow, "id">>;

export type RequestAttachmentRow = {
  id: string;
  request_id: string;
  file_url: string;
  file_name?: string | null;
  uploaded_at: string;
};
export type RequestAttachmentInsert = Omit<RequestAttachmentRow, "id" | "uploaded_at"> & { id?: string; uploaded_at?: string };
export type RequestAttachmentUpdate = Partial<Omit<RequestAttachmentRow, "id">>;

export type EmployeeSalaryRow = {
  id: string;
  employee_id: string;
  base_salary: number;
  currency: string;
  pay_frequency: "WEEKLY" | "SEMI_MONTHLY" | "MONTHLY" | "ANNUAL";
  effective_from: string;
  effective_to: string | null;
  is_current: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
export type EmployeeSalaryInsert = Omit<EmployeeSalaryRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};
export type EmployeeSalaryUpdate = Partial<Omit<EmployeeSalaryRow, "id" | "created_at">>;

export type AttendanceRow = {
  id: string;
  employee_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  total_late_minutes: number;
  total_undertime_minutes: number;
  total_overtime_minutes: number;
  late_hour?: number;
  late_minutes?: number;
  undertime_hour?: number;
  undertime_minutes?: number;
  overtime_hour?: number;
  overtime_minutes?: number;
  created_at: string;
  updated_at: string;
};

export type AttendanceInsert = Omit<AttendanceRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type AttendanceUpdate = Partial<Omit<AttendanceRow, "id">>;

export type AttendanceCorrectionRequestRow = {
  id: string;
  employee_id: string;
  attendance_id: string | null;
  attendance_date: string;
  requested_clock_in: string | null;
  requested_clock_out: string | null;
  reason: string;
  attachment_name: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  remarks: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AttendanceCorrectionRequestInsert = Omit<
  AttendanceCorrectionRequestRow,
  "id" | "created_at" | "updated_at" | "approved_by" | "approved_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  approved_by?: string | null;
  approved_at?: string | null;
};

export type AttendanceCorrectionRequestUpdate = Partial<
  Omit<AttendanceCorrectionRequestRow, "id">
>;

export type OvertimeRequestRow = {
  id: string;
  employee_id: string;
  attendance_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  ot_type: "PRE_OT" | "POST_OT";
  category: string;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  remarks: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OvertimeRequestInsert = Omit<
  OvertimeRequestRow,
  "id" | "created_at" | "updated_at" | "approved_by" | "approved_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  approved_by?: string | null;
  approved_at?: string | null;
};

export type OvertimeRequestUpdate = Partial<Omit<OvertimeRequestRow, "id">>;

export type AuditLogRow = {
  id: string;
  timestamp: string;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  source: string | null;
  created_at: string;
};

export type AuditLogInsert = Omit<AuditLogRow, "id" | "created_at"> & { id?: string; created_at?: string };
export type AuditLogUpdate = Partial<Omit<AuditLogRow, "id">>;
