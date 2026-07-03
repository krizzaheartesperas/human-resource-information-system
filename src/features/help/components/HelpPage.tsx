"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HelpCircle,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Mail,
  Phone,
  CalendarDays,
  Clock,
  ClipboardList,
  User,
  MessageSquare,
  Copy,
  Check,
  Inbox,
  Pencil,
  Trash2,
} from "lucide-react";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { employees } from "@/lib/mock";
import { cn } from "@/lib/utils";
import { DashboardSectionTopBar } from "@/components/layout/DashboardSectionTopBar";
import { EmployeeSectionHeader } from "@/components/layout/EmployeeSectionHeader";
import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";

const SUPPORT_REQUESTS_KEY = "hris-help-support-requests";
const CONTACT_INFO_KEY = "hris-help-contact-info";

type ContactInfo = { email: string; phone: string };

const DEFAULT_CONTACT: ContactInfo = {
  email: "krizzaheart.esperas@gmail.com",
  phone: "+63 912 345 6789",
};

function loadContactInfo(): ContactInfo {
  if (typeof window === "undefined") return DEFAULT_CONTACT;
  try {
    const raw = window.localStorage.getItem(CONTACT_INFO_KEY);
    if (!raw) return DEFAULT_CONTACT;
    const parsed = JSON.parse(raw) as ContactInfo;
    return typeof parsed?.email === "string" && typeof parsed?.phone === "string"
      ? parsed
      : DEFAULT_CONTACT;
  } catch {
    return DEFAULT_CONTACT;
  }
}

function saveContactInfo(info: ContactInfo) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONTACT_INFO_KEY, JSON.stringify(info));
  } catch {}
}

type SupportCategory =
  | "HR"
  | "IT"
  | "Leave"
  | "Attendance"
  | "Payroll"
  | "Other";

type SupportRequest = {
  id: string;
  subject: string;
  message: string;
  category: SupportCategory;
  email: string;
  createdAt: string;
  status: "Submitted" | "In progress" | "Resolved";
};

function loadSupportRequests(): SupportRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SUPPORT_REQUESTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SupportRequest[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSupportRequests(requests: SupportRequest[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SUPPORT_REQUESTS_KEY,
      JSON.stringify(requests)
    );
  } catch {
    // quota or parse error
  }
}

type FaqItem = { id: string; question: string; steps: string[] };

const EMPLOYEE_FAQS: FaqItem[] = [
  {
    id: "leave-balance",
    question: "How do I check my leave balance?",
    steps: [
      "Go to Leave from the sidebar.",
      "Your balance for each leave type (e.g. Vacation, Sick) is shown at the top.",
      "You can also see your request history and submit new leave requests from the same page.",
    ],
  },
  {
    id: "request-leave",
    question: "How do I submit a leave request?",
    steps: [
      "Open the Leave page and click \"New request\".",
      "Choose the leave type and date range.",
      "Add a reason if required and submit.",
      "Your manager will be notified. Track status (Pending, Approved, Rejected) in Leave or Requests.",
    ],
  },
  {
    id: "clock-in-out",
    question: "How do I clock in and out?",
    steps: [
      "Use the clock in/out buttons on the Dashboard for today.",
      "Or go to Attendance to view your history.",
      "Clock in when you start work and clock out when you leave.",
      "If you forget, submit an attendance correction from the Attendance page.",
    ],
  },
  {
    id: "attendance-correction",
    question: "I forgot to clock in or out. What should I do?",
    steps: [
      "Go to Attendance and use the correction form.",
      "Select the date and choose the type (missing clock in/out or wrong time).",
      "Enter a reason and optionally add a proof link.",
      "HR will review and update your record.",
    ],
  },
  {
    id: "workflow-request",
    question: "How do I submit a promotion, transfer, or other request?",
    steps: [
      "Go to Requests and click \"New request\".",
      "Choose the request type (e.g. Promotion, Transfer, Department change).",
      "Fill in the details and submit.",
      "Your manager or HR will review it. Check status under Requests.",
    ],
  },
  {
    id: "update-profile",
    question: "How do I update my profile or contact details?",
    steps: [
      "Go to Account from the sidebar.",
      "Edit your name, phone, address, or other details.",
      "Save changes to update your profile.",
      "For official changes (e.g. name or legal data), HR may need to approve.",
    ],
  },
  {
    id: "who-to-contact",
    question: "Who do I contact for HR or IT issues?",
    steps: [
      "For HR questions (leave, attendance, benefits, policies), contact HR at the email or phone in the Contact tab.",
      "For technical issues with this app, use the same channel or submit a support request below.",
    ],
  },
];

type GuideItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  steps: string[];
  icon: React.ComponentType<{ className?: string }>;
};

const EMPLOYEE_GUIDES: GuideItem[] = [
  {
    id: "leave",
    title: "Request time off",
    description: "Submit and track leave requests",
    href: "/leave",
    icon: CalendarDays,
    steps: [
      "Go to Leave in the sidebar.",
      "Click \"New request\" and select leave type and dates.",
      "Add a reason if required and submit.",
      "Track status in Leave or Requests.",
    ],
  },
  {
    id: "attendance",
    title: "Attendance & corrections",
    description: "Clock in/out and fix missing punches",
    href: "/attendance",
    icon: Clock,
    steps: [
      "Clock in/out from Dashboard or Attendance.",
      "View your history and summary on the Attendance page.",
      "To correct a missing or wrong punch, use the correction form and add a reason.",
    ],
  },
  {
    id: "requests",
    title: "Submit a workflow request",
    description: "Promotion, transfer, department change",
    href: "/requests",
    icon: ClipboardList,
    steps: [
      "Go to Requests and click \"New request\".",
      "Choose the type (e.g. Promotion, Transfer).",
      "Fill in the form and submit.",
      "Check status in the Requests list.",
    ],
  },
  {
    id: "account",
    title: "Update your profile",
    description: "Edit your account and preferences",
    href: "/account",
    icon: User,
    steps: [
      "Go to Account from the sidebar.",
      "Edit your name, phone, address, or notification preferences.",
      "Save to apply changes.",
    ],
  },
];

export default function HelpPage() {
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>(() =>
    typeof window === "undefined" ? [] : loadSupportRequests()
  );
  const [contactForm, setContactForm] = useState({
    subject: "",
    message: "",
    category: "Other" as SupportCategory,
  });
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<"email" | "phone" | null>(null);
  const [contactInfo, setContactInfo] = useState<ContactInfo>(() =>
    typeof window === "undefined" ? DEFAULT_CONTACT : loadContactInfo()
  );
  const [contactEdit, setContactEdit] = useState<ContactInfo>(() =>
    typeof window === "undefined" ? DEFAULT_CONTACT : loadContactInfo()
  );
  const [contactSaved, setContactSaved] = useState(false);
  const [editingRequest, setEditingRequest] = useState<SupportRequest | null>(null);
  const [editForm, setEditForm] = useState<Pick<SupportRequest, "subject" | "message" | "category" | "status">>({
    subject: "",
    message: "",
    category: "Other",
    status: "Submitted",
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  type HelpMainTab = "faqs" | "guides" | "tickets" | "contact";
  const [mainTab, setMainTab] = useState<HelpMainTab>("faqs");
  const { user } = useCurrentUser();

  const isHrAdmin = user?.role === "HR_ADMIN";
  const isHrStaff = user?.role === "HR_STAFF";
  const isManager = user?.role === "MANAGER";
  const showTicketsTab = isHrAdmin || isHrStaff || isManager;

  const helpEmployeeTabs = useMemo(() => {
    const t: { id: HelpMainTab; label: string }[] = [
      { id: "faqs", label: "FAQs" },
      { id: "guides", label: "Guides" },
    ];
    if (showTicketsTab) {
      t.push({ id: "tickets", label: isManager ? "Team tickets" : "Tickets" });
    }
    t.push({ id: "contact", label: "Contact" });
    return t;
  }, [showTicketsTab, isManager]);

  const teamMemberEmails = useMemo(() => {
    const managerEmployeeId = user?.employeeId;
    if (!managerEmployeeId) return new Set<string>();
    return new Set(
      employees
        .filter((e) => e.managerId === managerEmployeeId)
        .map((e) => e.email)
    );
  }, [user?.employeeId]);

  const teamTickets = useMemo(
    () =>
      supportRequests
        .filter((r) => teamMemberEmails.has(r.email))
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime()
        ),
    [supportRequests, teamMemberEmails]
  );

  const myRequests = supportRequests.filter(
    (r) => r.email === (user?.email ?? "")
  ).sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const filteredFaqs = search.trim()
    ? EMPLOYEE_FAQS.filter(
        (f) =>
          f.question.toLowerCase().includes(search.toLowerCase()) ||
          f.steps.some((s) => s.toLowerCase().includes(search.toLowerCase()))
      )
    : EMPLOYEE_FAQS;

  function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    const email = user?.email ?? "";
    const request: SupportRequest = {
      id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      subject: contactForm.subject.trim(),
      message: contactForm.message.trim(),
      category: contactForm.category,
      email,
      createdAt: new Date().toISOString(),
      status: "Submitted",
    };
    const next = [...supportRequests, request];
    setSupportRequests(next);
    saveSupportRequests(next);
    setContactForm({ subject: "", message: "", category: "Other" });
    setSubmitSuccess(true);
    setTimeout(() => setSubmitSuccess(false), 5000);
  }

  async function copyToClipboard(value: string, type: "email" | "phone") {
    try {
      await navigator.clipboard.writeText(value);
      setCopyFeedback(type);
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      // fallback or ignore
    }
  }

  function updateRequestStatus(
    requestId: string,
    status: SupportRequest["status"]
  ) {
    const next = supportRequests.map((r) =>
      r.id === requestId ? { ...r, status } : r
    );
    setSupportRequests(next);
    saveSupportRequests(next);
  }

  function openEditRequest(req: SupportRequest) {
    setEditingRequest(req);
    setEditForm({
      subject: req.subject,
      message: req.message,
      category: req.category,
      status: req.status,
    });
  }

  function saveEditRequest() {
    if (!editingRequest) return;
    const next = supportRequests.map((r) =>
      r.id === editingRequest.id
        ? { ...r, ...editForm }
        : r
    );
    setSupportRequests(next);
    saveSupportRequests(next);
    setEditingRequest(null);
  }

  function deleteRequest(requestId: string) {
    const next = supportRequests.filter((r) => r.id !== requestId);
    setSupportRequests(next);
    saveSupportRequests(next);
    setDeleteConfirmId(null);
  }

  function handleSaveContact() {
    const info = {
      email: contactEdit.email.trim(),
      phone: contactEdit.phone.trim(),
    };
    if (!info.email || !info.phone) return;
    setContactInfo(info);
    saveContactInfo(info);
    setContactSaved(true);
    setTimeout(() => setContactSaved(false), 2000);
  }

  const displayEmail = contactInfo.email;
  const displayPhone = contactInfo.phone;

  return (
    <div className="min-w-0 w-full max-w-full space-y-6">
      <div className="min-w-0 space-y-3">
        {user?.role === "EMPLOYEE" || user?.role === "HR_STAFF" ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-6">
              <EmployeeModuleTopbar searchPlaceholder="Search" />
              <EmployeeSectionHeader
                title="Help"
                tabs={helpEmployeeTabs}
                activeTab={mainTab}
                onTabChange={(id) => setMainTab(id as HelpMainTab)}
              />
            </div>
            <Input
              placeholder="Search help & FAQs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md rounded-xl"
            />
          </div>
        ) : (
          <>
            <DashboardSectionTopBar
              breadcrumb={
                <>
                  <span className="truncate font-semibold">Help Center</span>
                  <span className="shrink-0 opacity-70">&gt;</span>
                  <span className="truncate font-semibold text-foreground">Help Center</span>
                </>
              }
              searchPlaceholder="Search help & FAQs..."
              searchInputProps={{
                value: search,
                onChange: (e) => setSearch(e.target.value),
              }}
            />

            <div className="border-b border-border/70">
              <div className="-mx-1 flex gap-1 overflow-x-auto py-1 [scrollbar-width:thin] sm:gap-6 lg:gap-8 [&::-webkit-scrollbar]:h-1.5">
                <button
                  type="button"
                  className="relative flex shrink-0 items-center gap-2 whitespace-nowrap pb-3 -mb-px px-2 text-sm font-medium text-primary transition-colors sm:text-base"
                >
                  <HelpCircle className="size-4 shrink-0" />
                  <span>Help Center</span>
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-100 bg-primary transition-transform duration-200" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <Tabs
        value={mainTab}
        onValueChange={(v) => setMainTab(v as HelpMainTab)}
        className="min-w-0 space-y-4"
      >
        <TabsList
          className={cn(
            "flex h-auto w-full min-w-0 flex-nowrap justify-start gap-1 overflow-x-auto rounded-lg bg-muted/80 p-1 [scrollbar-width:thin] sm:gap-1.5",
            "[&::-webkit-scrollbar]:h-1.5",
            (user?.role === "EMPLOYEE" || user?.role === "HR_STAFF") && "hidden"
          )}
        >
          <TabsTrigger
            value="faqs"
            className="shrink-0 gap-1.5 whitespace-nowrap px-3 py-2 text-xs sm:gap-2 sm:px-4 sm:text-sm"
          >
            <BookOpen className="size-3.5 shrink-0 sm:size-4" />
            FAQs
          </TabsTrigger>
          <TabsTrigger
            value="guides"
            className="shrink-0 gap-1.5 whitespace-nowrap px-3 py-2 text-xs sm:gap-2 sm:px-4 sm:text-sm"
          >
            <BookOpen className="size-3.5 shrink-0 sm:size-4" />
            Guides
          </TabsTrigger>
          {showTicketsTab && (
            <TabsTrigger
              value="tickets"
              className="shrink-0 gap-1.5 whitespace-nowrap px-3 py-2 text-xs sm:gap-2 sm:px-4 sm:text-sm"
            >
              <Inbox className="size-3.5 shrink-0 sm:size-4" />
              {isManager ? "Team tickets" : "Tickets"}
            </TabsTrigger>
          )}
          <TabsTrigger
            value="contact"
            className="shrink-0 gap-1.5 whitespace-nowrap px-3 py-2 text-xs sm:gap-2 sm:px-4 sm:text-sm"
          >
            <MessageSquare className="size-3.5 shrink-0 sm:size-4" />
            Contact
          </TabsTrigger>
        </TabsList>

        <TabsContent value="faqs" className="min-w-0 space-y-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Use the search bar above to filter FAQs.
          </p>
          <Card className="min-w-0">
            <CardHeader className="min-w-0">
              <CardTitle className="text-base sm:text-lg">Frequently asked questions</CardTitle>
              <CardDescription>
                Find quick answers about leave, attendance, requests, and more.
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 space-y-2 px-3 sm:px-6">
              {filteredFaqs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No FAQs match your search. Try different keywords.
                </p>
              ) : (
                filteredFaqs.map((faq) => {
                  const isOpen = openFaqId === faq.id;
                  return (
                    <div
                      key={faq.id}
                      className={cn(
                        "border border-border rounded-lg overflow-hidden transition-shadow",
                        isOpen && "shadow-sm ring-1 ring-primary/10"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenFaqId(isOpen ? null : faq.id)
                        }
                        className="w-full min-w-0 flex items-center justify-between gap-3 px-3 py-3.5 text-left hover:bg-muted/50 transition-colors rounded-t-lg sm:px-4"
                      >
                        <span className="min-w-0 flex-1 break-words font-medium text-sm text-foreground">
                          {faq.question}
                        </span>
                        {isOpen ? (
                          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                      {isOpen && (
                        <div className="border-t border-border bg-muted/40 dark:bg-muted/20">
                          <div className="relative pl-4 pr-4 py-4">
                            <div className="relative flex flex-col">
                              {faq.steps.map((step, i) => (
                                <div
                                  key={i}
                                  className="flex items-start gap-3"
                                >
                                  <div className="flex flex-col items-center shrink-0">
                                    <div className="size-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                                      <svg
                                        className="size-3 text-primary-foreground"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2.5}
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          d="M5 13l4 4L19 7"
                                        />
                                      </svg>
                                    </div>
                                    {i < faq.steps.length - 1 && (
                                      <div className="w-0.5 flex-1 min-h-4 bg-primary/40 my-0.5" aria-hidden />
                                    )}
                                  </div>
                                  <div className="pt-0.5 pb-3 text-sm text-muted-foreground leading-relaxed">
                                    {step}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guides" className="min-w-0 space-y-4">
          <p className="text-sm text-muted-foreground">
            Step-by-step guides for common tasks. Click a card to open the page.
          </p>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            {EMPLOYEE_GUIDES.map((guide) => {
              const Icon = guide.icon;
              return (
                <Link key={guide.id} href={guide.href} className="min-w-0">
                  <Card
                    className={cn(
                      "h-full min-w-0 transition-colors hover:bg-accent/50 hover:border-primary/30"
                    )}
                  >
                    <CardHeader className="min-w-0 pb-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="shrink-0 rounded-md bg-primary/10 p-2">
                          <Icon className="size-5 text-primary" />
                        </div>
                        <CardTitle className="min-w-0 text-base">{guide.title}</CardTitle>
                      </div>
                      <CardDescription className="min-w-0">{guide.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="min-w-0 pt-0 px-3 sm:px-6">
                      <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                        {guide.steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </TabsContent>

        {showTicketsTab && (
          <TabsContent value="tickets" className="min-w-0 space-y-4">
            <Card className="min-w-0">
              <CardHeader className="min-w-0">
                <CardTitle className="text-base sm:text-lg">
                  {isManager ? "Team tickets" : "Support tickets"}
                </CardTitle>
                <CardDescription>
                  {isManager
                    ? "Support requests from your direct reports. Update status or escalate to HR as needed."
                    : "All employee support requests. Update status as you work on them."}
                </CardDescription>
              </CardHeader>
              <CardContent className="min-w-0 px-3 sm:px-6">
                {(isManager ? teamTickets : supportRequests).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    {isManager
                      ? "No support requests from your team yet."
                      : "No support requests yet."}
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {(isManager ? teamTickets : [...supportRequests].sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime()
                    )).map((req) => (
                        <li
                          key={req.id}
                          className="space-y-2 rounded-lg border border-border p-3 sm:p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                              <span className="min-w-0 break-words font-medium text-sm">
                                {req.subject}
                              </span>
                              <Badge variant="secondary" className="w-fit text-xs">
                                {req.category}
                              </Badge>
                              <span className="break-all text-xs text-muted-foreground">
                                {req.email}
                              </span>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                              <select
                                value={req.status}
                                onChange={(e) =>
                                  updateRequestStatus(req.id, e.target.value as SupportRequest["status"])
                                }
                                className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <option value="Submitted">Submitted</option>
                                <option value="In progress">In progress</option>
                                <option value="Resolved">Resolved</option>
                              </select>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 shrink-0"
                                onClick={() => openEditRequest(req)}
                                title="Edit request"
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 shrink-0 text-destructive hover:text-destructive"
                                onClick={() => setDeleteConfirmId(req.id)}
                                title="Delete request"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {req.message}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(req.createdAt).toLocaleString()}
                          </p>
                        </li>
                      ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="contact" className="min-w-0 space-y-4">
          {isHrAdmin && (
            <Card className="min-w-0">
              <CardHeader className="min-w-0">
                <CardTitle className="text-base sm:text-lg">Contact settings</CardTitle>
                <CardDescription>
                  Edit the email and phone shown to employees. Saved here for
                  everyone.
                </CardDescription>
              </CardHeader>
              <CardContent className="max-w-full space-y-4 px-3 sm:max-w-md sm:px-6">
                <div className="space-y-2">
                  <Label htmlFor="contact-email">Support email</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={contactEdit.email}
                    onChange={(e) =>
                      setContactEdit((p) => ({ ...p, email: e.target.value }))
                    }
                    placeholder="hr@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-phone">Support phone</Label>
                  <Input
                    id="contact-phone"
                    value={contactEdit.phone}
                    onChange={(e) =>
                      setContactEdit((p) => ({ ...p, phone: e.target.value }))
                    }
                    placeholder="+63 912 345 6789"
                  />
                </div>
                <Button onClick={handleSaveContact}>
                  {contactSaved ? (
                    <>
                      <Check className="size-4 mr-2" />
                      Saved
                    </>
                  ) : (
                    "Save contact info"
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
          <Card className="min-w-0">
            <CardHeader className="min-w-0">
              <CardTitle className="text-base sm:text-lg">HR & support contact</CardTitle>
              <CardDescription>
                Reach out for leave, attendance, policies, or technical help.
                Click to copy.
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4 px-3 sm:px-6">
              <div className="flex flex-col gap-4 text-sm sm:flex-row sm:flex-wrap sm:gap-6">
                <div className="flex min-w-0 items-center gap-2">
                  <Mail className="size-4 shrink-0 text-muted-foreground" />
                  <a
                    href={`mailto:${displayEmail}`}
                    className="min-w-0 break-all text-primary hover:underline"
                  >
                    {displayEmail}
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() =>
                      copyToClipboard(displayEmail, "email")
                    }
                    title="Copy email"
                  >
                    {copyFeedback === "email" ? (
                      <Check className="size-4 text-green-600" />
                    ) : (
                      <Copy className="size-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <Phone className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 break-words text-muted-foreground">
                    {displayPhone}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() =>
                      copyToClipboard(displayPhone, "phone")
                    }
                    title="Copy phone"
                  >
                    {copyFeedback === "phone" ? (
                      <Check className="size-4 text-green-600" />
                    ) : (
                      <Copy className="size-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader className="min-w-0">
              <CardTitle className="text-base sm:text-lg">Submit a support request</CardTitle>
              <CardDescription className="min-w-0 break-words">
                Describe your issue and we&apos;ll get back to you at{" "}
                {user?.email ?? "your email"}.
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4 px-3 sm:px-6">
              {submitSuccess && (
                <div
                  className={cn(
                    "rounded-lg px-4 py-3 text-sm",
                    "bg-primary/10 text-primary border border-primary/20"
                  )}
                >
                  Request submitted. We&apos;ll respond at {user?.email}. You can
                  see it under &quot;My support requests&quot; below.
                </div>
              )}
              <form
                onSubmit={handleContactSubmit}
                className="max-w-full space-y-4 sm:max-w-md"
              >
                <div className="space-y-2">
                  <Label htmlFor="help-category">Category</Label>
                  <select
                    id="help-category"
                    value={contactForm.category}
                    onChange={(e) =>
                      setContactForm((p) => ({
                        ...p,
                        category: e.target.value as SupportCategory,
                      }))
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="HR">HR</option>
                    <option value="IT">IT</option>
                    <option value="Leave">Leave</option>
                    <option value="Attendance">Attendance</option>
                    <option value="Payroll">Payroll</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="help-subject">Subject</Label>
                  <Input
                    id="help-subject"
                    placeholder="e.g. Leave balance question"
                    value={contactForm.subject}
                    onChange={(e) =>
                      setContactForm((p) => ({ ...p, subject: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="help-message">Message</Label>
                  <textarea
                    id="help-message"
                    placeholder="Describe your issue or question..."
                    value={contactForm.message}
                    onChange={(e) =>
                      setContactForm((p) => ({ ...p, message: e.target.value }))
                    }
                    required
                    rows={4}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <Button type="submit">Submit request</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Inbox className="size-5 shrink-0" />
                My support requests
              </CardTitle>
              <CardDescription>
                Requests you&apos;ve submitted. Status is for demo; in production
                HR would update these.
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 px-3 sm:px-6">
              {myRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No support requests yet. Submit one above.
                </p>
              ) : (
                <ul className="space-y-3">
                  {myRequests.map((req) => (
                    <li
                      key={req.id}
                      className="rounded-lg border border-border p-3 space-y-1"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="min-w-0 break-words font-medium text-sm">{req.subject}</span>
                          <Badge variant="secondary" className="text-xs">
                            {req.category}
                          </Badge>
                          <Badge
                            variant={
                              req.status === "Resolved"
                                ? "default"
                                : req.status === "In progress"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {req.status}
                          </Badge>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0"
                            onClick={() => openEditRequest(req)}
                            title="Edit request"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0 text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirmId(req.id)}
                            title="Delete request"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {req.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(req.createdAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit request dialog */}
      <Dialog open={!!editingRequest} onOpenChange={(open) => !open && setEditingRequest(null)}>
        <DialogContent className="max-h-[min(90dvh,640px)] overflow-y-auto scrollbar-hide sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit request</DialogTitle>
            <DialogDescription>
              Update the subject, message, or category. Changes are saved for everyone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-category">Category</Label>
              <select
                id="edit-category"
                value={editForm.category}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, category: e.target.value as SupportCategory }))
                }
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="HR">HR</option>
                <option value="IT">IT</option>
                <option value="Leave">Leave</option>
                <option value="Attendance">Attendance</option>
                <option value="Payroll">Payroll</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-subject">Subject</Label>
              <Input
                id="edit-subject"
                value={editForm.subject}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, subject: e.target.value }))
                }
                placeholder="Subject"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-message">Message</Label>
              <textarea
                id="edit-message"
                value={editForm.message}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, message: e.target.value }))
                }
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            {showTicketsTab && (
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <select
                  id="edit-status"
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      status: e.target.value as SupportRequest["status"],
                    }))
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="Submitted">Submitted</option>
                  <option value="In progress">In progress</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRequest(null)}>
              Cancel
            </Button>
            <Button onClick={saveEditRequest}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="max-h-[min(90dvh,480px)] overflow-y-auto scrollbar-hide">
          <DialogHeader>
            <DialogTitle>Delete request</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this support request? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteRequest(deleteConfirmId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
