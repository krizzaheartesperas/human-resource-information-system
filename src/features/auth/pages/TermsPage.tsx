"use client";

import Link from "next/link";
import { ThemeLogo } from "@/components/ui/theme-logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function TermsPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/company-bg.png')" }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-slate-900/90" aria-hidden />
      <div className="absolute inset-0 bg-brand-deep/20" aria-hidden />
      <Card className="w-full max-w-2xl relative z-10 shadow-xl border-border/80 max-h-[90vh] overflow-auto scrollbar-hide">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-2">
            <ThemeLogo width={64} height={64} />
          </div>
          <CardTitle className="text-2xl font-semibold tracking-tight text-center">
            Terms and conditions
          </CardTitle>
          <CardDescription className="text-center">
            Workzen HRIS
          </CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <p className="text-muted-foreground">
            These demo terms describe how Workzen HRIS may be used inside your
            organization. Replace this text with your real company policy
            before going live.
          </p>

          <h2>1. Purpose of the system</h2>
          <p>
            Workzen HRIS is provided to support HR operations such as employee
            records, attendance, leave management, workflow requests, and audit
            reporting. The system is intended for legitimate business use only
            by authorized employees and contractors.
          </p>

          <h2>2. Acceptable use</h2>
          <ul>
            <li>Access only the information you need to perform your job.</li>
            <li>
              Do not share your account credentials or use another person&apos;s
              account.
            </li>
            <li>
              Do not upload content that is unlawful, harmful, or violates
              company policies.
            </li>
            <li>
              Do not attempt to bypass security controls or interfere with
              system operation.
            </li>
          </ul>

          <h2>3. Data privacy and confidentiality</h2>
          <p>
            HR data in Workzen HRIS may include personal and sensitive
            information. You must handle this data confidentially and in line
            with applicable privacy laws and internal policies. Only HR, system
            administrators, and authorized managers may view or process certain
            records such as salary, performance, and disciplinary history.
          </p>

          <h2>4. Roles and responsibility</h2>
          <ul>
            <li>
              <strong>Super Admin / System Admin</strong> manages system
              configuration, roles, and integrations.
            </li>
            <li>
              <strong>HR roles</strong> (HR Administrator, HR Manager, HR
              Staff) manage employee data and HR workflows.
            </li>
            <li>
              <strong>Managers</strong> use HRIS for team approvals and
              reporting.
            </li>
            <li>
              <strong>Employees</strong> use self‑service features for their
              own profiles, requests, and documents.
            </li>
          </ul>

          <h2>5. Monitoring and audit</h2>
          <p>
            System activity may be logged for security, compliance, and support
            purposes. This can include sign‑ins, approvals, data changes, and
            configuration updates. Audit and compliance users may review these
            logs where necessary.
          </p>

          <h2>6. Data retention and backups</h2>
          <p>
            HR records may be retained and backed up in accordance with company
            policy and legal requirements. In this demo environment, data may
            be reset or deleted at any time and should not be used for real
            production records.
          </p>

          <h2>7. Disclaimer</h2>
          <p>
            This environment is for demonstration and training purposes only.
            It does not constitute legal advice. Always consult your legal and
            HR teams when drafting your official terms of service.
          </p>

          <div className="mt-6">
            <Link href="/login">
              <Button variant="outline">Back to sign in</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
