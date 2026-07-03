/**
 * Demo payroll / payslip data (Glean Ramos, EMP-0002) — replace with API later.
 */

export type PayslipListItem = {
  id: string;
  payPeriodLabel: string;
  payrollDate: string;
  netPay: number;
  status: "Paid" | "Processing";
  year: number;
  month: number;
  half: "first" | "second";
};

export type PayslipDetail = {
  companyName: string;
  companyAddress: string;
  employeeName: string;
  employeeDisplayId: string;
  position: string;
  department: string;
  dateHired: string;
  payPeriodTitle: string;
  cutoffLabel: string;
  workedDays: number;
  earnings: { label: string; amount: number }[];
  deductions: { label: string; amount: number }[];
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  netPayInWords: string;
};

/** Table row for payroll export preview (PH demo). */
export type PayrollPreviewRow = {
  employeeId: string;
  name: string;
  basicPay: number;
  overtime: number;
  allowances: number;
  deductions: number;
  netPay: number;
  flags?: ("missing" | "zero" | "adjusted")[];
};

export const GLEAN_PAYS_DISPLAY = {
  employeeId: "EMP-0002",
  name: "Glean Ramos",
  position: "Junior Software Engineer",
  department: "Information Technology",
};

export const PAYSLIPS: PayslipListItem[] = [
  {
    id: "2025-02-p1",
    payPeriodLabel: "Feb 1–15",
    payrollDate: "Feb 15, 2025",
    netPay: 9500,
    status: "Paid",
    year: 2025,
    month: 2,
    half: "first",
  },
  {
    id: "2025-01-p2",
    payPeriodLabel: "Jan 16–31",
    payrollDate: "Jan 31, 2025",
    netPay: 8800,
    status: "Paid",
    year: 2025,
    month: 1,
    half: "second",
  },
  {
    id: "2025-01-p1",
    payPeriodLabel: "Jan 1–15",
    payrollDate: "Jan 15, 2025",
    netPay: 8650,
    status: "Paid",
    year: 2025,
    month: 1,
    half: "first",
  },
];

const PAYSLIP_DETAILS: Record<string, PayslipDetail> = {
  "2025-02-p1": {
    companyName: "Workzen Inc",
    companyAddress: "21023 Pearson Point Road, Gateway Avenue",
    employeeName: "Glean Ramos",
    employeeDisplayId: "EMP-0002",
    position: "Junior Software Engineer",
    department: "Information Technology",
    dateHired: "2021-02-01",
    payPeriodTitle: "February 1–15, 2025",
    cutoffLabel: "Jan 26 – Feb 10",
    workedDays: 26,
    earnings: [
      { label: "Basic Pay", amount: 10000 },
      { label: "Incentives", amount: 1000 },
      { label: "Allowances", amount: 600 },
      { label: "Overtime", amount: 2556.25 },
    ],
    deductions: [
      { label: "SSS", amount: 1200 },
      { label: "PhilHealth", amount: 400 },
      { label: "Pag-IBIG", amount: 200 },
      { label: "Tax", amount: 6066.75 },
      { label: "Loans", amount: 400 },
    ],
    grossPay: 14156.25,
    totalDeductions: 8266.75,
    netPay: 9500,
    netPayInWords: "Nine Thousand Five Hundred Pesos",
  },
  "2025-01-p2": {
    companyName: "Workzen Inc",
    companyAddress: "21023 Pearson Point Road, Gateway Avenue",
    employeeName: "Glean Ramos",
    employeeDisplayId: "EMP-0002",
    position: "Junior Software Engineer",
    department: "Information Technology",
    dateHired: "2021-02-01",
    payPeriodTitle: "January 16–31, 2025",
    cutoffLabel: "Jan 1 – Jan 15",
    workedDays: 24,
    earnings: [
      { label: "Basic Pay", amount: 10000 },
      { label: "Incentives", amount: 800 },
      { label: "Allowances", amount: 600 },
      { label: "Overtime", amount: 1200 },
    ],
    deductions: [
      { label: "SSS", amount: 1200 },
      { label: "PhilHealth", amount: 400 },
      { label: "Pag-IBIG", amount: 200 },
      { label: "Tax", amount: 5000 },
      { label: "Loans", amount: 400 },
    ],
    grossPay: 12600,
    totalDeductions: 7200,
    netPay: 8800,
    netPayInWords: "Eight Thousand Eight Hundred Pesos",
  },
  "2025-01-p1": {
    companyName: "Workzen Inc",
    companyAddress: "21023 Pearson Point Road, Gateway Avenue",
    employeeName: "Glean Ramos",
    employeeDisplayId: "EMP-0002",
    position: "Junior Software Engineer",
    department: "Information Technology",
    dateHired: "2021-02-01",
    payPeriodTitle: "January 1–15, 2025",
    cutoffLabel: "Dec 16 – Dec 31",
    workedDays: 22,
    earnings: [
      { label: "Basic Pay", amount: 10000 },
      { label: "Incentives", amount: 500 },
      { label: "Allowances", amount: 600 },
      { label: "Overtime", amount: 800 },
    ],
    deductions: [
      { label: "SSS", amount: 1200 },
      { label: "PhilHealth", amount: 400 },
      { label: "Pag-IBIG", amount: 200 },
      { label: "Tax", amount: 4650 },
      { label: "Loans", amount: 400 },
    ],
    grossPay: 11900,
    totalDeductions: 6850,
    netPay: 8650,
    netPayInWords: "Eight Thousand Six Hundred Fifty Pesos",
  },
};

export function getPayslipById(id: string): PayslipDetail | null {
  return PAYSLIP_DETAILS[id] ?? null;
}

export function getPayslipListItem(id: string): PayslipListItem | undefined {
  return PAYSLIPS.find((p) => p.id === id);
}

/** Preview rows for export validation (includes Glean + sample rows). */
export function getPayrollPreviewRows(): PayrollPreviewRow[] {
  return [
    {
      employeeId: "EMP-0002",
      name: "Glean Ramos",
      basicPay: 10000,
      overtime: 2556.25,
      allowances: 1600,
      deductions: 8266.75,
      netPay: 9500,
      flags: ["adjusted"],
    },
    {
      employeeId: "EMP-0142",
      name: "Ana Reyes",
      basicPay: 18000,
      overtime: 0,
      allowances: 2000,
      deductions: 6200,
      netPay: 13800,
      flags: [],
    },
    {
      employeeId: "EMP-0099",
      name: "Marco Dizon",
      basicPay: 22000,
      overtime: 3200,
      allowances: 1500,
      deductions: 9100,
      netPay: 18600,
      flags: ["zero"],
    },
  ];
}

export type PayrollPeriodOption = { value: string; label: string; start: string; end: string };

export const PAYROLL_PERIOD_OPTIONS: PayrollPeriodOption[] = [
  { value: "2026-03-2h", label: "March 2026 · 2nd half (16–31)", start: "2026-03-16", end: "2026-03-31" },
  { value: "2026-03-1h", label: "March 2026 · 1st half (1–15)", start: "2026-03-01", end: "2026-03-15" },
  { value: "2026-02-2h", label: "February 2026 · 2nd half (16–28)", start: "2026-02-16", end: "2026-02-28" },
  { value: "2026-02-1h", label: "February 2026 · 1st half (1–15)", start: "2026-02-01", end: "2026-02-15" },
];
