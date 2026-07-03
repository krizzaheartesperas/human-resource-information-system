export interface HandbookSubSection {
  title: string;
  content: string | string[];
}

export interface HandbookSection {
  id: string;
  title: string;
  description?: string;
  content?: string | string[];
  subsections?: HandbookSubSection[];
  infoBlock?: {
    version: string;
    effectiveDate: string;
    lastUpdated: string;
  };
  faqs?: { question: string; answer: string }[];
}

export const HANDBOOK_CONTENT: HandbookSection[] = [
  {
    id: "overview",
    title: "Employee Handbook Overview",
    content: [
      "This handbook serves as the official guide for employees regarding company policies, workplace expectations, standard procedures, and employee responsibilities.",
      "It is designed to help employees understand the rules, processes, and standards followed within the organization. All employees are expected to read and follow the contents of this handbook.",
      "This handbook applies to all company users and employee roles within the HRIS, including:",
    ],
    subsections: [
      {
        title: "Applicable Roles",
        content: [
          "Regular Employees",
          "HR Staff",
          "HR Admin",
          "Department Managers",
          "HR Managers",
          "Executives",
          "Auditors",
          "System Admin",
        ],
      },
    ],
    infoBlock: {
      version: "v2.1.0",
      effectiveDate: "January 01, 2026",
      lastUpdated: "April 15, 2026",
    },
  },
  {
    id: "company-policies",
    title: "Company Policies",
    subsections: [
      {
        title: "Code of Conduct",
        content: [
          "All employees must maintain professionalism in behavior, communication, and appearance while performing work-related duties.",
          "Respect must be shown to co-workers, managers, clients, and all stakeholders.",
          "Employees must avoid misconduct, abusive language, harassment, discrimination, and any form of inappropriate workplace behavior.",
          "Company resources, records, and systems must be used responsibly and only for authorized purposes.",
          "Employees are expected to act with honesty, integrity, and accountability at all times.",
        ],
      },
      {
        title: "Workplace Behavior",
        content: [
          "Employees must help maintain a safe, respectful, and productive workplace.",
          "Bullying, intimidation, and disruptive conduct are not allowed.",
          "Confidential discussions, records, and internal matters must not be disclosed without authorization.",
          "Employees must follow lawful instructions from authorized supervisors and managers.",
          "All workplace issues should be reported properly through HR or the appropriate reporting channel.",
        ],
      },
      {
        title: "Ethics and Compliance",
        content: [
          "Employees must comply with company rules, internal procedures, and applicable legal requirements.",
          "Fraud, falsification of records, and misuse of authority are strictly prohibited.",
          "Conflicts of interest must be disclosed to HR or management immediately.",
          "Employees must protect confidential information related to the company and its employees.",
          "Violations of policy may result in disciplinary action based on company procedure.",
        ],
      },
    ],
  },
  {
    id: "employment-policies",
    title: "Employment Policies",
    subsections: [
      {
        title: "Employee Classification",
        content: [
          "Regular Employees – employees who have successfully completed required probationary or hiring conditions and are officially part of the company workforce.",
          "Probationary Employees – employees under evaluation for regularization based on company standards.",
          "Contract-based Employees – employees engaged for a defined duration, project, or service agreement.",
        ],
      },
      {
        title: "Promotion Policy",
        content: [
          "Promotion requests must follow the official workflow process in the HRIS.",
          "Promotions are based on performance, qualifications, business need, and approval from authorized approvers.",
          "Promotion details must be properly documented before approval and effectivity.",
          "No promotion should take effect without final approval and proper recording in employee history.",
        ],
      },
      {
        title: "Transfer and Role Change Policy",
        content: [
          "Transfer requests are used for changes in team, location, or assignment while remaining under the same department and role structure when applicable.",
          "Role Change applies when an employee’s position or title changes within the same department.",
          "Department changes that involve a new role or position must follow the proper workflow and approval process.",
          "All approved changes must be reflected in employee records and employment history.",
        ],
      },
      {
        title: "Salary Change Policy",
        content: [
          "Salary changes must be properly requested, reviewed, and approved before implementation.",
          "Compensation changes must include the reason, effective date, and approved rate.",
          "Unauthorized salary adjustments are not allowed.",
          "Approved salary updates must be recorded in compensation history.",
        ],
      },
      {
        title: "Manager Change Policy",
        content: [
          "Changes in reporting manager must be validated and approved through the correct workflow.",
          "Employees must always have a valid reporting manager assigned when required by organizational structure.",
          "Manager assignments must remain aligned with department and role hierarchy.",
        ],
      },
    ],
  },
  {
    id: "time-attendance",
    title: "Time & Attendance",
    subsections: [
      {
        title: "Working Hours",
        content: [
          "Employees must follow their assigned work schedule and attendance rules.",
          "Clock-in and clock-out entries must be recorded using the official attendance or timekeeping process.",
          "Repeated tardiness, unexcused absences, or attendance issues may be subject to review.",
        ],
      },
      {
        title: "Attendance Recording",
        content: [
          "Daily attendance must be captured accurately through the designated system or process.",
          "Employees are responsible for checking that their time entries are correct.",
          "Attendance discrepancies should be reported immediately to the appropriate personnel.",
        ],
      },
      {
        title: "Overtime Policy",
        content: [
          "Overtime work must be requested and approved based on company rules before or according to internal process.",
          "Only approved overtime may be eligible for recording and compensation, depending on policy.",
          "All overtime records must be tracked within the HRIS overtime process.",
        ],
      },
      {
        title: "Leave Policy",
        content: [
          "Leave requests must be submitted through the proper HRIS workflow.",
          "Leave approval is subject to manager review, HR rules, and available leave balance where applicable.",
          "Employees must provide required details and supporting documents when necessary.",
          "Unapproved leave may be treated according to attendance policy.",
        ],
      },
    ],
  },
  {
    id: "offboarding",
    title: "Offboarding",
    subsections: [
      {
        title: "Resignation Policy",
        content: [
          "Employees must submit resignation through the HRIS exit request form or authorized resignation process.",
          "The standard notice period is 30 calendar days unless a different arrangement is approved by management.",
          "Employees must continue to perform duties responsibly during the notice period unless otherwise instructed.",
          "Final separation is subject to clearance completion and company exit requirements.",
        ],
      },
      {
        title: "Handover Guidelines",
        content: [
          "Employees must document active tasks, projects, deadlines, and pending responsibilities before their final working day.",
          "Files, references, credentials, and work-related materials must be endorsed to the assigned replacement or authorized personnel.",
          "Handover must be reviewed and confirmed by the reporting manager or designated approver.",
        ],
      },
      {
        title: "Clearance Process",
        content: [
          "Offboarding may include HR clearance, manager clearance, IT clearance, finance clearance, and asset return requirements.",
          "Employees must complete all required tasks before final clearance can be marked complete.",
          "Missing assets, unresolved obligations, or incomplete tasks may delay completion of the offboarding process.",
        ],
      },
      {
        title: "Final Pay and Exit Processing",
        content: [
          "Final pay processing is subject to payroll cutoff, clearance completion, and company policy.",
          "Exit documents and related records must be completed before closure of the employee record where required.",
          "Account deactivation and access removal are coordinated after approved offboarding actions.",
        ],
      },
    ],
  },
  {
    id: "it-security",
    title: "IT & Security",
    subsections: [
      {
        title: "Account Responsibility",
        content: [
          "Employees are responsible for protecting their login credentials and must not share passwords with other users.",
          "Each employee must use only the account assigned to them.",
          "Shared, unauthorized, or borrowed access is not allowed unless formally approved by the system owner or admin.",
        ],
      },
      {
        title: "Acceptable System Use",
        content: [
          "Company systems including HRIS, Payroll, Recruitment, and Project Management must be used only for authorized work purposes.",
          "Users must not misuse data, alter records without authorization, or attempt to access restricted information.",
          "All actions in the system may be logged for audit and security purposes.",
        ],
      },
      {
        title: "Data Privacy and Confidentiality",
        content: [
          "Employee data, payroll data, and company records must be treated as confidential.",
          "Access to records must follow role-based permissions.",
          "Users must not export, copy, or distribute confidential records without proper authority.",
        ],
      },
      {
        title: "Access Removal",
        content: [
          "User access may be updated, disabled, or removed when employment status changes or when approved by HR and System Admin.",
          "Account deactivation is part of the offboarding and security control process.",
          "System Admin is responsible for implementing approved account changes in coordination with HR.",
        ],
      },
    ],
  },
  {
    id: "faqs",
    title: "Frequently Asked Questions",
    faqs: [
      {
        question: "When is my final pay processed?",
        answer: "Final pay is processed based on the company payroll cutoff, completion of required clearances, and internal exit procedures.",
      },
      {
        question: "Who handles account deactivation?",
        answer: "System Admin handles account deactivation, access updates, or account removal after receiving the approved request from HR or the authorized department.",
      },
      {
        question: "Where can I track my offboarding progress?",
        answer: "You can track your progress in the My Offboarding module, where status updates, checklists, and clearance progress are shown.",
      },
      {
        question: "Where do I file resignation?",
        answer: "Resignation should be filed through the HRIS exit request form or the official resignation workflow implemented in the system.",
      },
      {
        question: "Can I request overtime in the system?",
        answer: "Yes, overtime requests should be submitted through the overtime request process in the My Time section, subject to approval rules.",
      },
      {
        question: "Who approves employment changes such as promotion, transfer, or salary change?",
        answer: "Approval depends on the configured workflow, which may include manager review, HR review, and other authorized approvers.",
      },
    ],
  },
  {
    id: "acknowledgment",
    title: "Employee Acknowledgment",
    content: [
      "I confirm that I have read, understood, and agreed to follow the policies, procedures, and guidelines stated in this Employee Handbook.",
      "I understand that the company may update handbook content, policies, and procedures when necessary, and that employees are expected to stay informed of official updates.",
    ],
  },
];
