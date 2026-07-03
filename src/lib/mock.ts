/**
 * Mock data for Workzen HRIS Web App (replace with API calls later).
 */

export type Role =
  | "SUPER_ADMIN"
  | "HR_ADMIN"
  | "HR_MANAGER"
  | "HR_STAFF"
  | "DEPARTMENT_MANAGER"
  | "MANAGER"
  | "EMPLOYEE"
  | "AUDITOR"
  | "EXECUTIVE"
  | "BOARD";

/** Full-time, part-time, contract, internship, etc. */
export type EmploymentType =
  | "FULL_TIME"
  | "PART_TIME"
  | "CONTRACT"
  | "INTERNSHIP"
  | "PROBATION";

export interface Department {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  managerId: string | null;
}

export interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  departmentId: string;
  jobTitle: string;
  managerId: string | null;
  employmentStatus: "ACTIVE" | "ONBOARDING" | "OFFBOARDED";
  startDate: string;
  role: Role;
  /** Full-time, part-time, contract, internship, etc. */
  employmentType?: EmploymentType;
  /** Date of birth (YYYY-MM-DD) */
  birthday?: string;
  /** Full current address */
  currentAddress?: string;
  /** Personal mobile or phone number */
  personalPhone?: string;
  /** Profile photo URL (null if not set) */
  profilePhoto?: string | null;
}

export interface JobHistoryEntry {
  id: string;
  employeeId: string;
  jobTitle: string;
  departmentId: string;
  departmentName: string;
  managerId: string | null;
  startDate: string;
  endDate: string | null;
}

export type RequestStatus =
  | "CREATED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "APPLIED"
  | "CLOSED";

export type RequestType =
  | "PROMOTION"
  | "TRANSFER"
  | "ROLE_CHANGE"
  | "DEPARTMENT_CHANGE"
  | "MANAGER_CHANGE"
  | "SALARY_CHANGE"
  | "PERSONAL_INFO_CHANGE";

export interface WorkflowRequest {
  id: string;
  type: RequestType;
  title: string;
  createdBy: string;
  createdByName: string;
  status: RequestStatus;
  createdAt: string;
  entityId?: string;
  entityType?: string;
  effectiveDate?: string;
  personalInfoField?:
    | "EMAIL"
    | "BIRTHDATE"
    | "FULLNAME"
    | "ADDRESS"
    | "CONTACT_NUMBER"
    | "CIVIL_STATUS"
    | "SSS"
    | "PHILHEALTH"
    | "PAGIBIG"
    | "TIN";
  currentValue?: string;
  newValue?: string;
  reason?: string;
  reviewStage?:
    | "DEPARTMENT_MANAGER"
    | "HR_MANAGER"
    | "HR_STAFF"
    | "HR_ADMIN"
    | "CURRENT_MANAGER"
    | "TARGET_MANAGER"
    | "NEW_MANAGER"
    | "EXECUTIVE";
  reviewNotes?: string;
  description?: string;
  attachmentName?: string;
  attachmentDataUrl?: string;
}

export const departments: Department[] = [
  { id: "dept-1", name: "Human Resources", code: "HR", parentId: null, managerId: "emp-1" },
  { id: "dept-2", name: "Engineering", code: "ENG", parentId: null, managerId: "emp-2" },
  { id: "dept-3", name: "Finance", code: "FIN", parentId: null, managerId: "emp-3" },
  { id: "dept-4", name: "Information Technology", code: "IT", parentId: null, managerId: "emp-2" },
  { id: "dept-5", name: "Executive Office", code: "EXO", parentId: null, managerId: "emp-23" },
];

export const employees: Employee[] = [
  {
    id: "emp-1",
    employeeNumber: "EMP-0004",
    firstName: "Clinton",
    lastName: "Galvez",
    email: "clinton.galvez@gmail.com",
    departmentId: "dept-1",
    jobTitle: "HR Administrator",
    managerId: null,
    employmentStatus: "ACTIVE",
    startDate: "2020-01-15",
    role: "HR_ADMIN",
    birthday: "1985-03-12",
    currentAddress: "123 Ayala Ave, Makati City 1226",
    personalPhone: "+63 912 345 6789",
    profilePhoto:
      "https://ui-avatars.com/api/?name=Clinton+Galvez&size=256&background=6366f1&color=fff",
    employmentType: "FULL_TIME",
  },
  {
    id: "emp-2",
    employeeNumber: "EMP-0003",
    firstName: "Jon",
    lastName: "Garcia",
    email: "jon.garcia@gmail.com",
    departmentId: "dept-4",
    jobTitle: "Engineering Manager",
    managerId: null,
    employmentStatus: "ACTIVE",
    startDate: "2019-06-01",
    role: "DEPARTMENT_MANAGER",
    birthday: "1982-07-08",
    currentAddress: "45 Boni Ave, Mandaluyong City 1550",
    personalPhone: "+63 917 876 5432",
    profilePhoto: "https://ui-avatars.com/api/?name=Jon+Garcia&size=256&background=059669&color=fff",
    employmentType: "FULL_TIME",
  },
  {
    id: "emp-3",
    employeeNumber: "EMP-0007",
    firstName: "Francis",
    lastName: "Lopez",
    email: "francis.lopez@gmail.com",
    departmentId: "dept-3",
    jobTitle: "Audit Officer",
    managerId: null,
    employmentStatus: "ACTIVE",
    startDate: "2018-03-10",
    role: "AUDITOR",
    birthday: "1988-11-20",
    currentAddress: "78 Ortigas Ave, Pasig City 1605",
    personalPhone: "+63 912 037 9382",
    profilePhoto:
      "https://ui-avatars.com/api/?name=Francis+Lopez&size=256&background=d97706&color=fff",
    employmentType: "FULL_TIME",
  },
  {
    id: "emp-4",
    employeeNumber: "EMP-0002",
    firstName: "Glean",
    lastName: "Ramos",
    email: "glen.ramos@gmail.com",
    departmentId: "dept-4",
    jobTitle: "Junior Software Engineer",
    managerId: "emp-2",
    employmentStatus: "ACTIVE",
    startDate: "2021-02-01",
    role: "EMPLOYEE",
    birthday: "1992-04-15",
    currentAddress: "22 Shaw Blvd, Mandaluyong City 1552",
    personalPhone: "+63 919 765 4321",
    profilePhoto: "https://ui-avatars.com/api/?name=Glean+Ramos&size=256&background=0891b2&color=fff",
    employmentType: "FULL_TIME",
  },
  {
    id: "emp-5",
    employeeNumber: "EMP-0005",
    firstName: "Kath",
    lastName: "Domingo",
    email: "kath.domingo@gmail.com",
    departmentId: "dept-1",
    jobTitle: "HR Staff",
    managerId: "emp-1",
    employmentStatus: "ACTIVE",
    startDate: "2022-05-15",
    role: "HR_STAFF",
    birthday: "1995-05-20",
    currentAddress: "15 Kapitolyo, Pasig City 1603",
    personalPhone: "+63 916 543 2109",
    profilePhoto: "https://ui-avatars.com/api/?name=Kath+Domingo&size=256&background=7c3aed&color=fff",
    employmentType: "PART_TIME",
  },
  {
    id: "emp-sa-1",
    employeeNumber: "EMP-0009",
    firstName: "Anthony",
    lastName: "Torres",
    email: "anthony.torres@gmail.com",
    departmentId: "dept-4",
    jobTitle: "System Admin",
    managerId: null,
    employmentStatus: "ACTIVE",
    startDate: "2019-01-01",
    role: "SUPER_ADMIN",
    birthday: "1985-03-12",
    currentAddress: "Makati City, Metro Manila",
    personalPhone: "+63 912 345 6789",
    profilePhoto:
      "https://ui-avatars.com/api/?name=Anthony+Torres&size=256&background=0f172a&color=fff",
    employmentType: "FULL_TIME",
  },
  {
    id: "emp-hrm-1",
    employeeNumber: "EMP-0006",
    firstName: "Randy",
    lastName: "Castro",
    email: "randy.castro@gmail.com",
    departmentId: "dept-1",
    jobTitle: "HR Manager",
    managerId: "emp-1",
    employmentStatus: "ACTIVE",
    startDate: "2021-07-01",
    role: "HR_MANAGER",
    birthday: "1989-09-15",
    currentAddress: "Ayala Ave, Makati City 1226",
    personalPhone: "+63 917 000 1122",
    profilePhoto:
      "https://ui-avatars.com/api/?name=Randy+Castro&size=256&background=4f46e5&color=fff",
    employmentType: "FULL_TIME",
  },
  {
    id: "emp-6",
    employeeNumber: "E006",
    firstName: "Miguel",
    lastName: "Torres",
    email: "miguel.torres@company.com",
    departmentId: "dept-2",
    jobTitle: "Software Developer",
    managerId: "emp-2",
    employmentStatus: "ACTIVE",
    startDate: "2022-01-10",
    role: "EMPLOYEE",
    birthday: "1993-09-03",
    currentAddress: "100 E. Rodriguez Jr. Ave, Quezon City 1102",
    personalPhone: "+63 915 111 2233",
    profilePhoto: "https://ui-avatars.com/api/?name=Miguel+Torres&size=256&background=0d9488&color=fff",
    employmentType: "FULL_TIME",
  },
  {
    id: "emp-7",
    employeeNumber: "E007",
    firstName: "Sofia",
    lastName: "Lopez",
    email: "sofia.lopez@company.com",
    departmentId: "dept-2",
    jobTitle: "QA Engineer",
    managerId: "emp-2",
    employmentStatus: "ACTIVE",
    startDate: "2022-03-15",
    role: "EMPLOYEE",
    birthday: "1994-01-28",
    currentAddress: "5 McKinley Rd, Taguig City 1634",
    personalPhone: "+63 917 444 5566",
    profilePhoto: "https://ui-avatars.com/api/?name=Sofia+Lopez&size=256&background=be185d&color=fff",
    employmentType: "CONTRACT",
  },
  {
    id: "emp-8",
    employeeNumber: "E008",
    firstName: "James",
    lastName: "Wilson",
    email: "james.wilson@company.com",
    departmentId: "dept-3",
    jobTitle: "Accountant",
    managerId: "emp-3",
    employmentStatus: "ACTIVE",
    startDate: "2021-08-01",
    role: "EMPLOYEE",
    birthday: "1990-12-10",
    currentAddress: "50 C. Raymundo Ave, Pasig City 1605",
    personalPhone: "+63 918 777 8899",
    profilePhoto: "https://ui-avatars.com/api/?name=James+Wilson&size=256&background=4f46e5&color=fff",
    employmentType: "FULL_TIME",
  },
  {
    id: "emp-9",
    employeeNumber: "E009",
    firstName: "Elena",
    lastName: "Martinez",
    email: "elena.martinez@company.com",
    departmentId: "dept-1",
    jobTitle: "Recruiter",
    managerId: "emp-1",
    employmentStatus: "ACTIVE",
    startDate: "2023-02-20",
    role: "HR_STAFF",
    birthday: "1996-06-14",
    currentAddress: "12 Poblacion, Makati City 1210",
    personalPhone: "+63 916 222 3344",
    profilePhoto: "https://ui-avatars.com/api/?name=Elena+Martinez&size=256&background=dc2626&color=fff",
    employmentType: "FULL_TIME",
  },
  {
    id: "emp-10",
    employeeNumber: "E010",
    firstName: "David",
    lastName: "Kim",
    email: "david.kim@company.com",
    departmentId: "dept-2",
    jobTitle: "DevOps Engineer",
    managerId: "emp-2",
    employmentStatus: "ACTIVE",
    startDate: "2022-06-01",
    role: "EMPLOYEE",
    birthday: "1991-08-22",
    currentAddress: "88 EDSA, Quezon City 1105",
    personalPhone: "+63 919 888 9900",
    profilePhoto: "https://ui-avatars.com/api/?name=David+Kim&size=256&background=0369a1&color=fff",
    employmentType: "FULL_TIME",
  },
  {
    id: "emp-11",
    employeeNumber: "E011",
    firstName: "Rachel",
    lastName: "Nguyen",
    email: "rachel.nguyen@company.com",
    departmentId: "dept-3",
    jobTitle: "Financial Analyst",
    managerId: "emp-3",
    employmentStatus: "ACTIVE",
    startDate: "2023-01-09",
    role: "EMPLOYEE",
    birthday: "1997-02-05",
    currentAddress: "30 Meralco Ave, Pasig City 1600",
    personalPhone: "+63 915 666 7788",
    profilePhoto: "https://ui-avatars.com/api/?name=Rachel+Nguyen&size=256&background=65a30d&color=fff",
    employmentType: "INTERNSHIP",
  },
  {
    id: "emp-12",
    employeeNumber: "E012",
    firstName: "Patrick",
    lastName: "O'Brien",
    email: "patrick.obrien@company.com",
    departmentId: "dept-2",
    jobTitle: "Frontend Developer",
    managerId: "emp-2",
    employmentStatus: "ACTIVE",
    startDate: "2022-09-12",
    role: "EMPLOYEE",
    birthday: "1993-10-30",
    currentAddress: "7 BGC, Taguig City 1634",
    personalPhone: "+63 917 333 4455",
    profilePhoto: "https://ui-avatars.com/api/?name=Patrick+OBrien&size=256&background=ca8a04&color=fff",
    employmentType: "FULL_TIME",
  },
  {
    id: "emp-13",
    employeeNumber: "E013",
    firstName: "Nina",
    lastName: "Petrov",
    email: "nina.petrov@company.com",
    departmentId: "dept-1",
    jobTitle: "Training Specialist",
    managerId: "emp-1",
    employmentStatus: "ACTIVE",
    startDate: "2023-04-01",
    role: "HR_STAFF",
    birthday: "1994-03-17",
    currentAddress: "41 Timog Ave, Quezon City 1103",
    personalPhone: "+63 918 999 0011",
    profilePhoto: "https://ui-avatars.com/api/?name=Nina+Petrov&size=256&background=9333ea&color=fff",
    employmentType: "PART_TIME",
  },
  {
    id: "emp-14",
    employeeNumber: "E014",
    firstName: "Marcus",
    lastName: "Johnson",
    email: "marcus.johnson@company.com",
    departmentId: "dept-2",
    jobTitle: "Backend Developer",
    managerId: "emp-2",
    employmentStatus: "ACTIVE",
    startDate: "2021-11-15",
    role: "EMPLOYEE",
    birthday: "1989-07-25",
    currentAddress: "19 Libis, Quezon City 1110",
    personalPhone: "+63 916 555 6677",
    profilePhoto: "https://ui-avatars.com/api/?name=Marcus+Johnson&size=256&background=0f766e&color=fff",
    employmentType: "FULL_TIME",
  },
  {
    id: "emp-15",
    employeeNumber: "E015",
    firstName: "Yuki",
    lastName: "Tanaka",
    email: "yuki.tanaka@company.com",
    departmentId: "dept-3",
    jobTitle: "Auditor",
    managerId: "emp-3",
    employmentStatus: "ACTIVE",
    startDate: "2022-07-18",
    role: "EMPLOYEE",
    birthday: "1992-11-08",
    currentAddress: "25 San Miguel Ave, Mandaluyong City 1550",
    personalPhone: "+63 919 012 3456",
    profilePhoto: "https://ui-avatars.com/api/?name=Yuki+Tanaka&size=256&background=b45309&color=fff",
    employmentType: "FULL_TIME",
  },
  {
    id: "emp-16",
    employeeNumber: "E016",
    firstName: "Omar",
    lastName: "Hassan",
    email: "omar.hassan@company.com",
    departmentId: "dept-2",
    jobTitle: "Data Engineer",
    managerId: "emp-2",
    employmentStatus: "ACTIVE",
    startDate: "2023-03-01",
    role: "EMPLOYEE",
    birthday: "1991-04-12",
    currentAddress: "9 Rockwell, Makati City 1210",
    personalPhone: "+63 917 654 3210",
    profilePhoto: "https://ui-avatars.com/api/?name=Omar+Hassan&size=256&background=1e40af&color=fff",
    employmentType: "CONTRACT",
  },
  {
    id: "emp-17",
    employeeNumber: "E017",
    firstName: "Claire",
    lastName: "Dubois",
    email: "claire.dubois@company.com",
    departmentId: "dept-1",
    jobTitle: "Benefits Administrator",
    managerId: "emp-1",
    employmentStatus: "ACTIVE",
    startDate: "2022-10-01",
    role: "HR_STAFF",
    birthday: "1995-08-19",
    currentAddress: "3 Greenfield, Mandaluyong City 1552",
    personalPhone: "+63 918 345 6789",
    profilePhoto: "https://ui-avatars.com/api/?name=Claire+Dubois&size=256&background=9d174d&color=fff",
    employmentType: "FULL_TIME",
  },
  {
    id: "emp-18",
    employeeNumber: "E018",
    firstName: "Ryan",
    lastName: "Foster",
    email: "ryan.foster@company.com",
    departmentId: "dept-2",
    jobTitle: "Tech Lead",
    managerId: "emp-2",
    employmentStatus: "ACTIVE",
    startDate: "2020-05-01",
    role: "EMPLOYEE",
    birthday: "1987-12-01",
    currentAddress: "61 Pioneer St, Mandaluyong City 1550",
    personalPhone: "+63 915 987 6543",
    profilePhoto: "https://ui-avatars.com/api/?name=Ryan+Foster&size=256&background=047857&color=fff",
    employmentType: "FULL_TIME",
  },
  {
    id: "emp-19",
    employeeNumber: "E019",
    firstName: "Priya",
    lastName: "Sharma",
    email: "priya.sharma@company.com",
    departmentId: "dept-3",
    jobTitle: "Budget Analyst",
    managerId: "emp-3",
    employmentStatus: "ACTIVE",
    startDate: "2023-02-14",
    role: "EMPLOYEE",
    birthday: "1996-01-23",
    currentAddress: "14 Pearl Dr, Ortigas 1605",
    personalPhone: "+63 916 789 0123",
    profilePhoto: "https://ui-avatars.com/api/?name=Priya+Sharma&size=256&background=7c2d12&color=fff",
    employmentType: "PROBATION",
  },
  {
    id: "emp-20",
    employeeNumber: "E020",
    firstName: "Alex",
    lastName: "Rivera",
    email: "alex.rivera@company.com",
    departmentId: "dept-2",
    jobTitle: "UX Designer",
    managerId: "emp-2",
    employmentStatus: "ACTIVE",
    startDate: "2022-04-11",
    role: "EMPLOYEE",
    birthday: "1994-06-07",
    currentAddress: "28 Estrella St, Makati City 1229",
    personalPhone: "+63 917 890 1234",
    profilePhoto: "https://ui-avatars.com/api/?name=Alex+Rivera&size=256&background=6b21a8&color=fff",
    employmentType: "FULL_TIME",
  },
  {
    id: "emp-21",
    employeeNumber: "E021",
    firstName: "Kei",
    lastName: "Cruz",
    email: "kei.cruz@company.com",
    departmentId: "dept-4",
    jobTitle: "IT Support Specialist",
    managerId: "emp-2",
    employmentStatus: "ACTIVE",
    startDate: "2024-01-10",
    role: "EMPLOYEE",
    birthday: "2000-02-18",
    currentAddress: "Naga City, Camarines Sur",
    personalPhone: "+63 912 000 0000",
    profilePhoto: "https://ui-avatars.com/api/?name=Kei+Cruz&size=256&background=0ea5e9&color=fff",
    employmentType: "FULL_TIME",
  },
  {
    id: "emp-22",
    employeeNumber: "E022",
    firstName: "Noah",
    lastName: "Lim",
    email: "noah.lim@company.com",
    departmentId: "dept-4",
    jobTitle: "Systems Administrator",
    managerId: "emp-2",
    employmentStatus: "ACTIVE",
    startDate: "2023-09-01",
    role: "EMPLOYEE",
    birthday: "1993-09-19",
    currentAddress: "Quezon City, Metro Manila",
    personalPhone: "+63 919 222 3344",
    profilePhoto: "https://ui-avatars.com/api/?name=Noah+Lim&size=256&background=14b8a6&color=fff",
    employmentType: "FULL_TIME",
  },
  {
    id: "emp-23",
    employeeNumber: "EMP-0008",
    firstName: "Lani",
    lastName: "Rivera",
    email: "lani.rivera@gmail.com",
    departmentId: "dept-5",
    jobTitle: "Executive",
    managerId: null,
    employmentStatus: "ACTIVE",
    startDate: "2019-01-01",
    role: "EXECUTIVE",
    birthday: "1980-11-20",
    currentAddress: "Makati City, Metro Manila",
    personalPhone: "+63 918 749 8397",
    profilePhoto:
      "https://ui-avatars.com/api/?name=Lani+Rivera&size=256&background=1e3a5f&color=fff",
    employmentType: "FULL_TIME",
  },
  {
    id: "emp-24",
    employeeNumber: "E025",
    firstName: "James",
    lastName: "Wright",
    email: "james.wright@company.com",
    departmentId: "dept-1",
    jobTitle: "Board Member",
    managerId: null,
    employmentStatus: "ACTIVE",
    startDate: "2018-01-01",
    role: "BOARD",
    birthday: "1975-04-10",
    currentAddress: "BGC, Taguig City",
    personalPhone: "+63 918 111 1111",
    profilePhoto: "https://ui-avatars.com/api/?name=James+Wright&size=256&background=312e81&color=fff",
    employmentType: "FULL_TIME",
  },
];

export const jobHistory: JobHistoryEntry[] = [
  {
    id: "jh-1",
    employeeId: "emp-4",
    jobTitle: "Junior Accountant",
    departmentId: "dept-3",
    departmentName: "Finance",
    managerId: "emp-2",
    startDate: "2021-02-01",
    endDate: "2023-12-31",
  },
  {
    id: "jh-2",
    employeeId: "emp-4",
    jobTitle: "Junior Software Engineer",
    departmentId: "dept-2",
    departmentName: "Engineering",
    managerId: "emp-2",
    startDate: "2024-01-01",
    endDate: null,
  },
];

export const workflowRequests: WorkflowRequest[] = [
  {
    id: "req-1",
    type: "PROMOTION",
    title: "Promotion: Glean Ramos to Software Engineer II",
    createdBy: "emp-2",
    createdByName: "Jon Garcia",
    status: "PENDING",
    createdAt: "2025-02-20T10:00:00Z",
    entityId: "emp-4",
    entityType: "employee",
  },
  {
    id: "req-2",
    type: "TRANSFER",
    title: "Transfer: Kath Domingo to Engineering",
    createdBy: "emp-1",
    createdByName: "Maria Santos",
    status: "APPROVED",
    createdAt: "2025-02-18T14:30:00Z",
    entityId: "emp-5",
    entityType: "employee",
  },
];

export function getDepartmentById(id: string): Department | undefined {
  return departments.find((d) => d.id === id);
}

/** Logged-in user for UI (replace with auth/session). Links to employee for full profile. */
export type CurrentUser = {
  id: string;
  employeeId: string;
  name: string;
  role: Role;
  profilePhoto: string;
  email: string;
  employeeNumber: string;
  jobTitle: string;
  departmentId: string;
  managerId: string | null;
  startDate: string;
  employmentType: EmploymentType;
  birthday: string;
  currentAddress: string;
  personalPhone: string;
  lastLoginAt: string;
  /** From employees.card_holder_name (Supabase) or demo map */
  payoutCardHolderName?: string | null;
  /** From employees.card_number — masked only, e.g. **** **** **** 3210 */
  payoutCardNumberMasked?: string | null;
  /** employees.payout_preference: maya | bank */
  payoutPreference?: "maya" | "bank" | null;
  selectedAccessId?: string;
  selectedSystemCode?: string;
  selectedSystemName?: string;
  selectedSystemRoleCode?: string;
  selectedSystemRoleName?: string;
  accessibleSystems?: Array<{
    id: string;
    userId: string;
    systemId: string;
    systemCode: string;
    systemName: string;
    roleCode: string;
    roleName: string;
    status: string;
    systemRoleId?: number | null;
  }>;
};

export const currentUser: CurrentUser = {
  id: "current",
  employeeId: "emp-1",
  name: "Clinton Galvez",
  role: "HR_ADMIN",
  profilePhoto:
    "https://ui-avatars.com/api/?name=Clinton+Galvez&size=256&background=6366f1&color=fff",
  email: "clinton.galvez@gmail.com",
  employeeNumber: "EMP-0004",
  jobTitle: "HR Administrator",
  departmentId: "dept-1",
  managerId: null as string | null,
  startDate: "2020-01-15",
  employmentType: "FULL_TIME" as EmploymentType,
  birthday: "1985-03-12",
  currentAddress: "123 Ayala Ave, Makati City 1226",
  personalPhone: "+63 912 345 6789",
  lastLoginAt: "2025-02-26T08:30:00Z",
};

// Demo users per role for the frontend-only login flow.
// In a real app these would come from your auth backend.
export const demoUsersByRole: Record<Role, CurrentUser> = {
  SUPER_ADMIN: {
    ...currentUser,
    id: "current-super-admin",
    role: "SUPER_ADMIN",
    name: "Anthony Torres",
    email: "anthony.torres@gmail.com",
    employeeId: "emp-sa-1",
    employeeNumber: "EMP-0009",
    jobTitle: "System Admin",
    departmentId: "dept-4",
    profilePhoto:
      "https://ui-avatars.com/api/?name=Anthony+Torres&size=256&background=0f172a&color=fff",
  },
  HR_ADMIN: currentUser,
  HR_MANAGER: {
    id: "current-hr-manager",
    employeeId: "emp-hrm-1",
    name: "Randy Castro",
    role: "HR_MANAGER",
    profilePhoto:
      "https://ui-avatars.com/api/?name=Randy+Castro&size=256&background=4f46e5&color=fff",
    email: "randy.castro@gmail.com",
    employeeNumber: "EMP-0006",
    jobTitle: "HR Manager",
    departmentId: "dept-1",
    managerId: "emp-1",
    startDate: "2021-07-01",
    employmentType: "FULL_TIME",
    birthday: "1989-09-15",
    currentAddress: "Ayala Ave, Makati City 1226",
    personalPhone: "+63 917 000 1122",
    lastLoginAt: "2025-02-26T09:00:00Z",
  },
  HR_STAFF: {
    id: "current-hr-staff",
    employeeId: "emp-5",
    name: "Kath Domingo",
    role: "HR_STAFF",
    profilePhoto:
      "https://ui-avatars.com/api/?name=Kath+Domingo&size=256&background=7c3aed&color=fff",
    email: "kath.domingo@gmail.com",
    employeeNumber: "EMP-0005",
    jobTitle: "HR Staff",
    departmentId: "dept-1",
    managerId: "emp-1",
    startDate: "2022-05-15",
    employmentType: "PART_TIME",
    birthday: "1995-05-20",
    currentAddress: "15 Kapitolyo, Pasig City 1603",
    personalPhone: "+63 916 543 2109",
    lastLoginAt: "2025-02-26T09:15:00Z",
  },
  DEPARTMENT_MANAGER: {
    id: "current-manager",
    employeeId: "emp-2",
    name: "Jon Garcia",
    role: "DEPARTMENT_MANAGER",
    profilePhoto:
      "https://ui-avatars.com/api/?name=Jon+Garcia&size=256&background=059669&color=fff",
    email: "jon.garcia@gmail.com",
    employeeNumber: "EMP-0003",
    jobTitle: "Engineering Manager",
    departmentId: "dept-4",
    managerId: null,
    startDate: "2019-06-01",
    employmentType: "FULL_TIME",
    birthday: "1982-07-08",
    currentAddress: "45 Boni Ave, Mandaluyong City 1550",
    personalPhone: "+63 917 876 5432",
    lastLoginAt: "2025-02-26T09:45:00Z",
  },
  MANAGER: {
    id: "current-manager-role",
    employeeId: "emp-2",
    name: "Jon Garcia",
    role: "MANAGER",
    profilePhoto:
      "https://ui-avatars.com/api/?name=Jon+Garcia&size=256&background=059669&color=fff",
    email: "jon.garcia@gmail.com",
    employeeNumber: "EMP-0003",
    jobTitle: "Engineering Manager",
    departmentId: "dept-4",
    managerId: null,
    startDate: "2019-06-01",
    employmentType: "FULL_TIME",
    birthday: "1982-07-08",
    currentAddress: "45 Boni Ave, Mandaluyong City 1550",
    personalPhone: "+63 917 876 5432",
    lastLoginAt: "2025-02-26T09:45:00Z",
  },
  EMPLOYEE: {
    id: "current-employee",
    employeeId: "emp-4",
    name: "Glean Ramos",
    role: "EMPLOYEE",
    profilePhoto:
      "https://ui-avatars.com/api/?name=Glean+Ramos&size=256&background=0891b2&color=fff",
    email: "glen.ramos@gmail.com",
    employeeNumber: "EMP-0002",
    jobTitle: "Junior Software Engineer",
    departmentId: "dept-4",
    managerId: "emp-2",
    startDate: "2021-02-01",
    employmentType: "FULL_TIME",
    birthday: "1992-04-15",
    currentAddress: "22 Shaw Blvd, Mandaluyong City 1552",
    personalPhone: "+63 919 765 4321",
    lastLoginAt: "2025-02-26T10:05:00Z",
  },
  AUDITOR: {
    id: "current-auditor",
    employeeId: "emp-3",
    name: "Francis Lopez",
    role: "AUDITOR",
    profilePhoto:
      "https://ui-avatars.com/api/?name=Francis+Lopez&size=256&background=0f172a&color=fff",
    email: "francis.lopez@gmail.com",
    employeeNumber: "EMP-0007",
    jobTitle: "Audit Officer",
    departmentId: "dept-3",
    managerId: null,
    startDate: "2020-06-01",
    employmentType: "FULL_TIME",
    birthday: "1988-06-01",
    currentAddress: "Finance HQ",
    personalPhone: "+63 912 037 9382",
    lastLoginAt: "2025-02-26T10:30:00Z",
  },
  EXECUTIVE: {
    id: "current-executive",
    employeeId: "emp-23",
    name: "Lani Rivera",
    role: "EXECUTIVE",
    profilePhoto:
      "https://ui-avatars.com/api/?name=Lani+Rivera&size=256&background=1e3a5f&color=fff",
    email: "lani.rivera@gmail.com",
    employeeNumber: "EMP-0008",
    jobTitle: "Executive",
    departmentId: "dept-5",
    managerId: null,
    startDate: "2019-01-01",
    employmentType: "FULL_TIME",
    birthday: "1980-11-20",
    currentAddress: "Makati City, Metro Manila",
    personalPhone: "+63 918 749 8397",
    lastLoginAt: "2025-02-26T11:00:00Z",
  },
  BOARD: {
    id: "current-board",
    employeeId: "emp-24",
    name: "James Wright",
    role: "BOARD",
    profilePhoto:
      "https://ui-avatars.com/api/?name=James+Wright&size=256&background=312e81&color=fff",
    email: "james.wright@company.com",
    employeeNumber: "E025",
    jobTitle: "Board Member",
    departmentId: "dept-1",
    managerId: null,
    startDate: "2018-01-01",
    employmentType: "FULL_TIME",
    birthday: "1975-04-10",
    currentAddress: "BGC, Taguig City",
    personalPhone: "+63 918 111 1111",
    lastLoginAt: "2025-02-26T11:15:00Z",
  },
};

/**
 * Maps known demo / seed emails to full display names. Used when Supabase `employees`
 * rows omit first/last name and the UI would otherwise show the email local part (e.g. glen.ramos → Glen.Ramos).
 */
export function getDemoNameForEmail(email: string): string | null {
  const n = email.trim().toLowerCase();
  if (!n) return null;
  for (const u of Object.values(demoUsersByRole)) {
    if (u.email.toLowerCase() === n) return u.name;
  }
  for (const e of employees) {
    if (e.email.toLowerCase() === n) {
      const combined = `${e.firstName} ${e.lastName}`.trim();
      return combined || null;
    }
  }
  return null;
}

export type CurrentUserEditable = Partial<
  Pick<
    CurrentUser,
    | "name"
    | "profilePhoto"
    | "email"
    | "personalPhone"
    | "birthday"
    | "currentAddress"
    | "payoutCardHolderName"
    | "payoutCardNumberMasked"
    | "payoutPreference"
  >
>;

export function getEmployeeById(id: string): Employee | undefined {
  return employees.find((e) => e.id === id);
}

/** Returns employee IDs where manager_id equals the given manager's employee ID. */
export function getDirectReportIds(managerEmployeeId: string): string[] {
  return employees
    .filter((e) => e.managerId === managerEmployeeId)
    .map((e) => e.id);
}

/** Returns employee IDs in departments managed by this employee (department.managerId === managerEmployeeId). */
export function getEmployeeIdsUnderDepartmentManager(managerEmployeeId: string): string[] {
  const departmentIds = departments
    .filter((d) => d.managerId === managerEmployeeId)
    .map((d) => d.id);
  return employees
    .filter((e) => departmentIds.includes(e.departmentId))
    .map((e) => e.id);
}

export function getJobHistoryByEmployeeId(employeeId: string): JobHistoryEntry[] {
  return jobHistory
    .filter((j) => j.employeeId === employeeId)
    .sort(
      (a, b) =>
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
}

export function getRequestsByStatus(status: RequestStatus): WorkflowRequest[] {
  return workflowRequests.filter((r) => r.status === status);
}

export function getMyRequests(createdBy: string): WorkflowRequest[] {
  return workflowRequests.filter((r) => r.createdBy === createdBy);
}

// --- Dashboard: upcoming events & schedule ---

export type TimeOffType =
  | "VACATION_LEAVE"
  | "SICK_LEAVE"
  | "EMERGENCY_LEAVE"
  | "BEREAVEMENT_LEAVE"
  | "MATERNITY_LEAVE"
  | "PATERNITY_LEAVE"
  | "SOLO_PARENT_LEAVE"
  | "UNPAID_LEAVE";

/** Leave type reference: Paid/Unpaid, Salary Status, Notes (for form and policies). */
export const leaveTypeMetadata: Record<
  TimeOffType,
  { label: string; paid: boolean; salaryStatus: string; notes: string }
> = {
  VACATION_LEAVE: {
    label: "Vacation Leave (VL)",
    paid: true,
    salaryStatus: "Employee receives full salary",
    notes: "Deducted from VL balance",
  },
  SICK_LEAVE: {
    label: "Sick Leave (SL)",
    paid: true,
    salaryStatus: "Employee receives full salary",
    notes: "May require medical certificate",
  },
  EMERGENCY_LEAVE: {
    label: "Emergency Leave",
    paid: true,
    salaryStatus: "Employee receives full salary",
    notes: "Depends on company policy",
  },
  BEREAVEMENT_LEAVE: {
    label: "Bereavement Leave",
    paid: true,
    salaryStatus: "Employee receives full salary",
    notes: "For death of immediate family",
  },
  MATERNITY_LEAVE: {
    label: "Maternity Leave",
    paid: true,
    salaryStatus: "Paid through SSS maternity benefit",
    notes: "105 days under PH law",
  },
  PATERNITY_LEAVE: {
    label: "Paternity Leave",
    paid: true,
    salaryStatus: "Employee receives full salary",
    notes: "7 days for married male employees",
  },
  SOLO_PARENT_LEAVE: {
    label: "Solo Parent Leave",
    paid: true,
    salaryStatus: "Employee receives full salary",
    notes: "7 days per year",
  },
  UNPAID_LEAVE: {
    label: "Unpaid Leave (LWOP)",
    paid: false,
    salaryStatus: "No salary for those days",
    notes: "Used when leave balance is zero",
  },
};

export interface UpcomingEvent {
  id: string;
  employeeId: string;
  employeeName: string;
  jobTitle: string;
  type: TimeOffType;
  startDate: string;
  endDate: string;
}

export interface BirthdayEvent {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
}

export interface ScheduleItem {
  id: string;
  date?: string;
  title: string;
  location?: string;
  startTime: string;
  endTime: string;
  type: "meeting" | "interview" | "task" | "other";
}

export const upcomingEvents: UpcomingEvent[] = [
  { id: "ev-1", employeeId: "emp-4", employeeName: "Glean Ramos", jobTitle: "Junior Software Engineer", type: "SICK_LEAVE", startDate: "2025-02-24", endDate: "2025-02-25" },
  { id: "ev-2", employeeId: "emp-5", employeeName: "Kath Domingo", jobTitle: "HR Staff", type: "VACATION_LEAVE", startDate: "2025-02-26", endDate: "2025-02-28" },
  { id: "ev-3", employeeId: "emp-2", employeeName: "Jon Garcia", jobTitle: "Engineering Manager", type: "VACATION_LEAVE", startDate: "2025-02-25", endDate: "2025-02-25" },
];

export const birthdayEvents: BirthdayEvent[] = [
  { id: "b-1", employeeId: "emp-3", employeeName: "Francis Lopez", date: "03-10" },
  { id: "b-2", employeeId: "emp-5", employeeName: "Kath Domingo", date: "05-20" },
];

export const todayScheduleItems: ScheduleItem[] = [
  { id: "s-1", title: "Online interview with UI candidate", location: "Meeting Room 2", startTime: "08:30", endTime: "09:30", type: "interview" },
  { id: "s-2", title: "Replying email to applicants", location: "HR Office", startTime: "09:30", endTime: "10:30", type: "task" },
  { id: "s-3", title: "Weekly team meeting", location: "Conference Room A", startTime: "09:45", endTime: "10:45", type: "meeting" },
  { id: "s-4", title: "Psychology test review", location: "Assessment Center", startTime: "10:45", endTime: "11:15", type: "task" },
];

export const memberWorkHoursMock: { date: string; hours: number; overtime: number }[] = [
  // Monday–Friday of the same week so labels read Mon–Fri
  { date: "2025-02-24", hours: 8, overtime: 0.5 }, // Mon
  { date: "2025-02-25", hours: 7.5, overtime: 0 }, // Tue
  { date: "2025-02-26", hours: 9, overtime: 1 }, // Wed
  { date: "2025-02-27", hours: 8, overtime: 0 }, // Thu
  { date: "2025-02-28", hours: 7, overtime: 0.5 }, // Fri
];

// --- Leave management ---

export type LeaveStatus =
  | "DRAFT"
  | "CREATED"
  | "PENDING_RECORDING"
  | "PENDING_FINALIZATION"
  | "RETURNED_FOR_REVIEW"
  | "PENDING_HR_ADMIN_PROCESSING"
  | "PENDING_HR_ADMIN_PROCESSING_HR_MANAGER"
  | "PENDING_HR_ADMIN_PROCESSING_EXECUTIVE"
  | "PENDING_HR_MANAGER_PROCESSING_HR_ADMIN"
  | "PENDING_HR_STAFF_PROCESSING"
  | "PENDING_HR_STAFF_PROCESSING_AUDITOR"
  | "PENDING_HR_MANAGER_APPROVAL"
  | "PENDING_EXECUTIVE_APPROVAL"
  | "PENDING_EXECUTIVE_BOARD_APPROVAL"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "FINAL_APPROVED"
  | "REJECTED"
  | "APPLIED"
  | "CANCELLED";

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  type: TimeOffType;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  /** Free-form remarks captured during approval/rejection (optional). */
  remarks?: string;
  /** Rejection reason/remarks (optional). */
  rejectionReason?: string;
  /** When returned for review, where it was sent back to. */
  returnedTo?: "HR_STAFF" | "DEPARTMENT_MANAGER" | "HR_ADMIN";
  /** Display name of uploaded supporting document (optional). */
  supportingDocName?: string;
  /** Data URL of the document for preview (optional; stored when submitted, size-limited). */
  supportingDocDataUrl?: string;
  /** Role of the user who submitted the leave request (used for flow visualization). */
  submitterRole?: Role;
  /** True once this request has reduced the employee's pending leave balance. */
  balanceReserved?: boolean;
}

export interface LeaveBalance {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  type: TimeOffType;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  balanceDays: number;
}

export const leaveRequests: LeaveRequest[] = [
  {
    id: "lr-1",
    employeeId: "emp-4",
    employeeName: "Glean Ramos",
    employeeNumber: "EMP-0002",
    type: "SICK_LEAVE",
    startDate: "2025-02-24",
    endDate: "2025-02-25",
    reason: "Flu",
    status: "APPLIED",
    createdAt: "2025-02-23T09:00:00Z",
    approvedBy: "emp-2",
    approvedAt: "2025-02-23T14:00:00Z",
  },
  {
    id: "lr-2",
    employeeId: "emp-5",
    employeeName: "Kath Domingo",
    employeeNumber: "EMP-0005",
    type: "VACATION_LEAVE",
    startDate: "2025-02-26",
    endDate: "2025-02-28",
    reason: "Family trip",
    // HR Staff flow sample: submit → HR Admin processes → HR Manager approves/rejects
    status: "PENDING_HR_ADMIN_PROCESSING",
    createdAt: "2025-02-25T10:30:00Z",
  },
  {
    id: "lr-3",
    employeeId: "emp-2",
    employeeName: "Jon Garcia",
    employeeNumber: "EMP-0003",
    type: "VACATION_LEAVE",
    startDate: "2025-02-25",
    endDate: "2025-02-25",
    reason: "Personal errands",
    status: "APPROVED",
    createdAt: "2025-02-24T08:00:00Z",
    approvedBy: "emp-1",
    approvedAt: "2025-02-24T11:00:00Z",
  },
  {
    id: "lr-4",
    employeeId: "emp-4",
    employeeName: "Glean Ramos",
    employeeNumber: "EMP-0002",
    type: "VACATION_LEAVE",
    startDate: "2025-03-10",
    endDate: "2025-03-14",
    reason: "Vacation",
    status: "CREATED",
    createdAt: "2025-02-26T09:00:00Z",
  },
  {
    id: "lr-5",
    employeeId: "emp-1",
    employeeName: "Clinton Galvez",
    employeeNumber: "EMP-0004",
    type: "VACATION_LEAVE",
    startDate: "2025-03-17",
    endDate: "2025-03-21",
    reason: "Conference attendance",
    status: "APPROVED",
    createdAt: "2025-02-20T14:00:00Z",
    approvedBy: "emp-2",
    approvedAt: "2025-02-21T09:00:00Z",
  },
  {
    id: "lr-6",
    employeeId: "emp-3",
    employeeName: "Francis Lopez",
    employeeNumber: "EMP-0007",
    type: "SICK_LEAVE",
    startDate: "2025-03-03",
    endDate: "2025-03-04",
    reason: "Medical appointment",
    status: "PENDING_APPROVAL",
    createdAt: "2025-02-27T08:15:00Z",
  },
  {
    id: "lr-7",
    employeeId: "emp-5",
    employeeName: "Kath Domingo",
    employeeNumber: "EMP-0005",
    type: "VACATION_LEAVE",
    startDate: "2025-03-05",
    endDate: "2025-03-05",
    reason: "Home maintenance",
    status: "CREATED",
    createdAt: "2025-02-27T11:00:00Z",
  },
  {
    id: "lr-8",
    employeeId: "emp-2",
    employeeName: "Jon Garcia",
    employeeNumber: "EMP-0003",
    type: "VACATION_LEAVE",
    startDate: "2025-03-24",
    endDate: "2025-03-28",
    reason: "Family reunion",
    status: "APPROVED",
    createdAt: "2025-02-22T16:30:00Z",
    approvedBy: "emp-1",
    approvedAt: "2025-02-23T10:00:00Z",
  },
];

export const leaveBalances: LeaveBalance[] = [
  { employeeId: "emp-1", employeeName: "Clinton Galvez", employeeNumber: "EMP-0004", type: "VACATION_LEAVE", totalDays: 15, usedDays: 3, pendingDays: 2, balanceDays: 10 },
  { employeeId: "emp-1", employeeName: "Clinton Galvez", employeeNumber: "EMP-0004", type: "SICK_LEAVE", totalDays: 10, usedDays: 1, pendingDays: 0, balanceDays: 9 },
  { employeeId: "emp-2", employeeName: "Jon Garcia", employeeNumber: "EMP-0003", type: "VACATION_LEAVE", totalDays: 15, usedDays: 5, pendingDays: 0, balanceDays: 10 },
  { employeeId: "emp-2", employeeName: "Jon Garcia", employeeNumber: "EMP-0003", type: "SICK_LEAVE", totalDays: 10, usedDays: 0, pendingDays: 0, balanceDays: 10 },
  { employeeId: "emp-3", employeeName: "Francis Lopez", employeeNumber: "EMP-0007", type: "VACATION_LEAVE", totalDays: 15, usedDays: 8, pendingDays: 0, balanceDays: 7 },
  { employeeId: "emp-3", employeeName: "Francis Lopez", employeeNumber: "EMP-0007", type: "SICK_LEAVE", totalDays: 10, usedDays: 2, pendingDays: 0, balanceDays: 8 },
  { employeeId: "emp-4", employeeName: "Glean Ramos", employeeNumber: "EMP-0002", type: "VACATION_LEAVE", totalDays: 15, usedDays: 0, pendingDays: 5, balanceDays: 10 },
  { employeeId: "emp-4", employeeName: "Glean Ramos", employeeNumber: "EMP-0002", type: "SICK_LEAVE", totalDays: 10, usedDays: 2, pendingDays: 0, balanceDays: 8 },
  { employeeId: "emp-5", employeeName: "Kath Domingo", employeeNumber: "EMP-0005", type: "VACATION_LEAVE", totalDays: 15, usedDays: 2, pendingDays: 3, balanceDays: 10 },
  { employeeId: "emp-5", employeeName: "Kath Domingo", employeeNumber: "EMP-0005", type: "SICK_LEAVE", totalDays: 10, usedDays: 0, pendingDays: 0, balanceDays: 10 },
];

export function getLeaveRequestsByStatus(status: LeaveStatus): LeaveRequest[] {
  return leaveRequests.filter((r) => r.status === status);
}

export function getLeaveBalancesByEmployee(employeeId: string): LeaveBalance[] {
  return leaveBalances.filter((b) => b.employeeId === employeeId);
}
