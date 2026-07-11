"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  FileText, 
  Calendar, 
  Briefcase, 
  MessageSquare, 
  AlertTriangle, 
  CheckCircle2, 
  Upload, 
  Info,
  Laptop,
  CreditCard,
  Smartphone,
  Monitor,
  ArrowLeft,
} from "lucide-react";
import type { CurrentUser } from "@/lib/mock";

export type ExitRequestFormValues = {
  requestType: string;
  submissionDate: string;
  employeeName: string;
  employeeId: string;
  department: string;
  position: string;
  reportingManager: string;
  preferredExitDate: string;
  lastWorkingDay: string;
  noticePeriod: string;
  reasonForExit: string;
  detailedExplanation: string;
  activeProjects: string;
  pendingDeliverables: string;
  suggestedHandoverPerson: string;
  handoverNotes: string;
  assetsInPossession: string[];
  needImmediateExit: boolean;
  immediateExitJustification: string;
  contactNumberAfterExit: string;
  personalEmail: string;
  forwardingNotes: string;
  ackInfoCorrect: boolean;
  ackSubjectToReview: boolean;
  ackFinalPayClearance: boolean;
};

interface ExitRequestFormProps {
  user: CurrentUser;
  onClose: () => void;
  onSubmitSuccess: (values: ExitRequestFormValues) => void;
  initialValues?: Partial<ExitRequestFormValues>;
}

export function ExitRequestForm({ user, onClose, onSubmitSuccess, initialValues }: ExitRequestFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Form State
  const [formData, setFormData] = useState<ExitRequestFormValues>({
    // Section 1: Request Information (Read-only mostly)
    requestType: "Resignation",
    submissionDate: new Date().toLocaleDateString(),
    employeeName: user?.name || "Krizza Heart",
    employeeId: user?.employeeId || "EMP-2024-0512",
    department: user?.departmentId || "Product Development",
    position: user?.jobTitle || "Senior Frontend Developer",
    reportingManager: "Michael Scott", // Mock

    // Section 2: Exit Details
    preferredExitDate: "",
    lastWorkingDay: "",
    noticePeriod: "30 days",
    reasonForExit: "",
    detailedExplanation: "",

    // Section 3: Handover Details
    activeProjects: "",
    pendingDeliverables: "",
    suggestedHandoverPerson: "",
    handoverNotes: "",
    assetsInPossession: [] as string[],

    // Section 4: Supporting Information
    needImmediateExit: false,
    immediateExitJustification: "",
    contactNumberAfterExit: "",
    personalEmail: "",
    forwardingNotes: "",

    // Section 5: Acknowledgment
    ackInfoCorrect: false,
    ackSubjectToReview: false,
    ackFinalPayClearance: false,
    ...initialValues,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when field is edited
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleAssetToggle = (asset: string) => {
    setFormData(prev => {
      const current = prev.assetsInPossession;
      if (current.includes(asset)) {
        return { ...prev, assetsInPossession: current.filter(a => a !== asset) };
      } else {
        return { ...prev, assetsInPossession: [...current, asset] };
      }
    });
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.preferredExitDate) newErrors.preferredExitDate = "Preferred Exit Date is required";
    if (!formData.lastWorkingDay) newErrors.lastWorkingDay = "Last Working Day is required";
    if (!formData.detailedExplanation) newErrors.detailedExplanation = "Detailed explanation is required";
    if (!formData.activeProjects) newErrors.activeProjects = "Active projects/tasks are required";
    if (!formData.pendingDeliverables) newErrors.pendingDeliverables = "Pending deliverables are required";
    if (!formData.handoverNotes) newErrors.handoverNotes = "Handover notes are required";
    
    if ((formData.noticePeriod === "Immediate" || formData.noticePeriod === "Custom") && !formData.detailedExplanation) {
      newErrors.detailedExplanation = "Explanation is required for immediate or custom notice periods";
    }

    if (formData.needImmediateExit && !formData.immediateExitJustification) {
      newErrors.immediateExitJustification = "Justification is required for immediate exit requests";
    }

    if (!formData.ackInfoCorrect || !formData.ackSubjectToReview || !formData.ackFinalPayClearance) {
      newErrors.acknowledgment = "Please acknowledge all statements";
    }

    // Date validation
    if (formData.preferredExitDate) {
      const exitDate = new Date(formData.preferredExitDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (exitDate < today) {
        newErrors.preferredExitDate = "Preferred exit date cannot be in the past";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsSubmitting(false);
    setIsSubmitted(true);
    
    setTimeout(() => {
      onSubmitSuccess(formData);
    }, 1800);
  };

  if (isSubmitted) {
    return (
      <div className="flex min-h-[600px] items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500">
        <div className="max-w-md space-y-6">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20">
            <CheckCircle2 className="size-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold text-[#1B2447] dark:text-white">Request Submitted!</h2>
            <p className="text-muted-foreground">Your exit request has been successfully filed. It is now pending review by your manager and HR.</p>
          </div>
          <div className="rounded-md bg-slate-50 p-6 text-left space-y-4 dark:bg-white/5">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-muted-foreground">Request ID</span>
              <span className="font-mono text-sm font-semibold">REQ-EXIT-2025-001</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-muted-foreground">Status</span>
              <StatusBadge status="Pending" />
            </div>
          </div>
          <Button onClick={onClose} className="w-full h-12 rounded-md bg-[#FFE14E] font-semibold text-[#1B2447] hover:bg-[#F7D93C]">
            Return to Offboarding
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8 animate-in slide-in-from-bottom-4 duration-700">
      {/* Header Area */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <button 
            onClick={onClose}
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-[#1B2447] transition-colors mb-4 group"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
            Back to Overview
          </button>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1B2447] dark:text-white">Submit Exit Request</h1>
          <p className="text-muted-foreground font-medium">Please provide the necessary details to begin your offboarding process.</p>
        </div>
      </div>

      {/* Policy Banner */}
      <div className="rounded-md bg-amber-50 border border-amber-200/50 p-4 flex items-start gap-4 dark:bg-amber-500/10 dark:border-amber-500/20">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-600 dark:bg-amber-500/20">
          <Info className="size-5" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-amber-900 dark:text-amber-400">Exit Policy Reminder</h3>
          <p className="text-sm text-amber-800/80 dark:text-amber-400/80 leading-relaxed font-medium">
            Standard notice period is <strong className="font-semibold underline decoration-amber-500/30">30 calendar days</strong> unless otherwise approved by HR and your Reporting Manager.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 pb-20">
        
        {/* 1. REQUEST INFORMATION */}
        <Card className="rounded-xl border-none shadow-xl shadow-slate-200/50 dark:shadow-none dark:bg-[#161b30]">
          <CardHeader className="border-b border-border/50 pb-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-[#1B2447] text-[#FFE14E]">
                <FileText className="size-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold tracking-tight">1. Request Information</CardTitle>
                <CardDescription className="font-medium">General request and employee profile details.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-8 space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="requestType" className="font-semibold text-slate-500 uppercase tracking-widest text-[10px]">Request Type</Label>
                <select 
                  id="requestType"
                  name="requestType"
                  value={formData.requestType}
                  onChange={handleInputChange}
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-medium"
                >
                  <option>Resignation</option>
                  <option>Retirement</option>
                  <option>End of Contract</option>
                  <option>Immediate Resignation</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold text-slate-500 uppercase tracking-widest text-[10px]">Submission Date</Label>
                <Input value={formData.submissionDate} readOnly className="h-11 rounded-md bg-slate-50 dark:bg-white/5 font-medium border-transparent" />
              </div>
            </div>

            <Separator className="bg-slate-100 dark:bg-white/5" />

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label className="font-semibold text-slate-500 uppercase tracking-widest text-[10px]">Employee Name</Label>
                <Input value={formData.employeeName} readOnly className="h-11 rounded-md bg-slate-50 dark:bg-white/5 font-medium border-transparent" />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold text-slate-500 uppercase tracking-widest text-[10px]">Employee ID</Label>
                <Input value={formData.employeeId} readOnly className="h-11 rounded-md bg-slate-50 dark:bg-white/5 font-medium border-transparent" />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold text-slate-500 uppercase tracking-widest text-[10px]">Department</Label>
                <Input value={formData.department} readOnly className="h-11 rounded-md bg-slate-50 dark:bg-white/5 font-medium border-transparent" />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold text-slate-500 uppercase tracking-widest text-[10px]">Position / Role</Label>
                <Input value={formData.position} readOnly className="h-11 rounded-md bg-slate-50 dark:bg-white/5 font-medium border-transparent" />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold text-slate-500 uppercase tracking-widest text-[10px]">Reporting Manager</Label>
                <Input value={formData.reportingManager} readOnly className="h-11 rounded-md bg-slate-50 dark:bg-white/5 font-medium border-transparent" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. EXIT DETAILS */}
        <Card className="rounded-xl border-none shadow-xl shadow-slate-200/50 dark:shadow-none dark:bg-[#161b30]">
          <CardHeader className="border-b border-border/50 pb-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-amber-500 text-white">
                <Calendar className="size-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold tracking-tight">2. Exit Details</CardTitle>
                <CardDescription className="font-medium">Specify your transition dates and reasons.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-8 space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="preferredExitDate" className="font-semibold text-slate-500 uppercase tracking-widest text-[10px]">
                  Preferred Exit Date <span className="text-destructive font-semibold">*</span>
                </Label>
                <Input 
                  type="date" 
                  id="preferredExitDate"
                  name="preferredExitDate"
                  value={formData.preferredExitDate}
                  onChange={handleInputChange}
                  className={cn("h-11 rounded-md font-medium", errors.preferredExitDate && "border-destructive")}
                />
                {errors.preferredExitDate && <p className="text-[10px] font-semibold text-destructive uppercase tracking-widest">{errors.preferredExitDate}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastWorkingDay" className="font-semibold text-slate-500 uppercase tracking-widest text-[10px]">
                  Last Working Day <span className="text-destructive font-semibold">*</span>
                </Label>
                <Input 
                  type="date" 
                  id="lastWorkingDay"
                  name="lastWorkingDay"
                  value={formData.lastWorkingDay}
                  onChange={handleInputChange}
                  className={cn("h-11 rounded-md font-medium", errors.lastWorkingDay && "border-destructive")}
                />
                {errors.lastWorkingDay && <p className="text-[10px] font-semibold text-destructive uppercase tracking-widest">{errors.lastWorkingDay}</p>}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="noticePeriod" className="font-semibold text-slate-500 uppercase tracking-widest text-[10px]">Notice Period</Label>
                <select 
                  id="noticePeriod"
                  name="noticePeriod"
                  value={formData.noticePeriod}
                  onChange={handleInputChange}
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-medium"
                >
                  <option>30 days</option>
                  <option>60 days</option>
                  <option>Immediate</option>
                  <option>Custom</option>
                </select>
                <p className="text-[10px] text-muted-foreground font-medium">Standard policy is 30 days.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reasonForExit" className="font-semibold text-slate-500 uppercase tracking-widest text-[10px]">Reason for Exit</Label>
                <select 
                  id="reasonForExit"
                  name="reasonForExit"
                  value={formData.reasonForExit}
                  onChange={handleInputChange}
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-medium"
                >
                  <option value="">Select a reason</option>
                  <option>Personal Reasons</option>
                  <option>Career Growth</option>
                  <option>Compensation</option>
                  <option>Health Reasons</option>
                  <option>Family Reasons</option>
                  <option>Relocation</option>
                  <option>Retirement</option>
                  <option>Contract Completion</option>
                  <option>Other</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="detailedExplanation" className="font-semibold text-slate-500 uppercase tracking-widest text-[10px]">
                Detailed Explanation <span className="text-destructive font-semibold">*</span>
              </Label>
              <textarea 
                id="detailedExplanation"
                name="detailedExplanation"
                value={formData.detailedExplanation}
                onChange={handleInputChange}
                placeholder="Please explain the reason for your exit in detail..."
                className={cn(
                  "flex min-h-[120px] w-full rounded-md border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-medium",
                  errors.detailedExplanation && "border-destructive"
                )}
              />
              {errors.detailedExplanation && <p className="text-[10px] font-semibold text-destructive uppercase tracking-widest">{errors.detailedExplanation}</p>}
            </div>
          </CardContent>
        </Card>

        {/* 3. HANDOVER DETAILS */}
        <Card className="rounded-xl border-none shadow-xl shadow-slate-200/50 dark:shadow-none dark:bg-[#161b30]">
          <CardHeader className="border-b border-border/50 pb-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-indigo-500 text-white">
                <Briefcase className="size-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold tracking-tight">3. Handover Details</CardTitle>
                <CardDescription className="font-medium">Outline your responsibilities and asset return.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-8 space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="activeProjects" className="font-semibold text-slate-500 uppercase tracking-widest text-[10px]">
                  Current Active Projects / Tasks <span className="text-destructive font-semibold">*</span>
                </Label>
                <textarea 
                  id="activeProjects"
                  name="activeProjects"
                  value={formData.activeProjects}
                  onChange={handleInputChange}
                  className={cn(
                    "flex min-h-[100px] w-full rounded-md border border-input bg-background px-4 py-3 text-sm ring-offset-background font-medium",
                    errors.activeProjects && "border-destructive"
                  )}
                />
                {errors.activeProjects && <p className="text-[10px] font-semibold text-destructive uppercase tracking-widest">{errors.activeProjects}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="pendingDeliverables" className="font-semibold text-slate-500 uppercase tracking-widest text-[10px]">
                  Pending Deliverables <span className="text-destructive font-semibold">*</span>
                </Label>
                <textarea 
                  id="pendingDeliverables"
                  name="pendingDeliverables"
                  value={formData.pendingDeliverables}
                  onChange={handleInputChange}
                  className={cn(
                    "flex min-h-[100px] w-full rounded-md border border-input bg-background px-4 py-3 text-sm ring-offset-background font-medium",
                    errors.pendingDeliverables && "border-destructive"
                  )}
                />
                {errors.pendingDeliverables && <p className="text-[10px] font-semibold text-destructive uppercase tracking-widest">{errors.pendingDeliverables}</p>}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="suggestedHandoverPerson" className="font-semibold text-slate-500 uppercase tracking-widest text-[10px]">Suggested Handover Person</Label>
                <Input 
                  id="suggestedHandoverPerson"
                  name="suggestedHandoverPerson"
                  placeholder="Name or Employee ID"
                  value={formData.suggestedHandoverPerson}
                  onChange={handleInputChange}
                  className="h-11 rounded-md font-medium"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="handoverNotes" className="font-semibold text-slate-500 uppercase tracking-widest text-[10px]">
                  Handover Notes <span className="text-destructive font-semibold">*</span>
                </Label>
                <textarea 
                  id="handoverNotes"
                  name="handoverNotes"
                  value={formData.handoverNotes}
                  onChange={handleInputChange}
                  className={cn(
                    "flex min-h-[100px] w-full rounded-md border border-input bg-background px-4 py-3 text-sm ring-offset-background font-medium",
                    errors.handoverNotes && "border-destructive"
                  )}
                />
                {errors.handoverNotes && <p className="text-[10px] font-semibold text-destructive uppercase tracking-widest">{errors.handoverNotes}</p>}
              </div>
            </div>

            <div className="space-y-4">
              <Label className="font-semibold text-slate-500 uppercase tracking-widest text-[10px]">Company Assets in Possession</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {[
                  { id: "Laptop", icon: <Laptop className="size-4" /> },
                  { id: "Company ID", icon: <CreditCard className="size-4" /> },
                  { id: "Monitor", icon: <Monitor className="size-4" /> },
                  { id: "Phone", icon: <Smartphone className="size-4" /> },
                  { id: "Access Card", icon: <CreditCard className="size-4" /> },
                ].map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => handleAssetToggle(asset.id)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 rounded-md p-4 border transition-all",
                      formData.assetsInPossession.includes(asset.id)
                        ? "bg-[#FFE14E]/10 border-[#FFE14E] text-[#1B2447] dark:text-[#FFE14E]"
                        : "bg-slate-50 border-slate-100 text-slate-500 dark:bg-white/5 dark:border-white/5"
                    )}
                  >
                    <div className={cn(
                      "flex size-8 items-center justify-center rounded-md transition-colors",
                      formData.assetsInPossession.includes(asset.id) ? "bg-[#FFE14E] text-[#1B2447]" : "bg-white dark:bg-white/10"
                    )}>
                      {asset.icon}
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest">{asset.id}</span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. SUPPORTING INFORMATION */}
        <Card className="rounded-xl border-none shadow-xl shadow-slate-200/50 dark:shadow-none dark:bg-[#161b30]">
          <CardHeader className="border-b border-border/50 pb-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-blue-500 text-white">
                <MessageSquare className="size-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold tracking-tight">4. Supporting Information</CardTitle>
                <CardDescription className="font-medium">Additional details and future contact info.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-8 space-y-8">
            <div className="flex items-center justify-between rounded-md bg-blue-50/50 p-6 dark:bg-blue-500/5">
              <div className="space-y-1">
                <p className="font-semibold text-[#1B2447] dark:text-blue-400">Need Immediate Exit?</p>
                <p className="text-sm text-slate-500 font-medium italic">Selecting &quot;Yes&quot; requires a valid justification for skipping the notice period.</p>
              </div>
              <Switch 
                checked={formData.needImmediateExit}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, needImmediateExit: checked }))}
              />
            </div>

            {formData.needImmediateExit && (
              <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                <Label htmlFor="immediateExitJustification" className="font-semibold text-slate-500 uppercase tracking-widest text-[10px]">
                  Justification for Immediate Exit <span className="text-destructive font-semibold">*</span>
                </Label>
                <textarea 
                  id="immediateExitJustification"
                  name="immediateExitJustification"
                  value={formData.immediateExitJustification}
                  onChange={handleInputChange}
                  placeholder="Explain why you need to leave immediately..."
                  className={cn(
                    "flex min-h-[100px] w-full rounded-md border border-input bg-background px-4 py-3 text-sm ring-offset-background font-medium",
                    errors.immediateExitJustification && "border-destructive"
                  )}
                />
                {errors.immediateExitJustification && <p className="text-[10px] font-semibold text-destructive uppercase tracking-widest">{errors.immediateExitJustification}</p>}
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="font-semibold text-slate-500 uppercase tracking-widest text-[10px]">Upload Supporting Document</Label>
                <div className="group relative flex h-24 w-full cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-slate-200 bg-slate-50 transition-all hover:bg-slate-100 dark:border-white/10 dark:bg-white/5">
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="size-5 text-slate-400 group-hover:text-[#1B2447] transition-colors" />
                    <span className="text-xs font-semibold text-slate-500">Upload PDF (Max 5MB)</span>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="contactNumberAfterExit" className="font-semibold text-slate-500 uppercase tracking-widest text-[10px]">Contact Number After Exit</Label>
                  <Input 
                    id="contactNumberAfterExit"
                    name="contactNumberAfterExit"
                    placeholder="+63 XXX XXX XXXX"
                    value={formData.contactNumberAfterExit}
                    onChange={handleInputChange}
                    className="h-11 rounded-md font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="personalEmail" className="font-semibold text-slate-500 uppercase tracking-widest text-[10px]">Personal Email</Label>
                  <Input 
                    id="personalEmail"
                    name="personalEmail"
                    type="email"
                    placeholder="your@personalemail.com"
                    value={formData.personalEmail}
                    onChange={handleInputChange}
                    className="h-11 rounded-md font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="forwardingNotes" className="font-semibold text-slate-500 uppercase tracking-widest text-[10px]">Forwarding Notes</Label>
              <textarea 
                id="forwardingNotes"
                name="forwardingNotes"
                value={formData.forwardingNotes}
                onChange={handleInputChange}
                placeholder="Notes for payroll, future communication, etc."
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-4 py-3 text-sm ring-offset-background font-medium"
              />
            </div>
          </CardContent>
        </Card>

        {/* 5. ACKNOWLEDGMENT */}
        <Card className="rounded-xl border-none shadow-xl shadow-slate-200/50 dark:shadow-none bg-[#1B2447] text-white overflow-hidden relative">
          <div className="absolute -left-12 -bottom-12 size-48 rounded-full bg-[#FFE14E]/5 blur-3xl" />
          <CardHeader className="border-b border-white/10 pb-6 relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-[#FFE14E] text-[#1B2447]">
                <CheckCircle2 className="size-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold tracking-tight text-white">5. Acknowledgment</CardTitle>
                <CardDescription className="text-slate-400 font-medium">Final confirmation and understanding.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-8 space-y-6 relative z-10">
            <div className="space-y-4">
              {[
                { 
                  id: "ackInfoCorrect", 
                  label: "I confirm that the information provided in this exit request is true and correct.",
                  checked: formData.ackInfoCorrect
                },
                { 
                  id: "ackSubjectToReview", 
                  label: "I understand that my exit request is subject to review, approval, and completion of all required clearance processes.",
                  checked: formData.ackSubjectToReview
                },
                { 
                  id: "ackFinalPayClearance", 
                  label: "I understand that final pay and document processing depend on clearance completion and company policy.",
                  checked: formData.ackFinalPayClearance
                }
              ].map((ack) => (
                <div key={ack.id} className="flex items-start gap-4 rounded-md bg-white/5 p-4 transition-colors hover:bg-white/10">
                  <Checkbox 
                    id={ack.id} 
                    checked={ack.checked} 
                    onChange={(e) => setFormData(prev => ({ ...prev, [ack.id]: e.target.checked }))}
                    className="mt-1 border-white/20 data-[state=checked]:bg-[#FFE14E] data-[state=checked]:text-[#1B2447]" 
                  />
                  <Label htmlFor={ack.id} className="text-sm font-semibold text-slate-300 leading-relaxed cursor-pointer">{ack.label}</Label>
                </div>
              ))}
            </div>
            {errors.acknowledgment && (
              <div className="rounded-md bg-destructive/20 border border-destructive/30 p-3 flex items-center gap-2 text-destructive-foreground">
                <AlertTriangle className="size-4 shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-widest">{errors.acknowledgment}</span>
              </div>
            )}
          </CardContent>
          <CardFooter className="bg-white/5 p-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between relative z-10">
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white hover:bg-white/10 font-semibold px-6">
                Save as Draft
              </Button>
            </div>
            <div className="flex gap-4">
              <Button 
                type="button" 
                onClick={onClose} 
                className="rounded-md bg-white/10 text-white border-none hover:bg-white/20 font-semibold h-12 px-8"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="rounded-md bg-[#FFE14E] text-[#1B2447] font-semibold h-12 px-10 hover:bg-[#F7D93C] shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {isSubmitting ? "Submitting..." : "Submit Exit Request"}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

// Helper Components
function StatusBadge({ status }: { status: string }) {
  const styles = {
    "Pending": "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-amber-200/50",
    "Approved": "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-200/50",
    "In Progress": "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border-blue-200/50",
    "Completed": "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-400 border-slate-200/50",
  };
  
  const currentStyle = styles[status as keyof typeof styles] || styles["Pending"];

  return (
    <Badge className={cn("rounded-md px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest border shadow-none", currentStyle)}>
      {status}
    </Badge>
  );
}
