"use client";

import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trash2,
  Pencil,
  Plus,
  ChevronDown,
  Search,
  Settings,
  Sun,
  Moon,
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  Eye,
  ChevronLeft,
  ChevronRight,
  MessagesSquare,
  Calendar,
  MapPin,
  Gift,
  StickyNote,
  SquarePen,
  Check,
  X,
  Minimize2,
  Maximize2,
  CalendarDays,
  ClipboardList,
  ListChecks,
  Percent,
  Users,
  Wallet,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import {
  employees,
  getRequestsByStatus,
  departments,
  getDepartmentById,
  upcomingEvents,
  birthdayEvents,
  todayScheduleItems,
  leaveTypeMetadata,
  getLeaveBalancesByEmployee,
} from "@/lib/mock";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import type { ScheduleItem, Employee, RequestStatus } from "@/lib/mock";
import { cn } from "@/lib/utils";
import { EmployeeSectionHeader } from "@/components/layout/EmployeeSectionHeader";
import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";
import { getTodayDateKey } from "@/features/attendance/services/attendance.service";
import { toLocalDateKey } from "@/features/attendance/services/employeeAttendanceHistory";
import {
  HeadcountByDepartmentChart,
  EmploymentTypeChart,
  PayrollAnalyticsCard,
  LeaveRequestsTrendChart,
  WorkflowRequestsTrendChart,
} from "@/features/dashboard/components/AnalyticsCharts";
import { DASHBOARD_CARD_DARK_CLASS } from "@/features/dashboard/dashboard-card-styles";
import { useTheme } from "@/components/theme/ThemeProvider";
import NotificationsBellMenu from "@/components/layout/NotificationsBellMenu";
import SettingsIconLink from "@/components/layout/SettingsIconLink";
import TopbarAccountMenu from "@/components/layout/TopbarAccountMenu";

function formatTimeOffType(type: string) {
  const meta = (leaveTypeMetadata as Record<string, { label: string }>)[type];
  return meta?.label ?? type.replace(/_/g, " ");
}

function formatBirthday(date: string) {
  const [m, d] = date.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatScheduleTime(time: string) {
  const [hStr, m = "00"] = time.split(":");
  const h = parseInt(hStr!, 10);
  if (Number.isNaN(h)) return time;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12.toString().padStart(2, "0")}:${m.padStart(2, "0")} ${suffix}`;
}

function formatScheduleDateTimeInPH(
  dateKey: string,
  time: string
): { dateLabel: string; weekdayLabel: string; timeLabel: string; dayLabel: string } {
  const iso = `${dateKey}T${time}:00+08:00`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return {
      dateLabel: dateKey,
      weekdayLabel: "",
      timeLabel: formatScheduleTime(time),
      dayLabel: "",
    };
  }

  return {
    dateLabel: date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "Asia/Manila",
    }),
    weekdayLabel: date
      .toLocaleDateString("en-US", {
        weekday: "short",
        timeZone: "Asia/Manila",
      })
      .toUpperCase(),
    timeLabel: date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Manila",
    }),
    dayLabel: date.toLocaleDateString("en-US", {
      day: "2-digit",
      timeZone: "Asia/Manila",
    }),
  };
}

function getDefaultScheduleTimesInPH(): { startTime: string; endTime: string } {
  const nowPH = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
  );
  const start = new Date(nowPH);
  // Round start to next 5-minute mark for cleaner defaults.
  const roundedMinutes = Math.ceil(start.getMinutes() / 5) * 5;
  start.setMinutes(roundedMinutes, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);

  const toHHmm = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  return { startTime: toHHmm(start), endTime: toHHmm(end) };
}

const SCHEDULE_STORAGE_KEY = "hris-today-schedule";

function loadScheduleFromStorage(): ScheduleItem[] {
  if (typeof window === "undefined") return [];
  try {
    const key = getTodayDateKey();
    const raw = localStorage.getItem(`${SCHEDULE_STORAGE_KEY}-${key}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScheduleItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      ...item,
      date: item.date ?? key,
      location: item.location?.trim() || "Main Office",
    }));
  } catch {
    return [];
  }
}

function saveScheduleToStorage(items: ScheduleItem[]) {
  if (typeof window === "undefined") return;
  try {
    const key = getTodayDateKey();
    localStorage.setItem(`${SCHEDULE_STORAGE_KEY}-${key}`, JSON.stringify(items));
  } catch {
    // ignore
  }
}

const EMPLOYEE_NOTES_STORAGE_KEY = "hris-employee-dashboard-notes";

type EmployeeDashboardNoteTag = { label: string; variant: "neutral" | "peach" };

type EmployeeDashboardNote = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  tags: EmployeeDashboardNoteTag[];
};

const DEFAULT_EMPLOYEE_NOTES: EmployeeDashboardNote[] = [
  {
    id: "note-1",
    title: "Phoenix footer section.",
    description: "Adding google play buttons.",
    completed: false,
    tags: [
      { label: "Today", variant: "neutral" },
      { label: "Waiting Feedback", variant: "peach" },
    ],
  },
  {
    id: "note-2",
    title: "Phoenix header section.",
    description:
      "Researching for header section to understand its function.",
    completed: true,
    tags: [
      { label: "Today", variant: "neutral" },
      { label: "Waiting Feedback", variant: "peach" },
    ],
  },
];

function loadEmployeeNotesFromStorage(): EmployeeDashboardNote[] {
  if (typeof window === "undefined") return DEFAULT_EMPLOYEE_NOTES;
  try {
    const raw = localStorage.getItem(EMPLOYEE_NOTES_STORAGE_KEY);
    if (!raw) return DEFAULT_EMPLOYEE_NOTES;
    const parsed = JSON.parse(raw) as EmployeeDashboardNote[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_EMPLOYEE_NOTES;
    return parsed;
  } catch {
    return DEFAULT_EMPLOYEE_NOTES;
  }
}

function saveEmployeeNotesToStorage(notes: EmployeeDashboardNote[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(EMPLOYEE_NOTES_STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // ignore
  }
}

const ADDED_EMPLOYEES_KEY = "hris-added-employees";

function loadAddedEmployees(): Employee[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ADDED_EMPLOYEES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Employee[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const DASHBOARD_WIDGETS_KEY = "hris-dashboard-widgets";

type AnnouncementItem = { id: string; title: string; date: string; time: string };

const DEFAULT_ANNOUNCEMENTS: AnnouncementItem[] = [
  { id: "ann-1", title: "Outing schedule for every department", date: "Today", time: "10:30 AM" },
  { id: "ann-2", title: "Meeting HR Department", date: "Today", time: "11:30 AM" },
  {
    id: "ann-3",
    title: "IT Department needs two more talents for UI/UX Designer position",
    date: "Yesterday",
    time: "03:10 PM",
  },
];

/** Normalize stored items: legacy had single `time` like "Today 10:30 AM" -> split into date + time */
function normalizeAnnouncement(item: { id: string; title: string; time?: string; date?: string; timeLabel?: string }): AnnouncementItem {
  if ("date" in item && "time" in item && typeof (item as AnnouncementItem).date === "string" && typeof (item as AnnouncementItem).time === "string") {
    return item as AnnouncementItem;
  }
  const combined = (item as { time?: string }).time ?? "Today 10:30 AM";
  const lastSpace = combined.lastIndexOf(" ");
  const date = lastSpace > 0 ? combined.slice(0, lastSpace).trim() : "Today";
  const time = lastSpace > 0 ? combined.slice(lastSpace + 1).trim() : "10:30 AM";
  return { id: item.id, title: item.title, date, time };
}

const ANNOUNCEMENTS_STORAGE_KEY = "hris-dashboard-announcements";

function loadAnnouncementsFromStorage(): AnnouncementItem[] {
  if (typeof window === "undefined") return DEFAULT_ANNOUNCEMENTS;
  try {
    const raw = window.localStorage.getItem(ANNOUNCEMENTS_STORAGE_KEY);
    if (!raw) return DEFAULT_ANNOUNCEMENTS;
    const parsed = JSON.parse(raw) as unknown[];
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed.map((p) => normalizeAnnouncement(p as { id: string; title: string; time?: string; date?: string }))
      : DEFAULT_ANNOUNCEMENTS;
  } catch {
    return DEFAULT_ANNOUNCEMENTS;
  }
}

function saveAnnouncementsToStorage(items: AnnouncementItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ANNOUNCEMENTS_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

type DashboardWidgets = {
  analytics: boolean;
  whatsOn: boolean;
  todaySchedule: boolean;
  /* Employee dashboard sections */
  announcements?: boolean;
  payrollSummary?: boolean;
  performanceOverview?: boolean;
  leaveSummary?: boolean;
  schedules?: boolean;
};

function loadDashboardWidgets(): DashboardWidgets {
  if (typeof window === "undefined") {
    return {
      analytics: true,
      whatsOn: true,
      todaySchedule: true,
      announcements: true,
      payrollSummary: true,
      performanceOverview: true,
      leaveSummary: true,
      schedules: true,
    };
  }
  try {
    const raw = window.localStorage.getItem(DASHBOARD_WIDGETS_KEY);
    if (!raw)
      return {
        analytics: true,
        whatsOn: true,
        todaySchedule: true,
        announcements: true,
        payrollSummary: true,
        performanceOverview: true,
        leaveSummary: true,
        schedules: true,
      };
    const parsed = JSON.parse(raw) as DashboardWidgets;
    return {
      analytics: parsed.analytics ?? true,
      whatsOn: parsed.whatsOn ?? true,
      todaySchedule: parsed.todaySchedule ?? true,
      announcements: parsed.announcements ?? true,
      payrollSummary: parsed.payrollSummary ?? true,
      performanceOverview: parsed.performanceOverview ?? true,
      leaveSummary: parsed.leaveSummary ?? true,
      schedules: parsed.schedules ?? true,
    };
  } catch {
    return {
      analytics: true,
      whatsOn: true,
      todaySchedule: true,
      announcements: true,
      payrollSummary: true,
      performanceOverview: true,
      leaveSummary: true,
      schedules: true,
    };
  }
}

function saveDashboardWidgets(widgets: DashboardWidgets) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DASHBOARD_WIDGETS_KEY, JSON.stringify(widgets));
  } catch {
    // ignore
  }
}

// Dummy performance data for employee performance overview chart
type PerformanceRangeKey = "lastYear" | "last6Months" | "thisYear";

type PerformanceDataset = {
  label: string;
  overallText: string;
  unit: string;
  delta: number;
  deltaLabel: string;
  points: { month: string; value: number; label?: string }[];
};

const EMPLOYEE_PERFORMANCE_DATA: Record<PerformanceRangeKey, PerformanceDataset> = {
  lastYear: {
    label: "Last Year",
    overallText: "94.2%",
    unit: "%",
    delta: 5.2,
    deltaLabel: "above target",
    points: [
      { month: "Jan", value: 85 },
      { month: "Feb", value: 90 },
      { month: "Mar", value: 110 },
      { month: "Apr", value: 95 },
      { month: "May", value: 60 },
      { month: "Jun", value: 110 },
      { month: "Jul", value: 130 },
      { month: "Aug", value: 120 },
      { month: "Sep", value: 100 },
      { month: "Oct", value: 85 },
      { month: "Nov", value: 115 },
      { month: "Dec", value: 105 },
    ],
  },
  last6Months: {
    label: "Last Month",
    overallText: "94.2%",
    unit: "%",
    delta: 5.2,
    deltaLabel: "above target",
    points: [
      { month: "Jan", value: 85 },
      { month: "Feb", value: 90 },
      { month: "Mar", value: 110 },
      { month: "Apr", value: 95 },
      { month: "May", value: 60 },
      { month: "Jun", value: 110 },
      { month: "Jul", value: 130 },
      { month: "Aug", value: 120 },
      { month: "Sep", value: 100 },
      { month: "Oct", value: 85 },
      { month: "Nov", value: 115 },
      { month: "Dec", value: 105 },
    ],
  },
  thisYear: {
    label: "Present",
    overallText: "94.2%",
    unit: "%",
    delta: 5.2,
    deltaLabel: "above target",
    points: [
      { month: "Jan", value: 85 },
      { month: "Feb", value: 90 },
      { month: "Mar", value: 110 },
      { month: "Apr", value: 95 },
      { month: "May", value: 60 },
      { month: "Jun", value: 110 },
      { month: "Jul", value: 130 },
      { month: "Aug", value: 120 },
      { month: "Sep", value: 100 },
      { month: "Oct", value: 85 },
      { month: "Nov", value: 115 },
      { month: "Dec", value: 105 },
    ],
  },
};

type RecentActivitySegment = { type: "text"; text: string } | { type: "link"; text: string; href: string };

type RecentActivityItem = {
  id: string;
  name: string;
  avatarUrl: string;
  statusDot: "online" | "away";
  timeAgo: string;
  segments: RecentActivitySegment[];
};

const EMPLOYEE_RECENT_ACTIVITY: RecentActivityItem[] = [
  {
    id: "ra-1",
    name: "Maria Santos",
    avatarUrl: "https://ui-avatars.com/api/?name=Maria+Santos&size=128&background=6366f1&color=fff",
    statusDot: "online",
    timeAgo: "2 mins ago",
    segments: [
      { type: "text", text: "submitted a leave request for " },
      { type: "link", text: "Annual Leave", href: "/leave?tab=apply" },
    ],
  },
  {
    id: "ra-2",
    name: "Juan Dela Cruz",
    avatarUrl: "https://ui-avatars.com/api/?name=Juan+Dela+Cruz&size=128&background=059669&color=fff",
    statusDot: "away",
    timeAgo: "8 mins ago",
    segments: [
      { type: "text", text: "Invited " },
      { type: "link", text: "Ana Reyes", href: "/employees" },
      { type: "text", text: " to review your document" },
    ],
  },
  {
    id: "ra-3",
    name: "HR Team",
    avatarUrl: "https://ui-avatars.com/api/?name=HR+Team&size=128&background=1e40af&color=fff",
    statusDot: "online",
    timeAgo: "1 hr ago",
    segments: [
      { type: "text", text: "Approved your " },
      { type: "link", text: "Sick Leave", href: "/leave?tab=my-report" },
      { type: "text", text: " request" },
    ],
  },
  {
    id: "ra-4",
    name: "Lisa Chen",
    avatarUrl: "https://ui-avatars.com/api/?name=Lisa+Chen&size=128&background=7c3aed&color=fff",
    statusDot: "online",
    timeAgo: "Yesterday",
    segments: [
      { type: "text", text: "Posted an update in " },
      { type: "link", text: "Team Announcements", href: "/" },
    ],
  },
];

function formatMonthYearLabelDashboard(date: Date): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

type ScheduleCategory = "meetings" | "events" | "holidays";
type AddableScheduleCategory = Exclude<ScheduleCategory, "holidays">;
type ScheduleCardAccent = "lavender" | "peach" | "sky";
type ScheduleCalendarView = "twoWeeks" | "fullMonth";

function inferCategoryFromScheduleType(type: ScheduleItem["type"]): AddableScheduleCategory {
  return type === "meeting" || type === "interview" ? "meetings" : "events";
}

type PhilippineHoliday = {
  date: string; // YYYY-MM-DD
  title: string;
  kind: "Regular Holiday" | "Special Non-Working Holiday";
};

const PH_FIXED_HOLIDAYS: { monthDay: string; title: string; kind: PhilippineHoliday["kind"] }[] = [
  { monthDay: "01-01", title: "New Year's Day", kind: "Regular Holiday" },
  { monthDay: "04-09", title: "Araw ng Kagitingan", kind: "Regular Holiday" },
  { monthDay: "05-01", title: "Labor Day", kind: "Regular Holiday" },
  { monthDay: "06-12", title: "Independence Day", kind: "Regular Holiday" },
  { monthDay: "08-21", title: "Ninoy Aquino Day", kind: "Special Non-Working Holiday" },
  { monthDay: "11-01", title: "All Saints' Day", kind: "Special Non-Working Holiday" },
  { monthDay: "11-30", title: "Bonifacio Day", kind: "Regular Holiday" },
  { monthDay: "12-08", title: "Feast of the Immaculate Conception", kind: "Special Non-Working Holiday" },
  { monthDay: "12-25", title: "Christmas Day", kind: "Regular Holiday" },
  { monthDay: "12-30", title: "Rizal Day", kind: "Regular Holiday" },
];

const PH_MOVABLE_HOLIDAYS_BY_YEAR: Record<
  number,
  { monthDay: string; title: string; kind: PhilippineHoliday["kind"] }[]
> = {
  2025: [
    { monthDay: "01-29", title: "Chinese New Year", kind: "Special Non-Working Holiday" },
    { monthDay: "04-17", title: "Maundy Thursday", kind: "Regular Holiday" },
    { monthDay: "04-18", title: "Good Friday", kind: "Regular Holiday" },
    { monthDay: "04-19", title: "Black Saturday", kind: "Special Non-Working Holiday" },
    { monthDay: "04-01", title: "Eid'l Fitr", kind: "Regular Holiday" },
    { monthDay: "06-06", title: "Eid'l Adha", kind: "Regular Holiday" },
  ],
  2026: [
    { monthDay: "02-17", title: "Chinese New Year", kind: "Special Non-Working Holiday" },
    { monthDay: "04-02", title: "Maundy Thursday", kind: "Regular Holiday" },
    { monthDay: "04-03", title: "Good Friday", kind: "Regular Holiday" },
    { monthDay: "04-04", title: "Black Saturday", kind: "Special Non-Working Holiday" },
    { monthDay: "03-20", title: "Eid'l Fitr", kind: "Regular Holiday" },
    { monthDay: "05-27", title: "Eid'l Adha", kind: "Regular Holiday" },
  ],
  2027: [
    { monthDay: "02-06", title: "Chinese New Year", kind: "Special Non-Working Holiday" },
    { monthDay: "03-25", title: "Maundy Thursday", kind: "Regular Holiday" },
    { monthDay: "03-26", title: "Good Friday", kind: "Regular Holiday" },
    { monthDay: "03-27", title: "Black Saturday", kind: "Special Non-Working Holiday" },
    { monthDay: "03-09", title: "Eid'l Fitr", kind: "Regular Holiday" },
    { monthDay: "05-17", title: "Eid'l Adha", kind: "Regular Holiday" },
  ],
};

function buildPhilippineHolidays(year: number): PhilippineHoliday[] {
  const toDate = (monthDay: string) => `${year}-${monthDay}`;
  const fixed = PH_FIXED_HOLIDAYS.map((h) => ({ ...h, date: toDate(h.monthDay) }));
  const movable = (PH_MOVABLE_HOLIDAYS_BY_YEAR[year] ?? []).map((h) => ({
    ...h,
    date: toDate(h.monthDay),
  }));

  const augLastDay = new Date(year, 8, 0);
  const heroes = new Date(augLastDay);
  while (heroes.getDay() !== 1) heroes.setDate(heroes.getDate() - 1);
  const heroesDate = `${year}-08-${String(heroes.getDate()).padStart(2, "0")}`;

  const merged: PhilippineHoliday[] = [
    ...fixed,
    ...movable,
    {
      date: heroesDate,
      title: "National Heroes Day",
      kind: "Regular Holiday",
    },
  ];

  return merged.sort((a, b) => a.date.localeCompare(b.date));
}

/** Employee dashboard schedule card — list row + tabs filter. */
type EmployeeDashboardScheduleEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  location?: string;
  startTime: string;
  endTime: string;
  category: ScheduleCategory;
  cardAccent: ScheduleCardAccent;
  avatarUrls: string[];
};

function formatScheduleEventRange(ev: EmployeeDashboardScheduleEvent): string {
  if (
    ev.category === "holidays" &&
    ev.startTime === "00:00" &&
    ev.endTime === "23:59"
  ) {
    return "All day";
  }
  return `${formatScheduleTime(ev.startTime)} - ${formatScheduleTime(ev.endTime)}`;
}

/** Demo events (e.g. 15 June 2027) — shown when that date is selected. */
const DEMO_EMPLOYEE_SCHEDULE_EVENTS: EmployeeDashboardScheduleEvent[] = [
  {
    id: "demo-sch-1",
    date: "2027-06-15",
    title: "Morning Briefing",
    startTime: "09:00",
    endTime: "09:30",
    category: "meetings",
    cardAccent: "lavender",
    avatarUrls: [
      "https://ui-avatars.com/api/?name=Team&size=64&background=e9d5ff&color=6b21a8",
      "https://ui-avatars.com/api/?name=HR&size=64&background=f3e8ff&color=7c3aed",
    ],
  },
  {
    id: "demo-sch-2",
    date: "2027-06-15",
    title: "Project Review Meeting",
    startTime: "10:00",
    endTime: "11:00",
    category: "meetings",
    cardAccent: "peach",
    avatarUrls: [
      "https://ui-avatars.com/api/?name=PD&size=64&background=ffedd5&color=c2410c",
      "https://ui-avatars.com/api/?name=PM&size=64&background=fed7aa&color=ea580c",
    ],
  },
  {
    id: "demo-sch-3",
    date: "2027-06-15",
    title: "Marketing Strategy Session",
    startTime: "11:30",
    endTime: "12:30",
    category: "events",
    cardAccent: "peach",
    avatarUrls: [
      "https://ui-avatars.com/api/?name=MKT&size=64&background=ffedd5&color=c2410c",
      "https://ui-avatars.com/api/?name=CMO&size=64&background=fed7aa&color=ea580c",
    ],
  },
  {
    id: "demo-sch-4",
    date: "2027-06-15",
    title: "Lunch and Learn",
    startTime: "12:45",
    endTime: "13:30",
    category: "events",
    cardAccent: "sky",
    avatarUrls: [
      "https://ui-avatars.com/api/?name=All&size=64&background=e0f2fe&color=0369a1",
      "https://ui-avatars.com/api/?name=Host&size=64&background=bae6fd&color=075985",
    ],
  },
  {
    id: "demo-sch-5",
    date: "2027-06-15",
    title: "Focus Group Discussion",
    startTime: "13:30",
    endTime: "14:30",
    category: "meetings",
    cardAccent: "lavender",
    avatarUrls: [
      "https://ui-avatars.com/api/?name=FG&size=64&background=e9d5ff&color=6b21a8",
      "https://ui-avatars.com/api/?name=UX&size=64&background=f3e8ff&color=7c3aed",
    ],
  },
  {
    id: "demo-sch-hol",
    date: "2027-06-16",
    title: "Company-wide holiday",
    startTime: "00:00",
    endTime: "23:59",
    category: "holidays",
    cardAccent: "sky",
    avatarUrls: ["https://ui-avatars.com/api/?name=HR&size=64&background=e0f2fe&color=0369a1"],
  },
];

/** Reference-style sample rows when today has no saved / demo data. */
const REFERENCE_SCHEDULE_FALLBACK_TODAY: Omit<
  EmployeeDashboardScheduleEvent,
  "id" | "date"
>[] = [
  {
    title: "Interview with Laolu",
    startTime: "08:00",
    endTime: "09:00",
    category: "meetings",
    cardAccent: "lavender",
    avatarUrls: [
      "https://ui-avatars.com/api/?name=Laolu&size=64&background=e9d5ff&color=6b21a8",
      "https://ui-avatars.com/api/?name=You&size=64&background=f3e8ff&color=7c3aed",
    ],
  },
  {
    title: "Team sync & roadmap",
    startTime: "10:00",
    endTime: "11:00",
    category: "meetings",
    cardAccent: "peach",
    avatarUrls: [
      "https://ui-avatars.com/api/?name=AM&size=64&background=ffedd5&color=c2410c",
      "https://ui-avatars.com/api/?name=JK&size=64&background=fed7aa&color=ea580c",
    ],
  },
  {
    title: "Design workshop",
    startTime: "14:00",
    endTime: "15:00",
    category: "events",
    cardAccent: "sky",
    avatarUrls: [
      "https://ui-avatars.com/api/?name=UX&size=64&background=e0f2fe&color=0369a1",
      "https://ui-avatars.com/api/?name=PM&size=64&background=bae6fd&color=075985",
    ],
  },
];

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Manila calendar day at local midnight — avoids SSR (server TZ) vs browser TZ mismatches for the same instant. */
function startOfManilaCalendarDay(instant: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(instant);
  const y = Number(parts.find((p) => p.type === "year")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "month")?.value ?? 1) - 1;
  const d = Number(parts.find((p) => p.type === "day")?.value ?? 1);
  return new Date(y, m, d, 0, 0, 0, 0);
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Sunday 00:00 of the week containing `d`. */
function startOfWeekSunday(d: Date): Date {
  const x = startOfLocalDay(d);
  const dow = x.getDay();
  x.setDate(x.getDate() - dow);
  return x;
}

/** Fourteen dates (2 weeks) starting Sunday of the week containing `d`. */
function getWeekDatesContaining(d: Date): Date[] {
  const start = startOfWeekSunday(d);
  let cursor = startOfLocalDay(new Date(start));
  const out: Date[] = [cursor];
  for (let i = 1; i < 14; i++) {
    const next = new Date(cursor);
    next.setDate(next.getDate() + 1);
    cursor = startOfLocalDay(next);
    out.push(cursor);
  }
  return out;
}

/** 6x7 month grid (Sunday-first) containing dates for the selected month view. */
function getMonthGridDates(d: Date): Date[] {
  const start = startOfLocalDay(new Date(d.getFullYear(), d.getMonth(), 1));
  const startWeekday = start.getDay();
  start.setDate(start.getDate() - startWeekday);

  const out: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    out.push(startOfLocalDay(day));
  }
  return out;
}

function formatMonthYearComma(date: Date): string {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

/** Slim accent rail — category hint (solid). */
function scheduleEventAccentBarClass(_accent: ScheduleCardAccent): string {
  return "bg-[#355f88]";
}

function scheduleEventRowSurfaceClass(
  _accent: ScheduleCardAccent,
  theme: "light" | "dark"
): string {
  if (theme === "dark") {
    return cn(
      "relative overflow-hidden rounded-2xl border border-white/[0.08]",
      "bg-white/[0.06]",
      "backdrop-blur-xl shadow-[0_4px_28px_-6px_rgba(0,0,0,0.45)]",
      "transition-[border-color,box-shadow,transform] duration-200",
      "hover:border-white/[0.12] hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.55)] hover:-translate-y-px"
    );
  }
  return "rounded-2xl border border-[#c7d8ea] bg-[#EFF8FF] shadow-sm transition-shadow hover:shadow-md";
}

/** Y in viewBox 0–100 for a performance value 0–100% (matches chart padding). */
function employeePerformanceChartY(valuePercent: number): number {
  const height = 100;
  const usableHeight = 70;
  const topPadding = 15;
  const clamped = Math.max(0, Math.min(100, valuePercent));
    const normalized = clamped / 100;
  return height - (normalized * usableHeight + topPadding);
}

const DASHBOARD_MONTH_ABBRS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** X/Y in the same 0–100 space as the chart SVG (for aligning tooltip + dot with the line). */
function getPerformanceHighlightForMonth(
  points: { month: string; value: number }[],
  now: Date
): { xPercent: number; yPercent: number; value: number; month: string } {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
  }).format(now);
  let index = points.findIndex((p) => p.month === label);
  if (index < 0) {
    index = Math.max(0, points.length - 1);
  }
  const n = points.length;
  const xPercent = n <= 1 ? 50 : (index / (n - 1)) * 100;
  const yPercent = employeePerformanceChartY(points[index].value);
  return {
    xPercent,
    yPercent,
    value: points[index].value,
    month: points[index].month,
  };
}

function buildEmployeePerformancePath(points: { value: number }[]): string {
  if (!points.length) return "";

  const width = 100;
  const step = width / Math.max(points.length - 1, 1);

  let d = `M 0 ${employeePerformanceChartY(points[0].value)}`;

  for (let i = 1; i < points.length; i++) {
    const prevX = step * (i - 1);
    const prevY = employeePerformanceChartY(points[i - 1].value);
    const currX = step * i;
    const currY = employeePerformanceChartY(points[i].value);
    d += ` Q ${prevX} ${prevY} ${currX} ${currY}`;
  }

  return d;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getFirstName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0];
}

/** KPI tile palette: Gargoyle Gas #FFE14E, Space Cadet #192853, Alice Blue #EFF8FF. */
function EmployeeKpiCard({
  title,
  icon,
  metric,
  trend,
  theme,
  menuAriaLabel,
  metricSize = "default",
}: {
  title: string;
  icon: ReactNode;
  metric: ReactNode;
  trend: ReactNode;
  theme: "light" | "dark";
  menuAriaLabel: string;
  metricSize?: "default" | "large";
}) {
  const isDark = theme === "dark";
  const gradId = `spark-grad-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <Card
      className={cn(
        "group relative overflow-hidden rounded-3xl border transition-all duration-300",
        isDark
          ? "border-white/5 bg-[#161b30] text-slate-50 shadow-xl"
          : "border-[#c7d8ea] bg-white text-[#192853] shadow-[0_4px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)]"
      )}
    >
      <div className="p-5">
        {/* Top: Icon + Title */}
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-xl border transition-all duration-500 group-hover:scale-105 [&>svg]:size-5",
              "bg-[#FFE14E] text-[#192853] border-[#FFE14E]/20 shadow-sm"
            )}
          >
            {icon}
          </div>
          <span className="text-[17px] font-bold tracking-tight">{title}</span>
        </div>

        {/* Dashed Line (Enhanced Visibility) */}
        <div
          className={cn(
            "my-4 -mx-5 border-t-2 border-dashed transition-all duration-300",
            isDark ? "border-white/20" : "border-slate-300"
          )}
        />

        {/* Bottom: Metric + Trend + Sparkline */}
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <div
              className={cn(
                "font-black tracking-tighter tabular-nums",
                metricSize === "large" ? "text-3xl" : "text-4xl",
                isDark ? "text-white" : "text-[#192853]"
              )}
            >
              {metric}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-medium">
              {trend}
            </div>
          </div>

          {/* Sparkline Visual with Area Fill (Edgy Polylines) */}
          <div className="h-10 w-24 opacity-80 transition-opacity group-hover:opacity-100">
            <svg
              viewBox="0 0 100 40"
              className="h-full w-full"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={isDark ? "#FFE14E" : "#FFE14E"}
                    stopOpacity="0.3"
                  />
                  <stop
                    offset="100%"
                    stopColor={isDark ? "#FFE14E" : "#FFE14E"}
                    stopOpacity="0"
                  />
                </linearGradient>
              </defs>
              <path
                d="M0,30 L15,35 L30,20 L45,25 L60,10 L75,15 L90,5 L100,10"
                fill="none"
                stroke={isDark ? "#FFE14E" : "#192853"}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-sm"
              />
              <path
                d="M0,30 L15,35 L30,20 L45,25 L60,10 L75,15 L90,5 L100,10 L100,40 L0,40 Z"
                fill={`url(#${gradId})`}
              />
            </svg>
          </div>
        </div>
      </div>
    </Card>
  );
}

function HRStaffWorkforceGaugeCard({
  theme,
  totalEmployees,
}: {
  theme: "light" | "dark";
  totalEmployees: number;
}) {
  const isDark = theme === "dark";

  // Dynamic department-based data distribution
  const rawData = [
    { name: "Executive Office", ratio: 0.05, color: "#FEF9C3" }, // Lightest Yellow
    { name: "Finance", ratio: 0.15, color: "#FFE14E" }, // Mid Yellow (Performance)
    { name: "Operations", ratio: 0.12, color: "#EAB308" }, // Darker Yellow
    { name: "Engineering", ratio: 0.20, color: "#93c5fd" },
    { name: "Information Technology", ratio: 0.13, color: "#3b82f6" },
    { name: "Marketing", ratio: 0.10, color: "#1e3a8a" },
    { name: "Customer service", ratio: 0.15, color: "#e2e8f0" },
    { name: "HR", ratio: 0.10, color: "#475569" },
  ];

  let currentSum = 0;
  const data = rawData.map((d, i) => {
    let val;
    if (i === rawData.length - 1) {
      val = Math.max(0, totalEmployees - currentSum);
    } else {
      val = Math.round(totalEmployees * d.ratio);
      currentSum += val;
    }
    return { name: d.name, value: val, color: d.color };
  });

  return (
    <Card
      className={cn(
        "flex h-fit flex-col overflow-hidden rounded-[32px] border transition-all duration-300",
        isDark
          ? "border-white/10 bg-[#161b30] text-slate-50 shadow-xl"
          : "border-[#c7d8ea] bg-white text-[#192853] shadow-sm hover:shadow-md"
      )}
    >
      <CardHeader className="flex shrink-0 flex-row items-center justify-between px-6 pt-5 pb-0">
        <div>
          <CardTitle className="text-xl font-semibold tracking-tight">Track your team</CardTitle>
          <p className={cn(
            "mt-1 text-[10px] uppercase tracking-wider font-semibold",
            isDark ? "text-slate-400" : "text-[#8097ad]"
          )}>
            Total employee
          </p>
        </div>
        <button
          type="button"
          className={cn(
            "flex size-9 items-center justify-center rounded-full transition-all",
            isDark
              ? "bg-white/10 text-white hover:bg-white/20"
              : "bg-white text-[#192853] shadow-sm hover:bg-slate-50"
          )}
        >
          <ChevronRight className="size-5" />
        </button>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col px-6 pb-6 pt-0">
        {/* Gauge Chart Area */}
        <div className="relative mt-0 flex h-[140px] w-full items-center justify-center overflow-hidden">
          <div
            className={cn(
              "h-[170px] w-[260px] rounded-t-[260px] border-x border-t border-b-0",
              isDark ? "border-white/15 bg-white/5" : "border-[#dbe7f3] bg-[#f8fbff]"
            )}
            aria-hidden="true"
          />

          {/* Center Label */}
          <div className="absolute bottom-2 flex flex-col items-center">
            <span className="text-3xl font-bold tracking-tighter">{totalEmployees}</span>
            <span className={cn("text-[11px] font-semibold uppercase tracking-widest opacity-60", isDark ? "text-slate-400" : "text-[#192853]")}>
              Total members
            </span>
          </div>
        </div>

        {/* Departments List Inner Card - Matched with Performance Overview style */}
        <div className={cn(
          "mt-6 rounded-[22px] border p-6 transition-all duration-300",
          isDark 
            ? "border-white/10 bg-[#161b30]" 
            : "border-[#dbe7f3] bg-[#f8fbff]"
        )}>
          {/* Legend - Two column grid centered horizontally */}
          <div className="mx-auto grid w-fit grid-cols-2 gap-x-12 gap-y-3.5">
            {data.map((item) => (
              <div key={item.name} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div
                    className="size-3 shrink-0 rounded-[3px]"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className={cn("truncate text-[13px] font-medium leading-tight", isDark ? "text-slate-300" : "text-[#192853]/80")}>
                    {item.name}
                  </span>
                </div>
                <span className={cn("pl-4 text-[15px] font-bold", isDark ? "text-white" : "text-[#192853]")}>
                  {item.value} members
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PerformanceOverviewCard({
  theme,
  performanceRange,
  setPerformanceRange,
  showPerformanceMenu,
  setShowPerformanceMenu,
  employeePerformancePoints,
  employeePerformanceHighlight,
  className,
}: {
  theme: "light" | "dark";
  performanceRange: PerformanceRangeKey;
  setPerformanceRange: (next: PerformanceRangeKey) => void;
  showPerformanceMenu: boolean;
  setShowPerformanceMenu: (open: boolean) => void;
  employeePerformancePoints: Array<{ month: string; value: number }>;
  employeePerformanceHighlight: { month: string; value: number };
  className?: string;
}) {
  const isDark = theme === "dark";
  const data = EMPLOYEE_PERFORMANCE_DATA[performanceRange];
  const maxVal = Math.max(...employeePerformancePoints.map(p => p.value), 100);
  return (
    <Card
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-3xl border transition-all duration-300",
        isDark
          ? "border-white/5 bg-[#161b30] text-slate-50 shadow-xl"
          : "border-[#c7d8ea] bg-white text-[#192853] shadow-sm",
        className
      )}
    >
      <CardHeader className="flex shrink-0 flex-row items-center justify-between px-6 pt-4 pb-0">
        <CardTitle className="text-xl font-semibold tracking-tight">Performance Overview</CardTitle>
        <div className="relative">
          <button
            type="button"
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-sm font-medium transition-all",
              isDark
                ? "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                : "border-[#c9d8e7] bg-white text-slate-600 hover:bg-slate-50"
            )}
            onClick={() => setShowPerformanceMenu(!showPerformanceMenu)}
          >
            <span>{data.label}</span>
            <ChevronDown className="size-4 opacity-60" />
          </button>
          {showPerformanceMenu && (
            <div
              className={cn(
                "absolute right-0 z-30 mt-2 w-44 rounded-xl border p-1 shadow-2xl",
                isDark ? "border-white/10 bg-[#161b30]" : "border-[#c9d8e7] bg-white"
              )}
            >
              {(["lastYear", "last6Months", "thisYear"] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  className={cn(
                    "w-full rounded-lg px-4 py-2.5 text-left text-sm font-medium transition-colors",
                    isDark ? "hover:bg-white/5" : "hover:bg-slate-50"
                  )}
                  onClick={() => {
                    setPerformanceRange(range);
                    setShowPerformanceMenu(false);
                  }}
                >
                  {EMPLOYEE_PERFORMANCE_DATA[range].label}
                </button>
              ))}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col px-6 pb-6 pt-0">
        <div className="animate-perf-metric mb-2 space-y-0.5">
          <p className={cn(
            "text-[10px] uppercase tracking-wider",
            isDark ? "text-slate-400" : "text-[#8097ad]"
          )}>
            Avg Performance Score
          </p>
          <div className="flex items-center gap-4">
            <h3 className="text-3xl font-bold tracking-tighter">
              {data.overallText}
            </h3>
            <div className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-500">
              +{data.delta}% <TrendingUp className="size-3" />
            </div>
          </div>
        </div>

        {/* Inner Chart Card - Styled like Calendar card */}
        <div className={cn(
          "relative mt-auto rounded-[22px] border p-6 transition-all duration-300",
          isDark 
            ? "border-white/10 bg-[#161b30]" 
            : "border-[#dbe7f3] bg-[#f8fbff]"
        )} key={performanceRange}>
          {/* Chart Area */}
          <div className="relative flex flex-1 flex-col justify-end min-h-[220px] pt-12">
            {/* Grid Lines */}
            <div className="animate-perf-chart-grid absolute inset-0 flex flex-col justify-between pt-12 pb-16 pointer-events-none">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn("w-full border-t border-dashed", isDark ? "border-white/5" : "border-slate-100")}
                />
              ))}
            </div>

            <div className="relative z-10 grid flex-1 grid-cols-12 items-end gap-3 px-1 sm:gap-4">
              {employeePerformancePoints.map((point) => {
                const isActive = point.month === employeePerformanceHighlight.month;
                // Normalize height so the max value is roughly 90% of the container
                const height = `${Math.max(10, (point.value / maxVal) * 90)}%`;

                return (
                  <div key={point.month} className="group relative flex h-full flex-col items-center justify-end">
                    {/* Tooltip for Active Bar */}
                    {isActive && (
                      <div
                        className="animate-perf-badge absolute -top-16 z-20 flex flex-col items-center"
                        style={{ "--perf-badge-delay": "520ms" } as React.CSSProperties}
                      >
                        <div className="rounded-xl bg-[#FFE14E] px-3 py-2 shadow-xl border border-[#e4c835]">
                          <p className="text-[10px] font-medium text-[#192853]/60">{point.month} 2025</p>
                          <p className="text-sm font-semibold text-[#192853] whitespace-nowrap">{point.value}{data.unit} Score</p>
                        </div>
                        <div className="h-2 w-2 rotate-45 bg-[#FFE14E] border-b border-r border-[#e4c835] -mt-1" />
                      </div>
                    )}

                    {/* Indicator Dot for Active Bar */}
                    {isActive && (
                      <div
                        className="animate-perf-badge absolute -top-4 z-10 size-3 rounded-full border-2 border-white bg-[#FFE14E] shadow-md ring-2 ring-[#FFE14E]/10"
                        style={{ "--perf-badge-delay": "460ms" } as React.CSSProperties}
                      />
                    )}

                    {/* Bar */}
                    <div
                      className={cn(
                        "animate-perf-bar-fill relative w-10 sm:w-12 overflow-hidden rounded-lg transition-all duration-700",
                        isActive
                          ? "bg-[#FFE14E] shadow-lg"
                          : isDark ? "bg-[#2a3a67]" : "bg-[#192853]"
                      )}
                      style={{
                        height,
                        "--perf-bar-delay": `${point.month === employeePerformanceHighlight.month ? 220 : employeePerformancePoints.findIndex((p) => p.month === point.month) * 55}ms`,
                      } as React.CSSProperties}
                    >
                      {/* Diagonal Striped Pattern Overlay */}
                      <div
                        className={cn(
                          "absolute inset-0 opacity-[0.12]",
                          isActive ? "opacity-[0.2]" : ""
                        )}
                        style={{
                          backgroundImage: `repeating-linear-gradient(45deg, ${isActive ? "#192853" : "#fff"}, ${isActive ? "#192853" : "#fff"} 1px, transparent 1px, transparent 8px)`,
                        }}
                      />
                    </div>

                    {/* X-Axis Label */}
                    <span className={cn(
                      "mt-4 text-[10px] font-medium uppercase tracking-widest",
                      isDark ? "text-slate-400" : "text-[#8097ad]"
                    )}>
                      {point.month.substring(0, 3)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


function getTimeGreeting(date: Date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

function useTimeGreeting() {
  const [greeting, setGreeting] = useState("Good Morning");

  useEffect(() => {
    const tick = () => setGreeting(getTimeGreeting());
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return greeting;
}

export default function DashboardPage() {
  const { user: currentUser } = useCurrentUser();
  const { theme, toggleTheme } = useTheme();
  const greeting = useTimeGreeting();
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>(() => {
    if (typeof window === "undefined") return todayScheduleItems;
    const stored = loadScheduleFromStorage();
    return stored.length > 0 ? stored : todayScheduleItems;
  });
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleDialogDate, setScheduleDialogDate] = useState(() => getTodayDateKey());
  const [scheduleDialogCategory, setScheduleDialogCategory] =
    useState<AddableScheduleCategory>("events");
  const [editingScheduleItem, setEditingScheduleItem] = useState<ScheduleItem | null>(null);
  const [addedEmployees, setAddedEmployees] = useState<Employee[]>(() =>
    typeof window === "undefined" ? [] : loadAddedEmployees()
  );
  const [whatsOnTab, setWhatsOnTab] = useState("timeoff");
  const [showBirthdayConfetti, setShowBirthdayConfetti] = useState(false);
  const whatsOnRef = useRef<HTMLDivElement | null>(null);
  const todayScheduleRef = useRef<HTMLDivElement | null>(null);
  const [whatsOnHighlight, setWhatsOnHighlight] = useState(false);
  const [todayScheduleHighlight, setTodayScheduleHighlight] = useState(false);
  const [widgets, setWidgets] = useState<DashboardWidgets>(() =>
    loadDashboardWidgets()
  );
  const [widgetDialogOpen, setWidgetDialogOpen] = useState(false);
  const [performanceRange, setPerformanceRange] = useState<PerformanceRangeKey>("thisYear");
  const [showPerformanceMenu, setShowPerformanceMenu] = useState(false);
  const employeePerformancePoints = EMPLOYEE_PERFORMANCE_DATA[performanceRange].points;
  const employeePerformanceMin = Math.min(
    ...employeePerformancePoints.map((point) => point.value)
  );
  const employeePerformanceMax = Math.max(
    ...employeePerformancePoints.map((point) => point.value)
  );
  const employeePerformanceRangeSpan = Math.max(
    1,
    employeePerformanceMax - employeePerformanceMin
  );
  const employeePerformanceHighlight = getPerformanceHighlightForMonth(
    employeePerformancePoints,
    new Date()
  );
  const [announcementItems, setAnnouncementItems] = useState<AnnouncementItem[]>(() =>
    typeof window === "undefined" ? DEFAULT_ANNOUNCEMENTS : loadAnnouncementsFromStorage()
  );
  const [announcementDialogOpen, setAnnouncementDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementItem | null>(null);
  const [announcementMenuId, setAnnouncementMenuId] = useState<string | null>(null);

  const [employeeDashboardNotes, setEmployeeDashboardNotes] = useState<
    EmployeeDashboardNote[]
  >(() =>
    typeof window === "undefined" ? DEFAULT_EMPLOYEE_NOTES : loadEmployeeNotesFromStorage()
  );
  const [employeeNoteDialogOpen, setEmployeeNoteDialogOpen] = useState(false);
  const [notesFloatingOpen, setNotesFloatingOpen] = useState(false);
  const [notesFloatingExpanded, setNotesFloatingExpanded] = useState(true);
  const [newEmployeeNoteTitle, setNewEmployeeNoteTitle] = useState("");
  const [newEmployeeNoteDescription, setNewEmployeeNoteDescription] =
    useState("");

  const [scheduleSelectedDate, setScheduleSelectedDate] = useState(
    () => new Date(2000, 0, 1)
  );
  useLayoutEffect(() => {
    setScheduleSelectedDate(startOfManilaCalendarDay(new Date()));
  }, []);
  const [scheduleTab, setScheduleTab] = useState<ScheduleCategory>("meetings");
  const [scheduleCalendarView, setScheduleCalendarView] =
    useState<ScheduleCalendarView>("fullMonth");
  const goToPreviousScheduleMonth = useCallback(() => {
    setScheduleSelectedDate((prev) =>
      startOfLocalDay(
        new Date(prev.getFullYear(), prev.getMonth() - 1, Math.min(prev.getDate(), 28))
      )
    );
  }, []);
  const goToNextScheduleMonth = useCallback(() => {
    setScheduleSelectedDate((prev) =>
      startOfLocalDay(
        new Date(prev.getFullYear(), prev.getMonth() + 1, Math.min(prev.getDate(), 28))
      )
    );
  }, []);
  const goToTodayScheduleDate = useCallback(() => {
    setScheduleSelectedDate(startOfLocalDay(new Date()));
  }, []);

  useEffect(() => {
    if (currentUser.role !== "EMPLOYEE") return;
    saveEmployeeNotesToStorage(employeeDashboardNotes);
  }, [employeeDashboardNotes, currentUser.role]);

  useEffect(() => {
    if (whatsOnTab !== "birthday") return;
    const showId = window.setTimeout(() => setShowBirthdayConfetti(true), 0);
    const hideId = window.setTimeout(() => setShowBirthdayConfetti(false), 1500);
    return () => {
      window.clearTimeout(showId);
      window.clearTimeout(hideId);
    };
  }, [whatsOnTab]);

  const addScheduleItemForDate = useCallback(
    (date: string, item: Omit<ScheduleItem, "id">) => {
      const newItem: ScheduleItem = {
        ...item,
        date: item.date ?? date,
        id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      };
      setScheduleItems((prev) => {
        const next = [...prev, newItem].sort(
          (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
        );
        saveScheduleToStorage(next);
        return next;
      });
      return newItem;
    },
    []
  );

  const addScheduleItem = useCallback((item: Omit<ScheduleItem, "id">) => {
    const date = scheduleDialogDate || getTodayDateKey();
    addScheduleItemForDate(date, item);
  }, [addScheduleItemForDate, scheduleDialogDate]);

  const removeScheduleItem = useCallback((id: string) => {
    setScheduleItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      saveScheduleToStorage(next);
      return next;
    });
  }, []);

  const updateScheduleItem = useCallback((id: string, updates: Omit<ScheduleItem, "id">) => {
    setScheduleItems((prev) => {
      const next = prev
        .map((item) => (item.id === id ? { ...item, ...updates } : item))
        .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
      saveScheduleToStorage(next);
      return next;
    });
  }, []);

  const addAnnouncement = useCallback((item: Omit<AnnouncementItem, "id">) => {
    const newItem: AnnouncementItem = {
      ...item,
      id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    };
    setAnnouncementItems((prev) => {
      const next = [newItem, ...prev];
      saveAnnouncementsToStorage(next);
      return next;
    });
  }, []);

  const updateAnnouncement = useCallback((id: string, updates: Omit<AnnouncementItem, "id">) => {
    setAnnouncementItems((prev) => {
      const next = prev.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      );
      saveAnnouncementsToStorage(next);
      return next;
    });
  }, []);

  const removeAnnouncement = useCallback((id: string) => {
    setAnnouncementMenuId(null);
    setAnnouncementItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      saveAnnouncementsToStorage(next);
      return next;
    });
  }, []);

  const toggleEmployeeNoteComplete = useCallback((id: string) => {
    setEmployeeDashboardNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, completed: !n.completed } : n))
    );
  }, []);

  const saveNewEmployeeNote = useCallback(() => {
    const title = newEmployeeNoteTitle.trim();
    if (!title) return;
    const note: EmployeeDashboardNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      description: newEmployeeNoteDescription.trim(),
      completed: false,
      tags: [
        { label: "Today", variant: "neutral" },
        { label: "Waiting Feedback", variant: "peach" },
      ],
    };
    setEmployeeDashboardNotes((prev) => [note, ...prev]);
    setNewEmployeeNoteTitle("");
    setNewEmployeeNoteDescription("");
    setEmployeeNoteDialogOpen(false);
  }, [newEmployeeNoteTitle, newEmployeeNoteDescription]);

  const pendingCount = getRequestsByStatus("PENDING").length;
  const allEmployees: Employee[] = [...employees, ...addedEmployees];

  const scheduleMonthGridDays = useMemo(
    () => getMonthGridDates(scheduleSelectedDate),
    [scheduleSelectedDate]
  );
  const scheduleMonthKey = `${scheduleSelectedDate.getFullYear()}-${String(
    scheduleSelectedDate.getMonth() + 1
  ).padStart(2, "0")}`;
  const scheduleVisibleDays = useMemo(
    () =>
      scheduleCalendarView === "twoWeeks"
        ? scheduleMonthGridDays.slice(0, 14)
        : scheduleMonthGridDays,
    [scheduleCalendarView, scheduleMonthGridDays]
  );
  const visibleCalendarYears = useMemo(
    () => Array.from(new Set(scheduleVisibleDays.map((d) => d.getFullYear()))),
    [scheduleVisibleDays]
  );
  const scheduleYearHolidayEvents = useMemo<EmployeeDashboardScheduleEvent[]>(
    () =>
      buildPhilippineHolidays(scheduleSelectedDate.getFullYear()).map((h, idx) => ({
        id: `ph-holiday-${scheduleSelectedDate.getFullYear()}-${idx}`,
        date: h.date,
        title: h.title,
        location: "Philippines",
        startTime: "00:00",
        endTime: "23:59",
        category: "holidays",
        cardAccent: "sky",
        avatarUrls: [
          "https://ui-avatars.com/api/?name=PH&size=64&background=e0f2fe&color=0369a1",
        ],
      })),
    [scheduleSelectedDate]
  );
  const scheduleEventDateKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const ev of DEMO_EMPLOYEE_SCHEDULE_EVENTS) {
      keys.add(ev.date);
    }
    for (const year of visibleCalendarYears) {
      for (const h of buildPhilippineHolidays(year)) {
        keys.add(h.date);
      }
    }
    if (scheduleItems.length > 0) {
      const todayKey = getTodayDateKey();
      for (const item of scheduleItems) {
        keys.add(item.date ?? todayKey);
      }
    }
    return keys;
  }, [scheduleItems, visibleCalendarYears]);
  const holidayDateKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const year of visibleCalendarYears) {
      for (const h of buildPhilippineHolidays(year)) {
        keys.add(h.date);
      }
    }
    return keys;
  }, [visibleCalendarYears]);

  const employeeScheduleDayEvents = useMemo(() => {
    const key = toLocalDateKey(scheduleSelectedDate);
    const demo = DEMO_EMPLOYEE_SCHEDULE_EVENTS.filter((e) => e.date === key);
    const todayKey = getTodayDateKey();
    const fromAgenda: EmployeeDashboardScheduleEvent[] = scheduleItems
      .filter((item) => (item.date ?? todayKey) === key)
      .map((item) => {
        const isInterview = item.type === "interview";
        const isMeeting = item.type === "meeting";
        const category: ScheduleCategory =
          isInterview || isMeeting ? "meetings" : "events";
        const cardAccent: ScheduleCardAccent = isInterview
          ? "lavender"
          : isMeeting
            ? "peach"
            : "sky";
        return {
          id: `agenda-${item.id}`,
          date: key,
          title: item.title,
          location: item.location?.trim() || "Main Office",
          startTime: item.startTime,
          endTime: item.endTime,
          category,
          cardAccent,
          avatarUrls: [
            "https://ui-avatars.com/api/?name=Me&size=64&background=e2e8f0&color=334155",
            "https://ui-avatars.com/api/?name=+1&size=64&background=f1f5f9&color=475569",
          ],
        };
      });
    const showReferenceFallback =
      key === todayKey && demo.length === 0 && fromAgenda.length === 0;
    const referenceRows: EmployeeDashboardScheduleEvent[] = showReferenceFallback
      ? REFERENCE_SCHEDULE_FALLBACK_TODAY.map((row, i) => ({
          ...row,
          id: `ref-fallback-${i}`,
          date: key,
        }))
      : [];
    return [...demo, ...fromAgenda, ...referenceRows].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    );
  }, [scheduleSelectedDate, scheduleItems]);

  const filteredScheduleDayEvents = useMemo(
    () =>
      scheduleTab === "holidays"
        ? scheduleYearHolidayEvents.filter(
            (h) => h.date === toLocalDateKey(scheduleSelectedDate)
          )
        : employeeScheduleDayEvents.filter((e) => e.category === scheduleTab),
    [employeeScheduleDayEvents, scheduleTab, scheduleYearHolidayEvents, scheduleSelectedDate]
  );

  const hasHolidayInSelectedMonth = useMemo(() => {
    const m = String(scheduleSelectedDate.getMonth() + 1).padStart(2, "0");
    return scheduleYearHolidayEvents.some((h) => h.date.startsWith(`${scheduleSelectedDate.getFullYear()}-${m}-`));
  }, [scheduleSelectedDate, scheduleYearHolidayEvents]);

  const todayScheduleItemsOnly = useMemo(() => {
    const todayKey = getTodayDateKey();
    return scheduleItems.filter((item) => (item.date ?? todayKey) === todayKey);
  }, [scheduleItems]);

  // Employee-specific KPI data
  const myLeaveBalances = useMemo(
    () => getLeaveBalancesByEmployee(currentUser.employeeId || ""),
    [currentUser.employeeId]
  );
  const totalLeaveBalance = useMemo(
    () => myLeaveBalances.reduce((acc, curr) => acc + curr.balanceDays, 0),
    [myLeaveBalances]
  );
  const myPendingRequestsCount = useMemo(
    () => getRequestsByStatus("PENDING").filter(r => r.createdBy === currentUser.id).length,
    [currentUser.id]
  );
  const nextHoliday = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return scheduleYearHolidayEvents
      .filter(h => new Date(h.date) >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
  }, [scheduleYearHolidayEvents]);

  const daysUntilNextHoliday = useMemo(() => {
    if (!nextHoliday) return 0;
    const diff = new Date(nextHoliday.date).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [nextHoliday]);

  const openScheduleDialogForDate = useCallback((dateKey: string) => {
    const category: AddableScheduleCategory =
      scheduleTab === "meetings" ? "meetings" : "events";
    setScheduleTab(category);
    setScheduleSelectedDate(startOfLocalDay(new Date(`${dateKey}T12:00:00`)));
    setEditingScheduleItem(null);
    setScheduleDialogCategory(category);
    setScheduleDialogDate(dateKey);
    setScheduleDialogOpen(true);
  }, [scheduleTab]);

  // Employee dashboard – Finexy-style layout
  if (currentUser.role === "EMPLOYEE") {
    const employeeDashCardClass = cn(
      "employee-dash-card rounded-[32px] shadow-sm",
      theme === "dark" ? DASHBOARD_CARD_DARK_CLASS : "border-none bg-white text-[#192853]"
    );

    /** Matches KPI row: glass navy in dark mode, flat white in light. */
    const employeeMainPanelClass = cn(
      "flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-3xl",
      theme === "dark"
        ? cn(DASHBOARD_CARD_DARK_CLASS, "shadow-lg shadow-black/35 backdrop-blur-xl")
        : "border border-border/80 bg-white text-[#192853] shadow-sm"
    );

    /** Inner glass tiles (Recent rows, Calendar nav strip) — matches frosted row reference. */
    const employeeGlassInlayClass = cn(
      "rounded-3xl border backdrop-blur-md",
      theme === "dark"
        ? "border-white/10 bg-white/[0.07] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
        : "border-slate-200/90 bg-white/90 shadow-sm"
    );

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-6">
          <EmployeeModuleTopbar searchPlaceholder="Search" />
          <EmployeeSectionHeader title="Home" />
        </div>
        {/* Top: four KPI cards in one row (2×2 on small screens) */}
        <section className="flex flex-col gap-4 lg:gap-5">
          <div
            className={cn(
              "grid min-w-0 grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4",
              !(widgets.performanceOverview ?? true) && "mx-auto w-full max-w-4xl"
            )}
          >
            <EmployeeKpiCard
              theme={theme}
              title="Leave Balance"
              menuAriaLabel="Leave balance options"
              icon={<CalendarDays className="size-8" strokeWidth={2} />}
              metric={totalLeaveBalance}
              trend={
                <>
                  <span className="font-bold text-[#192853]">+5%</span>
                  <span className={theme === "dark" ? "text-slate-400" : "text-slate-500"}>
                    increase from Jan
                  </span>
                </>
              }
            />

            <EmployeeKpiCard
              theme={theme}
              title="My Requests"
              menuAriaLabel="Pending requests options"
              icon={<ClipboardList className="size-8" strokeWidth={2} />}
              metric={myPendingRequestsCount}
              trend={
                <>
                  <span className="font-bold text-[#192853]">Active</span>
                  <span className={theme === "dark" ? "text-slate-400" : "text-slate-500"}>
                    awaiting response
                  </span>
                </>
              }
            />

            <EmployeeKpiCard
              theme={theme}
              title="Attendance Rate"
              menuAriaLabel="Attendance options"
              icon={<Percent className="size-8" strokeWidth={2} />}
              metric="98%"
              trend={
                <>
                  <span className="font-bold text-[#192853]">+2.4%</span>
                  <span className={theme === "dark" ? "text-slate-400" : "text-slate-500"}>
                    vs last month
                  </span>
                </>
              }
            />

            <EmployeeKpiCard
              theme={theme}
              title="Next Holiday"
              menuAriaLabel="Holiday options"
              icon={<Gift className="size-8" strokeWidth={2} />}
              metric={daysUntilNextHoliday === 0 ? "Today" : `${daysUntilNextHoliday}d`}
              trend={
                <>
                  <span className="font-bold text-[#192853]">Upcoming</span>
                  <span className={theme === "dark" ? "text-slate-400" : "text-slate-500"}>
                    {nextHoliday?.title || "No holiday"}
                  </span>
                </>
              }
            />
                      </div>
        </section>

        {/* Performance Overview (top) · Recent activity (below) · Calendar (right) */}
        <section
          className={cn(
            "grid gap-4 lg:items-start",
            (widgets.performanceOverview ?? true)
              ? "lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)_minmax(0,1.1fr)]"
              : "lg:grid-cols-2"
          )}
        >
          <div
            className={cn(
              "order-1 flex min-w-0 flex-col gap-4",
              (widgets.performanceOverview ?? true)
                ? "lg:col-start-1 lg:col-span-2 lg:row-start-1"
                : "lg:col-start-1"
            )}
          >
            {/* Recent activity — modern stacked feed */}
          <Card
            className={cn(
              "flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-3xl",
              theme === "dark"
                ? DASHBOARD_CARD_DARK_CLASS
                : "border border-border/80 bg-white text-[#192853] shadow-sm",
              "order-2"
            )}
          >
              <CardHeader className="shrink-0 space-y-0 px-4 pb-2 pt-3.5 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <CardTitle
                      className={cn(
                        "text-base font-semibold tracking-tight",
                        theme === "dark" ? "text-slate-50" : "text-[#111827]"
                      )}
                    >
                      Recent activity
                </CardTitle>
                    <p
                      className={cn(
                        "text-xs font-medium leading-snug",
                        theme === "dark" ? "text-slate-400" : "text-muted-foreground"
                      )}
                    >
                      Live updates from your team and workflows
                    </p>
                </div>
                </div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-hide px-4 pb-4 pt-2 sm:px-5">
                <ul className="flex flex-col gap-2" role="list">
                  {EMPLOYEE_RECENT_ACTIVITY.map((item) => (
                    <li key={item.id}>
                      <div
                        className={cn(
                          "group relative flex items-start gap-2.5 p-2.5 transition-all duration-200 sm:gap-3 sm:p-3",
                          employeeGlassInlayClass,
                          theme === "dark"
                            ? "hover:border-white/[0.16] hover:bg-white/[0.1] hover:shadow-[0_8px_32px_-14px_rgba(0,0,0,0.45)]"
                            : "hover:border-slate-300/90 hover:bg-white hover:shadow-md"
                        )}
                      >
                        <div className="relative shrink-0">
                          <Image
                            src={item.avatarUrl}
                            alt={item.name}
                            width={40}
                            height={40}
                            className={cn(
                              "size-10 rounded-full object-cover shadow-md ring-2 transition-transform duration-200 group-hover:scale-[1.02]",
                              theme === "dark"
                                ? "ring-white/15 ring-offset-2 ring-offset-[#1B223D]"
                                : "ring-white ring-offset-2 ring-offset-slate-100"
                            )}
                          />
                          <span
                            className={cn(
                              "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-[2.5px] shadow-sm",
                              theme === "dark"
                                ? "border-[#1B223D]"
                                : "border-white",
                              item.statusDot === "online"
                                ? "bg-emerald-500"
                                : "bg-slate-400 dark:bg-slate-500"
                            )}
                            aria-hidden
                          />
                </div>
                        <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span
                              className={cn(
                                "text-sm font-semibold tracking-tight",
                                theme === "dark" ? "text-slate-50" : "text-[#111827]"
                              )}
                            >
                              {item.name}
                  </span>
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
                                theme === "dark"
                                  ? "bg-white/[0.08] text-slate-400"
                                  : "bg-slate-100 text-slate-500"
                              )}
                            >
                              {item.timeAgo}
                  </span>
                </div>
                          <p
                            className={cn(
                              "text-[13px] leading-relaxed",
                              theme === "dark" ? "text-slate-300/90" : "text-[#4b5563]"
                            )}
                          >
                            {item.segments.map((seg, idx) =>
                              seg.type === "link" ? (
                                <Link
                                  key={`${item.id}-s-${idx}`}
                                  href={seg.href}
                                  className={cn(
                                    "font-semibold transition-colors",
                                    theme === "dark"
                                      ? "rounded-md text-sky-400 decoration-sky-400/50 underline-offset-2 hover:bg-sky-500/10 hover:text-sky-300 hover:underline"
                                      : "rounded-md text-[#2563eb] decoration-blue-600/40 underline-offset-2 hover:bg-blue-500/10 hover:text-[#1d4ed8] hover:underline"
                                  )}
                                >
                                  {seg.text}
                                </Link>
                              ) : (
                                <span key={`${item.id}-s-${idx}`}>{seg.text}</span>
                              )
                            )}
                          </p>
                        </div>
                  <Button
                    type="button"
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "size-8 shrink-0 rounded-lg border opacity-70 transition-all duration-200 group-hover:opacity-100",
                            theme === "dark"
                              ? "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10 hover:text-slate-50"
                              : "border-slate-200/90 bg-white text-slate-500 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:text-[#111827]"
                          )}
                          aria-label={`View details for ${item.name}`}
                        >
                          <Eye className="size-4" />
                  </Button>
                </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {(widgets.performanceOverview ?? true) && (
              <PerformanceOverviewCard
                theme={theme}
                performanceRange={performanceRange}
                setPerformanceRange={setPerformanceRange}
                showPerformanceMenu={showPerformanceMenu}
                setShowPerformanceMenu={setShowPerformanceMenu}
                employeePerformancePoints={employeePerformancePoints}
                employeePerformanceHighlight={employeePerformanceHighlight}
                className="order-1"
              />
            )}
          </div>

            {/* Schedule / Calendar — week strip + tabs + accent list cards */}
            <Card
              id="employee-schedule-card"
              className={cn(
                "flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-3xl lg:h-[830px]",
                theme === "dark"
                  ? DASHBOARD_CARD_DARK_CLASS
                  : "border border-[#c7d8ea] bg-white text-[#192853] shadow-sm",
                "order-3",
                (widgets.performanceOverview ?? true) &&
                  "lg:col-start-3 lg:row-start-1"
              )}
            >
              <CardContent className="min-h-0 flex flex-1 flex-col gap-3 overflow-hidden px-4 pb-4 pt-4 sm:px-5 sm:pt-5">
                <div
                  key={`cal-h-${scheduleMonthKey}`}
                  className="animate-cal-header flex w-full min-w-0 flex-col gap-2.5"
                >
                  <div className="flex w-full items-center justify-center gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={goToPreviousScheduleMonth}
                        className={cn(
                          "inline-flex size-7 shrink-0 items-center justify-center rounded-full border",
                          theme === "dark"
                            ? "border-white/15 text-slate-200 hover:bg-white/[0.08]"
                            : "border-[#c9d8e7] text-[#355f88] hover:bg-[#f1f6fb]"
                        )}
                        aria-label="Previous month"
                      >
                        <ChevronLeft className="size-3.5" />
                      </button>
                      <span
                        className={cn(
                          "min-w-0 truncate text-[17px] font-semibold leading-none tracking-tight sm:text-[19px]",
                          theme === "dark" ? "text-slate-50" : "text-[#192853]"
                        )}
                      >
                        {scheduleSelectedDate.toLocaleString("en-US", { month: "long" })},{" "}
                        <span className={theme === "dark" ? "text-slate-300" : "text-[#5f7a96]"}>
                          {scheduleSelectedDate.getFullYear()}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={goToNextScheduleMonth}
                        className={cn(
                          "inline-flex size-7 shrink-0 items-center justify-center rounded-full border",
                          theme === "dark"
                            ? "border-white/15 text-slate-200 hover:bg-white/[0.08]"
                            : "border-[#c9d8e7] text-[#355f88] hover:bg-[#f1f6fb]"
                        )}
                        aria-label="Next month"
                      >
                        <ChevronRight className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex w-full items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={goToTodayScheduleDate}
                      className={cn(
                        "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-semibold",
                        theme === "dark"
                          ? "border-white/15 text-slate-200 hover:bg-white/[0.08]"
                          : "border-[#c9d8e7] text-[#355f88] hover:bg-[#f1f6fb]"
                      )}
                    >
                      Today
                    </button>
                    <div
                      className={cn(
                        "inline-flex items-center rounded-full border p-1",
                        theme === "dark"
                          ? "border-white/15 bg-white/[0.04]"
                          : "border-[#c9d8e7] bg-white"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setScheduleCalendarView("twoWeeks")}
                        className={cn(
                          "inline-flex h-8 items-center rounded-full px-2.5 text-xs font-semibold transition-colors",
                          scheduleCalendarView === "twoWeeks"
                            ? theme === "dark"
                              ? "bg-[#234271] text-white"
                              : "bg-[#234271] text-white"
                            : theme === "dark"
                              ? "text-slate-300 hover:bg-white/[0.08]"
                              : "text-[#5f7a96] hover:bg-[#f1f6fb]"
                        )}
                      >
                        2 Weeks
                      </button>
                      <button
                        type="button"
                        onClick={() => setScheduleCalendarView("fullMonth")}
                        className={cn(
                          "inline-flex h-8 items-center rounded-full px-2.5 text-xs font-semibold transition-colors",
                          scheduleCalendarView === "fullMonth"
                            ? theme === "dark"
                              ? "bg-[#234271] text-white"
                              : "bg-[#234271] text-white"
                            : theme === "dark"
                              ? "text-slate-300 hover:bg-white/[0.08]"
                              : "text-[#5f7a96] hover:bg-[#f1f6fb]"
                        )}
                      >
                        Full Month
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  className={cn(
                    "space-y-1.5 rounded-[22px] border p-2.5 sm:p-3",
                    theme === "dark"
                      ? "border-white/10 bg-[#161b30]"
                      : "border-[#dbe7f3] bg-[#f8fbff]"
                  )}
                >
                  <div className="grid grid-cols-7 gap-1.5">
                    {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map(
                      (label, idx) => {
                        const activeWeekday = idx === scheduleSelectedDate.getDay();
                        return (
                          <span
                            key={`cal-weekday-${label}`}
                            className={cn(
                              "rounded-full px-2 py-1 text-center text-[10px] font-semibold tracking-wide sm:text-[11px]",
                              activeWeekday
                                ? theme === "dark"
                                  ? "bg-[#2a3a67] text-slate-100"
                                  : "bg-[#d9e6f3] text-[#234271]"
                                : theme === "dark"
                                  ? "bg-white/[0.05] text-slate-400"
                                  : "bg-[#edf3f9] text-[#8097ad]"
                            )}
                          >
                            {label}
                          </span>
                        );
                      }
                    )}
                  </div>

                  <div
                    key={`cal-g-${scheduleMonthKey}-${scheduleCalendarView}`}
                    className="grid w-full min-w-0 grid-cols-7 gap-1.5"
                  >
                    {scheduleVisibleDays.map((day, dayIndex) => {
                      const selected = isSameCalendarDay(day, scheduleSelectedDate);
                      const sameMonth = day.getMonth() === scheduleSelectedDate.getMonth();
                      const dateKey = toLocalDateKey(day);
                      const hasEventDot = scheduleEventDateKeys.has(dateKey);
                      const isHolidayDate = holidayDateKeys.has(dateKey);
                      return (
                        <button
                          key={`cal-grid-${dayIndex}-${dateKey}`}
                          type="button"
                          onClick={() => setScheduleSelectedDate(startOfLocalDay(day))}
                          className={cn(
                            "animate-cal-day relative flex h-[48px] w-full items-center justify-center rounded-xl border text-[12px] font-semibold leading-none transition-colors sm:h-[50px] sm:text-[13px]",
                            selected
                              ? theme === "dark"
                                ? "border-[#355f88] bg-[#234271] text-white"
                                : "border-[#234271] bg-[#234271] text-white"
                              : theme === "dark"
                                ? "border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
                                : "border-[#e7eff7] bg-[#fdfefe] text-[#234271] hover:border-[#c7d8ea]"
                            ,
                            !selected &&
                              isHolidayDate &&
                              (theme === "dark"
                                ? "border-[#FFE14E]/70 bg-[#FFE14E]/10 text-[#FFE14E]"
                                : "border-[#e8c63f] bg-[#fff8db] text-[#7a5b00]")
                          )}
                          style={
                            {
                              ["--cal-day-delay" as string]: `${dayIndex * 20}ms`,
                            } as React.CSSProperties
                          }
                        >
                          {(hasEventDot || selected) && (
                            <span
                              className={cn(
                                "absolute top-1.5 size-1.5 rounded-full",
                                selected
                                  ? "bg-[#FFE14E]"
                                  : isHolidayDate
                                    ? "bg-[#FFE14E]"
                                  : theme === "dark"
                                    ? "bg-[#FFE14E]/85"
                                    : "bg-[#1f2f56]"
                              )}
                              aria-hidden
                            />
                          )}
                          <span
                            className={cn(
                              selected
                                ? "text-white"
                                : sameMonth
                                  ? theme === "dark"
                                    ? isHolidayDate
                                      ? "text-[#FFE14E]"
                                      : "text-slate-100"
                                    : "text-[#24355f]"
                                  : theme === "dark"
                                    ? "text-slate-500"
                                    : "text-[#b0c2d4]"
                            )}
                          >
                            {day.getDate()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div
                  key={`cal-n-${scheduleMonthKey}`}
                  className={cn(
                    "animate-cal-tabs mt-1 border-t pt-3",
                    theme === "dark" ? "border-white/10" : "border-[#c7d8ea]"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p
                      className={cn(
                        "text-base font-semibold",
                        theme === "dark" ? "text-slate-100" : "text-[#192853]"
                      )}
                    >
                      Your events
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => openScheduleDialogForDate(toLocalDateKey(scheduleSelectedDate))}
                      className={cn(
                        "relative z-40 h-8 rounded-full px-3 text-xs font-semibold pointer-events-auto",
                        "bg-[#234271] text-[#FFE14E] hover:bg-[#1c365f]"
                      )}
                    >
                      <Plus className="mr-1 size-3.5" />
                      Add new
                    </Button>
                  </div>

                  <nav
                    role="tablist"
                    aria-label="Schedule category"
                    className={cn(
                      "mt-3 border-b pb-1",
                      theme === "dark" ? "border-white/10" : "border-[#d7e4f1]"
                    )}
                  >
                    <div className="flex flex-wrap items-end justify-center gap-6">
                    {(
                      [
                        { key: "meetings" as const, label: "Meetings", Icon: MessagesSquare },
                        { key: "events" as const, label: "Events", Icon: Calendar },
                        { key: "holidays" as const, label: "Holidays", Icon: Gift },
                      ] as const
                    ).map(({ key, label, Icon }) => {
                      const active = scheduleTab === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setScheduleTab(key)}
                          className={cn(
                            "relative inline-flex items-center gap-1.5 pb-2 text-sm transition-colors",
                            active
                              ? theme === "dark"
                                ? "font-semibold text-slate-100"
                                : "font-semibold text-[#234271]"
                              : theme === "dark"
                                ? "font-normal text-slate-400 hover:text-slate-200"
                                : "font-normal text-[#6a86a0] hover:text-[#355f88]"
                          )}
                        >
                          <Icon className="size-3.5" />
                          {label}
                          {active && (
                            <span
                              className={cn(
                                "absolute -bottom-[5px] left-0 right-0 h-1 rounded-sm",
                                theme === "dark" ? "bg-[#FFE14E]" : "bg-[#234271]"
                              )}
                              aria-hidden
                            />
                          )}
                        </button>
                      );
                    })}
                    </div>
                  </nav>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-hide pr-1">
                  <ul
                    key={`${toLocalDateKey(scheduleSelectedDate)}-${scheduleTab}`}
                    className="flex flex-col gap-2.5 pt-1"
                  >
                    {filteredScheduleDayEvents.length === 0 ? (
                      <li
                        className={cn(
                          "animate-cal-empty rounded-2xl border border-dashed px-4 py-4 text-center text-xs",
                          theme === "dark"
                            ? "border-white/10 text-slate-400"
                            : "border-[#b7cde3] text-[#355f88]"
                        )}
                      >
                        {scheduleTab === "meetings" && "No meetings on this day."}
                        {scheduleTab === "events" && "No events on this day."}
                        {scheduleTab === "holidays" && (
                          <div className="flex flex-col items-center gap-2 py-2">
                          <div
                            className={cn(
                              "relative flex h-24 w-24 items-center justify-center overflow-visible motion-safe:animate-pulse",
                              theme === "dark" ? "text-slate-300" : "text-slate-500"
                            )}
                            aria-hidden
                          >
                            <span
                              className={cn(
                                "absolute left-0 top-9 h-6 w-4 skew-x-[-16deg] rounded-sm",
                                theme === "dark" ? "bg-slate-400/35" : "bg-slate-300/80"
                              )}
                            />
                            <span
                              className={cn(
                                "absolute right-0 top-9 h-6 w-4 skew-x-[16deg] rounded-sm",
                                theme === "dark" ? "bg-slate-400/35" : "bg-slate-300/80"
                              )}
                            />
                            <span
                              className={cn(
                                "relative block h-16 w-12 overflow-hidden rounded-[14px] border-2",
                                theme === "dark"
                                  ? "border-slate-300/80 bg-slate-900/30"
                                  : "border-slate-400 bg-white"
                              )}
                            >
                              <span
                                className={cn(
                                  "absolute inset-x-0 top-0 h-3 rounded-t-[12px] border-b-2",
                                  theme === "dark"
                                    ? "border-slate-300/70 bg-slate-300/70"
                                    : "border-slate-300 bg-slate-200"
                                )}
                              />
                              <span
                                className={cn(
                                  "absolute left-3 top-7 h-1.5 w-1.5 rounded-full",
                                  theme === "dark" ? "bg-slate-300" : "bg-slate-500"
                                )}
                              />
                              <span
                                className={cn(
                                  "absolute right-3 top-7 h-1.5 w-1.5 rounded-full",
                                  theme === "dark" ? "bg-slate-300" : "bg-slate-500"
                                )}
                              />
                              <span
                                className={cn(
                                  "absolute left-1/2 top-[35px] -translate-x-1/2 rotate-90 text-[12px] font-semibold leading-none",
                                  theme === "dark" ? "text-slate-300" : "text-slate-500"
                                )}
                              >
                                {"<"}
                              </span>
                            </span>
                          </div>
                          <p className="text-xs font-semibold">
                            {hasHolidayInSelectedMonth
                              ? "No holidays on this day."
                              : "No holidays this month"}
                          </p>
                          {!hasHolidayInSelectedMonth && (
                            <p className="text-[11px]">You are clear for the selected month.</p>
                          )}
                          </div>
                        )}
                      </li>
                    ) : (
                      filteredScheduleDayEvents.map((ev, rowIndex) => {
                      const ph = formatScheduleDateTimeInPH(ev.date, ev.startTime);
                      const eventDay = ph.dayLabel || "--";
                      const eventWeekday = ph.weekdayLabel || "";
                      const editableScheduleId = ev.id.startsWith("agenda-")
                        ? ev.id.replace("agenda-", "")
                        : null;
                      const linkedScheduleItem = editableScheduleId
                        ? scheduleItems.find((item) => item.id === editableScheduleId) ?? null
                        : null;
                      const status =
                        ev.category === "meetings"
                          ? { label: "Upcoming", cls: theme === "dark" ? "bg-[#28446f] text-[#d8e9fa]" : "bg-[#e8f2ff] text-[#355f88]" }
                          : ev.category === "events"
                            ? { label: "Pending", cls: theme === "dark" ? "bg-[#5a4b17] text-[#ffe79a]" : "bg-[#fff3cc] text-[#9a6b00]" }
                            : { label: "Holiday", cls: theme === "dark" ? "bg-[#2e5a43] text-[#c9f2dc]" : "bg-[#d8f5e5] text-[#1b6b46]" };
                      const location = ev.location || "Main Office";

                      return (
                        <li
                          key={ev.id}
                          className={cn(
                            "animate-cal-event-row flex items-center gap-3 rounded-2xl border p-3",
                            theme === "dark"
                              ? "border-white/10 bg-white/[0.03]"
                              : "border-[#dce7f3] bg-white"
                          )}
                          style={
                            {
                              ["--cal-row-delay" as string]: `${rowIndex * 52}ms`,
                            } as React.CSSProperties
                          }
                        >
                          <div
                            className={cn(
                              "flex w-14 shrink-0 flex-col items-center justify-center rounded-xl border py-2",
                              theme === "dark"
                                ? "border-white/10 bg-white/[0.04]"
                                : "border-[#e4edf6] bg-[#f8fbff]"
                            )}
                          >
                            <span
                              className={cn(
                                "text-lg font-semibold leading-none",
                                theme === "dark" ? "text-white" : "text-[#1f2f56]"
                              )}
                            >
                              {eventDay}
                            </span>
                            <span
                              className={cn(
                                "mt-1 text-[10px] font-semibold tracking-wide",
                                theme === "dark" ? "text-slate-400" : "text-[#87a0b9]"
                              )}
                            >
                              {eventWeekday}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                "truncate text-[15px] font-semibold",
                                theme === "dark" ? "text-white" : "text-[#192853]"
                              )}
                            >
                              {ev.title}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                              <span className={cn("rounded-md px-2 py-0.5 font-semibold", status.cls)}>
                                {status.label}
                              </span>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1",
                                  theme === "dark" ? "text-slate-300" : "text-[#5f7a96]"
                                )}
                              >
                                <Calendar className="size-3.5" />
                                {ev.category === "holidays"
                                  ? `${ph.dateLabel} • All day`
                                  : `${ph.dateLabel} at ${ph.timeLabel}`}
                              </span>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1",
                                  theme === "dark" ? "text-slate-300" : "text-[#5f7a96]"
                                )}
                              >
                                <MapPin className="size-3.5" />
                                {location}
                              </span>
                            </div>
                          </div>
                          {linkedScheduleItem && (
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  "size-8 rounded-lg",
                                  theme === "dark"
                                    ? "text-slate-300 hover:bg-white/10 hover:text-white"
                                    : "text-[#355f88] hover:bg-[#eaf2fb] hover:text-[#1f2f56]"
                                )}
                                onClick={() => {
                                  setEditingScheduleItem(linkedScheduleItem);
                                  setScheduleDialogCategory(inferCategoryFromScheduleType(linkedScheduleItem.type));
                                  setScheduleDialogDate(linkedScheduleItem.date ?? getTodayDateKey());
                                  setScheduleDialogOpen(true);
                                }}
                                aria-label={`Edit ${ev.title}`}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  "size-8 rounded-lg",
                                  theme === "dark"
                                    ? "text-red-300 hover:bg-red-500/15 hover:text-red-200"
                                    : "text-red-600 hover:bg-red-50 hover:text-red-700"
                                )}
                                onClick={() => removeScheduleItem(linkedScheduleItem.id)}
                                aria-label={`Delete ${ev.title}`}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          )}
                        </li>
                      );
                      })
                    )}
                  </ul>
                </div>
              </CardContent>
            </Card>
        </section>

        {/* Floating Notes: FAB → open; header bar supports maximize / minimize / close */}
        {!notesFloatingOpen ? (
                      <button
                        type="button"
                        onClick={() => {
              setNotesFloatingOpen(true);
              setNotesFloatingExpanded(true);
            }}
            className={cn(
              "fixed bottom-5 right-5 z-50 flex size-14 items-center justify-center rounded-full text-white shadow-lg",
              "bg-[#2563eb] ring-4 ring-white transition hover:brightness-110",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            )}
            aria-label="Open notes"
          >
            <StickyNote className="size-6" strokeWidth={2} aria-hidden />
                      </button>
        ) : (
          <div
            className={cn(
              "fixed right-5 z-50 flex flex-col overflow-hidden rounded-2xl border shadow-2xl",
              theme === "dark" ? DASHBOARD_CARD_DARK_CLASS : "border-border bg-white",
              notesFloatingExpanded
                ? "bottom-5 w-[min(92vw,400px)] max-h-[min(78vh,560px)]"
                : "bottom-5 w-[min(92vw,320px)]"
            )}
            role="dialog"
            aria-modal="false"
            aria-labelledby="notes-floating-title"
          >
            <div
              className={cn(
                "flex shrink-0 items-center gap-2 px-3 py-2.5",
                notesFloatingExpanded &&
                  cn(
                    "border-b",
                    theme === "dark" ? "border-white/10" : "border-[#e5e7eb]"
                  )
              )}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-white ring-2 ring-white/90">
                <StickyNote className="size-[18px]" strokeWidth={2} aria-hidden />
              </span>
              <div
                className={cn(
                  "h-8 w-px shrink-0",
                  theme === "dark" ? "bg-white/15" : "bg-[#e5e7eb]"
                )}
              />
              <span
                id="notes-floating-title"
                className={cn(
                  "min-w-0 flex-1 truncate text-sm font-semibold",
                  theme === "dark" ? "text-slate-50" : "text-[#111827]"
                )}
              >
                Notes
              </span>
              {notesFloatingExpanded ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setNotesFloatingExpanded(false)}
                  aria-label="Minimize notes"
                >
                  <Minimize2 className="size-4" aria-hidden />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setNotesFloatingExpanded(true)}
                  aria-label="Maximize notes"
                >
                  <Maximize2 className="size-4" aria-hidden />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => setNotesFloatingOpen(false)}
                aria-label="Close notes"
              >
                <X className="size-4" aria-hidden />
              </Button>
                    </div>
            {notesFloatingExpanded && (
              <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide p-4">
                <ul
                  className={cn(
                    "divide-y",
                    theme === "dark" ? "divide-white/10" : "divide-[#e5e7eb]"
                  )}
                  role="list"
                >
                  {employeeDashboardNotes.map((note) => (
                    <li key={note.id} className="flex gap-3 py-4 first:pt-0">
                      <button
                        type="button"
                        onClick={() => toggleEmployeeNoteComplete(note.id)}
                        className="mt-0.5 shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-pressed={note.completed}
                        aria-label={
                          note.completed ? "Mark as not done" : "Mark as done"
                        }
                      >
                        {note.completed ? (
                          <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                            <Check className="size-3 stroke-[3]" aria-hidden />
                          </span>
                        ) : (
                          <span
                            className={cn(
                              "block size-5 rounded-full border-2",
                              theme === "dark"
                                ? "border-slate-200"
                                : "border-[#111827]"
                            )}
                          />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-sm font-semibold leading-snug",
                            note.completed
                              ? theme === "dark"
                                ? "text-slate-400"
                                : "text-[#6b7280]"
                              : theme === "dark"
                                ? "text-slate-50"
                                : "text-[#111827]"
                          )}
                        >
                          {note.title}
                        </p>
                        <p
                          className={cn(
                            "mt-1 text-xs leading-relaxed",
                            theme === "dark"
                              ? "text-slate-400"
                              : "text-[#6b7280]"
                          )}
                        >
                          {note.description}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {note.tags.map((tag) => (
                            <span
                              key={`${note.id}-${tag.label}`}
                              className={cn(
                                "rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                                tag.variant === "neutral"
                                  ? note.completed
                                    ? theme === "dark"
                                      ? "border border-white/15 bg-transparent text-slate-400"
                                      : "border border-border bg-white text-[#6b7280]"
                                    : theme === "dark"
                                      ? "bg-white/10 text-slate-200"
                                      : "bg-[#e5e7eb] text-[#374151]"
                                  : note.completed
                                    ? theme === "dark"
                                      ? "border border-orange-400/40 bg-orange-950/20 text-slate-400"
                                      : "border border-orange-200 bg-[#fff7ed] text-[#6b7280]"
                                    : theme === "dark"
                                      ? "bg-orange-950/40 text-orange-200"
                                      : "bg-[#ffedd5] text-[#9a3412]"
                              )}
                            >
                              {tag.label}
                            </span>
                          ))}
                    </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <Button
                        type="button"
                  variant="outline"
                  className={cn(
                    "mt-4 h-11 w-full gap-2 rounded-xl border-2 font-semibold",
                    theme === "dark"
                      ? // Force over outline’s hover:bg-accent/hover:text (low contrast with text-slate-50 on yellow)
                        "border-slate-200/90 bg-transparent text-slate-50 hover:!bg-white/10 hover:!text-slate-50 hover:border-slate-200"
                      : "border-[#111827] bg-transparent text-[#111827] hover:bg-muted/30 hover:text-[#111827]"
                  )}
                  onClick={() => setEmployeeNoteDialogOpen(true)}
                >
                  <SquarePen className="size-4" aria-hidden />
                  New Note
                </Button>
                    </div>
            )}
                  </div>
        )}

        <Dialog
          open={employeeNoteDialogOpen}
          onOpenChange={(open) => {
            setEmployeeNoteDialogOpen(open);
            if (!open) {
              setNewEmployeeNoteTitle("");
              setNewEmployeeNoteDescription("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New note</DialogTitle>
              <DialogDescription>
                Add a title and description. Tags default to Today and Waiting
                Feedback.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="emp-note-title">Title</Label>
                <Input
                  id="emp-note-title"
                  value={newEmployeeNoteTitle}
                  onChange={(e) => setNewEmployeeNoteTitle(e.target.value)}
                  placeholder="e.g. Phoenix footer section"
                  className={cn(theme === "dark" && "border-white/10 bg-white/5")}
                />
                  </div>
              <div className="space-y-1.5">
                <Label htmlFor="emp-note-desc">Description</Label>
                <textarea
                  id="emp-note-desc"
                  value={newEmployeeNoteDescription}
                  onChange={(e) =>
                    setNewEmployeeNoteDescription(e.target.value)
                  }
                  placeholder="Details…"
                  rows={3}
                  className={cn(
                    "flex min-h-[5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm",
                    "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  )}
                />
            </div>
          </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEmployeeNoteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={saveNewEmployeeNote}
                disabled={!newEmployeeNoteTitle.trim()}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Announcements (hidden for employee layout) */}
        {false && (
        <section className="space-y-4" aria-label="Announcements section">
          <div className="space-y-4">
            {(widgets.announcements ?? true) && (
            <Card className={employeeDashCardClass}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                <CardTitle className="text-base font-semibold text-slate-50">
                  Announcements
                </CardTitle>
                <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-sm font-medium text-[#FFE14E] hover:underline"
                    onClick={() => setAnnouncementDialogOpen(true)}
                    aria-label="Add announcement"
              >
                Add
              </button>
              </div>
              </CardHeader>
              <CardContent className="text-sm">
                <div
                  className="scrollbar-hide max-h-[260px] space-y-2 overflow-y-auto pr-1"
                  role="region"
                  aria-label="Announcements list"
                >
                  {announcementItems.map((item) => (
                      <div
                        key={item.id}
                      className="flex items-start justify-between rounded-2xl bg-white/10 px-3 py-2.5"
                    >
                      <div className="mr-4 flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-50">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {item.date} {item.time}
                        </p>
                        </div>
                      <div className="relative shrink-0">
                        <button
                            type="button"
                          className="text-sm text-slate-400 hover:text-slate-50 p-1 rounded"
                          aria-label="Options"
                          onClick={() =>
                            setAnnouncementMenuId((prev) =>
                              prev === item.id ? null : item.id
                            )
                          }
                        >
                          •••
                        </button>
                        {announcementMenuId === item.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              aria-hidden
                              onClick={() => setAnnouncementMenuId(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 z-20 w-36 rounded-xl border border-slate-600 bg-[#0f172a] py-1 shadow-lg">
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-700/80"
                            onClick={() => {
                                  setEditingAnnouncement(item);
                                  setAnnouncementMenuId(null);
                                  setAnnouncementDialogOpen(true);
                            }}
                          >
                            <Pencil className="size-3.5" />
                                Edit
                              </button>
                              <button
                            type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-300 hover:bg-slate-700/80"
                                onClick={() => removeAnnouncement(item.id)}
                          >
                            <Trash2 className="size-3.5" />
                                Delete
                              </button>
                        </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
          )}
          </div>
        </section>
        )}
        <AnnouncementDialog
          open={announcementDialogOpen}
          onOpenChange={(open) => {
            if (!open) setEditingAnnouncement(null);
            setAnnouncementDialogOpen(open);
          }}
          editingItem={editingAnnouncement}
          onAdd={addAnnouncement}
          onUpdate={updateAnnouncement}
        />
        <AddTaskDialog
          open={scheduleDialogOpen}
          onOpenChange={(open) => {
            if (!open) setEditingScheduleItem(null);
            setScheduleDialogOpen(open);
          }}
          editingItem={editingScheduleItem}
          onAdd={addScheduleItem}
          onUpdate={updateScheduleItem}
          dateKey={scheduleDialogDate}
          initialCategory={scheduleDialogCategory}
          onCategoryChange={(category, savedDate) => {
            setScheduleTab(category);
            const safeDate = savedDate || scheduleDialogDate || getTodayDateKey();
            setScheduleDialogDate(safeDate);
            setScheduleSelectedDate(startOfLocalDay(new Date(`${safeDate}T12:00:00`)));
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-6">
        <EmployeeModuleTopbar searchPlaceholder="Search" />
        <EmployeeSectionHeader title={currentUser.role === "HR_STAFF" || currentUser.role === "HR_ADMIN" || currentUser.role === "HR_MANAGER" || currentUser.role === "DEPARTMENT_MANAGER" || currentUser.role === "AUDITOR" || currentUser.role === "EXECUTIVE" ? "Dashboard" : "Home"} />
      </div>

      {currentUser.role === "DEPARTMENT_MANAGER" ? (
        <>
          {/* Manager-focused KPI cards */}
          <section>
            <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <EmployeeKpiCard
                theme={theme}
                title="Team Members"
                menuAriaLabel="Team members options"
                icon={<Users className="size-8" strokeWidth={2} />}
                metric={18}
                trend={
                  <>
                    <span className="font-bold text-[#192853]">+2</span>
                    <span className={theme === "dark" ? "text-slate-400" : "text-slate-500"}>
                      new this month
                    </span>
                  </>
                }
              />
              <EmployeeKpiCard
                theme={theme}
                title="Pending Approvals"
                menuAriaLabel="Pending approvals options"
                icon={<ListChecks className="size-8" strokeWidth={2} />}
                metric={5}
                trend={
                  <>
                    <span className="font-bold text-[#192853]">Urgent</span>
                    <span className={theme === "dark" ? "text-slate-400" : "text-slate-500"}>
                      3 leave, 2 workflow
                    </span>
                  </>
                }
              />
              <EmployeeKpiCard
                theme={theme}
                title="Team Attendance Rate"
                menuAriaLabel="Attendance options"
                icon={<Percent className="size-8" strokeWidth={2} />}
                metric="88%"
                trend={
                  <>
                    <span className="font-bold text-rose-500">4 late</span>
                    <span className={theme === "dark" ? "text-slate-400" : "text-slate-500"}>
                      today
                    </span>
                  </>
                }
              />
              <EmployeeKpiCard
                theme={theme}
                title="Employees on Leave Today"
                menuAriaLabel="Leave today options"
                icon={<CalendarDays className="size-8" strokeWidth={2} />}
                metric={3}
                trend={
                  <>
                    <span className="font-bold text-[#192853]">Impact</span>
                    <span className={theme === "dark" ? "text-slate-400" : "text-slate-500"}>
                      2 annual, 1 sick
                    </span>
                  </>
                }
              />
            </div>
          </section>

          {/* Main manager layout: center analytics + right action area */}
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
            <div className="space-y-4">
              <PerformanceOverviewCard
                theme={theme}
                performanceRange={performanceRange}
                setPerformanceRange={setPerformanceRange}
                showPerformanceMenu={showPerformanceMenu}
                setShowPerformanceMenu={setShowPerformanceMenu}
                employeePerformancePoints={employeePerformancePoints}
                employeePerformanceHighlight={employeePerformanceHighlight}
              />

              <Card className={cn("rounded-3xl", theme === "dark" && DASHBOARD_CARD_DARK_CLASS)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Attendance Overview</CardTitle>
                  <p className="text-xs text-muted-foreground">Present / Late / Absent snapshot for today.</p>
                </CardHeader>
                <CardContent>
                  <div className={cn(
                    "grid grid-cols-3 gap-3 rounded-[22px] border p-3",
                    theme === "dark" ? "border-white/10 bg-[#161b30]" : "border-[#dbe7f3] bg-[#f8fbff]"
                  )}>
                    <div className="rounded-xl border border-border/50 p-3 transition-colors hover:bg-emerald-500/5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Present</p>
                      <p className="text-xl font-bold text-emerald-500">15</p>
                    </div>
                    <div className="rounded-xl border border-border/50 p-3 transition-colors hover:bg-amber-500/5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Late</p>
                      <p className="text-xl font-bold text-amber-500">2</p>
                    </div>
                    <div className="rounded-xl border border-border/50 p-3 transition-colors hover:bg-rose-500/5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Absent</p>
                      <p className="text-xl font-bold text-rose-500">1</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className={cn("rounded-3xl", theme === "dark" && DASHBOARD_CARD_DARK_CLASS)}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Approval Queue</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className={cn(
                    "space-y-3 rounded-[22px] border p-3",
                    theme === "dark" ? "border-white/10 bg-[#161b30]" : "border-[#dbe7f3] bg-[#f8fbff]"
                  )}>
                    {[
                      { name: "John Doe", item: "Leave Request (Vacation)" },
                      { name: "Jane Smith", item: "Workflow Request" },
                      { name: "Mark Reyes", item: "Overtime Request" },
                    ].map((row) => (
                      <div key={row.name} className="rounded-xl border border-border/50 bg-background/50 p-3 transition-all hover:bg-background/80">
                        <p className="text-sm font-semibold">{row.name}</p>
                        <p className="text-xs text-muted-foreground">{row.item}</p>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" className="h-8 rounded-lg px-3 bg-[#234271] text-white hover:bg-[#1c365f]">Approve</Button>
                          <Button size="sm" variant="outline" className="h-8 rounded-lg px-3">Reject</Button>
                          <Button size="sm" variant="ghost" className="h-8 rounded-lg px-2 text-xs">Details</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className={cn("rounded-3xl", theme === "dark" && DASHBOARD_CARD_DARK_CLASS)}>
                <CardHeader>
                  <CardTitle className="text-base">Team Schedule</CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="meetings" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="meetings">Meetings</TabsTrigger>
                      <TabsTrigger value="events">Events</TabsTrigger>
                      <TabsTrigger value="holidays">Holidays</TabsTrigger>
                    </TabsList>
                    <TabsContent value="meetings" className="mt-3 text-sm text-muted-foreground">
                      2 team meetings today, next at 2:00 PM.
                    </TabsContent>
                    <TabsContent value="events" className="mt-3 text-sm text-muted-foreground">
                      Department planning session tomorrow.
                    </TabsContent>
                    <TabsContent value="holidays" className="mt-3 text-sm text-muted-foreground">
                      No holidays this week.
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              <Card className={cn("rounded-3xl", theme === "dark" && DASHBOARD_CARD_DARK_CLASS)}>
                <CardHeader>
                  <CardTitle className="text-base">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="justify-start">Approve Requests</Button>
                  <Button variant="outline" size="sm" className="justify-start">View Team</Button>
                  <Button variant="outline" size="sm" className="justify-start">Assign Task</Button>
                  <Button variant="outline" size="sm" className="justify-start">View Reports</Button>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Bottom manager insights */}
          <section className="grid gap-4 lg:grid-cols-3">
            <Card className={cn("rounded-3xl lg:col-span-2", theme === "dark" && DASHBOARD_CARD_DARK_CLASS)}>
              <CardHeader>
                <CardTitle className="text-base">Recent Activity (Team)</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li>John submitted leave request</li>
                  <li>Jane&apos;s leave approved</li>
                  <li>Complaint filed in Engineering department</li>
                  <li>Mark marked absent today</li>
                </ul>
              </CardContent>
            </Card>
            <div className="space-y-4">
              <Card className={cn("rounded-3xl", theme === "dark" && DASHBOARD_CARD_DARK_CLASS)}>
                <CardHeader>
                  <CardTitle className="text-base">Leave Overview (Team)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between"><span>Approved</span><strong>10</strong></div>
                  <div className="flex items-center justify-between"><span>Pending</span><strong>5</strong></div>
                  <div className="flex items-center justify-between"><span>Rejected</span><strong>2</strong></div>
                </CardContent>
              </Card>
              <Card className={cn("rounded-3xl", theme === "dark" && DASHBOARD_CARD_DARK_CLASS)}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Today&apos;s Team Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={cn(
                    "space-y-2.5 rounded-[22px] border p-3.5",
                    theme === "dark" ? "border-white/10 bg-[#161b30]" : "border-[#dbe7f3] bg-[#f8fbff]"
                  )}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Present</span>
                      <strong className="text-emerald-500 font-bold">15</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Absent</span>
                      <strong className="text-rose-500 font-bold">2</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Late</span>
                      <strong className="text-amber-500 font-bold">1</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">On Leave</span>
                      <strong className="text-violet-400 font-bold">3</strong>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        </>
      ) : (
      <>
      <section>
        <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <EmployeeKpiCard
            theme={theme}
            title="Total Employees"
            menuAriaLabel="Total employees options"
            icon={<Users className="size-8" strokeWidth={2} />}
            metric={allEmployees.length}
            trend={
              <>
                <span className="font-bold text-[#192853]">+3</span>
                <span className={theme === "dark" ? "text-slate-400" : "text-slate-500"}>
                  new this month
                </span>
              </>
            }
          />
          <EmployeeKpiCard
            theme={theme}
            title="Pending Requests"
            menuAriaLabel="Pending requests options"
            icon={<ListChecks className="size-8" strokeWidth={2} />}
            metric={pendingCount}
            trend={
              <>
                <span className="font-bold text-[#192853]">Needs Review</span>
                <span className={theme === "dark" ? "text-slate-400" : "text-slate-500"}>
                  leave + workflow
                </span>
              </>
            }
          />
          <EmployeeKpiCard
            theme={theme}
            title="Attendance Rate"
            menuAriaLabel="Attendance rate options"
            icon={<Percent className="size-8" strokeWidth={2} />}
            metric="89%"
            trend={
              <>
                <span className="font-bold text-[#192853]">+1.6%</span>
                <span className={theme === "dark" ? "text-slate-400" : "text-slate-500"}>
                  vs last week
                </span>
              </>
            }
          />
          <EmployeeKpiCard
            theme={theme}
            title="Active Payroll"
            menuAriaLabel="Payroll options"
            icon={<Wallet className="size-8" strokeWidth={2} />}
            metric="₱2.14M"
            trend={
              <>
                <span className="font-bold text-[#192853]">+4.1%</span>
                <span className={theme === "dark" ? "text-slate-400" : "text-slate-500"}>
                  current cycle
                </span>
              </>
            }
          />
        </div>
      </section>
      <section
        className={cn(
          "grid gap-4 lg:items-start",
          (widgets.performanceOverview ?? true) && (widgets.schedules ?? true)
            ? "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"
            : "lg:grid-cols-1"
        )}
      >
        {(widgets.performanceOverview ?? true) && (
          <div className="min-w-0">
            <PerformanceOverviewCard
              theme={theme}
              performanceRange={performanceRange}
              setPerformanceRange={setPerformanceRange}
              showPerformanceMenu={showPerformanceMenu}
              setShowPerformanceMenu={setShowPerformanceMenu}
              employeePerformancePoints={employeePerformancePoints}
              employeePerformanceHighlight={employeePerformanceHighlight}
            />
          </div>
        )}

        {(widgets.schedules ?? true) && (
          <div className="min-w-0 lg:self-start">
            {currentUser.role === "HR_STAFF" ? (
              <HRStaffWorkforceGaugeCard
                theme={theme}
                totalEmployees={allEmployees.length}
              />
            ) : (
              <Card
                id="shared-schedule-card"
                className={cn(
                  "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-3xl",
                  theme === "dark"
                    ? DASHBOARD_CARD_DARK_CLASS
                    : "border border-[#c7d8ea] bg-white text-[#192853] shadow-sm"
                )}
              >
              <CardContent className="min-h-0 flex flex-1 flex-col gap-3 overflow-hidden px-4 pb-4 pt-4 sm:px-5 sm:pt-5">
                <div
                  key={`cal-h-shared-${scheduleMonthKey}`}
                  className="animate-cal-header flex w-full min-w-0 flex-col gap-2.5"
                >
                  <div className="flex w-full items-center justify-center gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={goToPreviousScheduleMonth}
                        className={cn(
                          "inline-flex size-7 shrink-0 items-center justify-center rounded-full border",
                          theme === "dark"
                            ? "border-white/15 text-slate-200 hover:bg-white/[0.08]"
                            : "border-[#c9d8e7] text-[#355f88] hover:bg-[#f1f6fb]"
                        )}
                        aria-label="Previous month"
                      >
                        <ChevronLeft className="size-3.5" />
                      </button>
                      <span
                        className={cn(
                          "min-w-0 truncate text-[17px] font-semibold leading-none tracking-tight sm:text-[19px]",
                          theme === "dark" ? "text-slate-50" : "text-[#192853]"
                        )}
                      >
                        {scheduleSelectedDate.toLocaleString("en-US", { month: "long" })},{" "}
                        <span className={theme === "dark" ? "text-slate-300" : "text-[#5f7a96]"}>
                          {scheduleSelectedDate.getFullYear()}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={goToNextScheduleMonth}
                        className={cn(
                          "inline-flex size-7 shrink-0 items-center justify-center rounded-full border",
                          theme === "dark"
                            ? "border-white/15 text-slate-200 hover:bg-white/[0.08]"
                            : "border-[#c9d8e7] text-[#355f88] hover:bg-[#f1f6fb]"
                        )}
                        aria-label="Next month"
                      >
                        <ChevronRight className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex w-full items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={goToTodayScheduleDate}
                      className={cn(
                        "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-semibold",
                        theme === "dark"
                          ? "border-white/15 text-slate-200 hover:bg-white/[0.08]"
                          : "border-[#c9d8e7] text-[#355f88] hover:bg-[#f1f6fb]"
                      )}
                    >
                      Today
                    </button>
                    <div
                      className={cn(
                        "inline-flex items-center rounded-full border p-1",
                        theme === "dark"
                          ? "border-white/15 bg-white/[0.04]"
                          : "border-[#c9d8e7] bg-white"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setScheduleCalendarView("twoWeeks")}
                        className={cn(
                          "inline-flex h-8 items-center rounded-full px-2.5 text-xs font-semibold transition-colors",
                          scheduleCalendarView === "twoWeeks"
                            ? "bg-[#234271] text-white"
                            : theme === "dark"
                              ? "text-slate-300 hover:bg-white/[0.08]"
                              : "text-[#5f7a96] hover:bg-[#f1f6fb]"
                        )}
                      >
                        2 Weeks
                      </button>
                      <button
                        type="button"
                        onClick={() => setScheduleCalendarView("fullMonth")}
                        className={cn(
                          "inline-flex h-8 items-center rounded-full px-2.5 text-xs font-semibold transition-colors",
                          scheduleCalendarView === "fullMonth"
                            ? "bg-[#234271] text-white"
                            : theme === "dark"
                              ? "text-slate-300 hover:bg-white/[0.08]"
                              : "text-[#5f7a96] hover:bg-[#f1f6fb]"
                        )}
                      >
                        Full Month
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  className={cn(
                    "space-y-1.5 rounded-[22px] border p-2.5 sm:p-3",
                    theme === "dark"
                      ? "border-white/10 bg-[#161b30]"
                      : "border-[#dbe7f3] bg-[#f8fbff]"
                  )}
                >
                  <div className="grid grid-cols-7 gap-1.5">
                    {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((label, idx) => {
                      const activeWeekday = idx === scheduleSelectedDate.getDay();
                      return (
                        <span
                          key={`shared-cal-weekday-${label}`}
                          className={cn(
                            "rounded-full px-2 py-1 text-center text-[10px] font-semibold tracking-wide sm:text-[11px]",
                            activeWeekday
                              ? theme === "dark"
                                ? "bg-[#2a3a67] text-slate-100"
                                : "bg-[#d9e6f3] text-[#234271]"
                              : theme === "dark"
                                ? "bg-white/[0.05] text-slate-400"
                                : "bg-[#edf3f9] text-[#8097ad]"
                          )}
                        >
                          {label}
                        </span>
                      );
                    })}
                  </div>

                  <div
                    key={`shared-cal-g-${scheduleMonthKey}-${scheduleCalendarView}`}
                    className="grid w-full min-w-0 grid-cols-7 gap-1.5"
                  >
                    {scheduleVisibleDays.map((day, dayIndex) => {
                      const selected = isSameCalendarDay(day, scheduleSelectedDate);
                      const sameMonth = day.getMonth() === scheduleSelectedDate.getMonth();
                      const dateKey = toLocalDateKey(day);
                      const hasEventDot = scheduleEventDateKeys.has(dateKey);
                      const isHolidayDate = holidayDateKeys.has(dateKey);
                      return (
                        <button
                          key={`shared-cal-grid-${dayIndex}-${dateKey}`}
                          type="button"
                          onClick={() => setScheduleSelectedDate(startOfLocalDay(day))}
                          className={cn(
                            "animate-cal-day relative flex h-[48px] w-full items-center justify-center rounded-xl border text-[12px] font-semibold leading-none transition-colors sm:h-[50px] sm:text-[13px]",
                            selected
                              ? theme === "dark"
                                ? "border-[#355f88] bg-[#234271] text-white"
                                : "border-[#234271] bg-[#234271] text-white"
                              : theme === "dark"
                                ? "border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
                                : "border-[#e7eff7] bg-[#fdfefe] text-[#234271] hover:border-[#c7d8ea]",
                            !selected &&
                              isHolidayDate &&
                              (theme === "dark"
                                ? "border-[#FFE14E]/70 bg-[#FFE14E]/10 text-[#FFE14E]"
                                : "border-[#e8c63f] bg-[#fff8db] text-[#7a5b00]")
                          )}
                          style={{ ["--cal-day-delay" as string]: `${dayIndex * 20}ms` } as React.CSSProperties}
                        >
                          {(hasEventDot || selected) && (
                            <span
                              className={cn(
                                "absolute top-1.5 size-1.5 rounded-full",
                                selected
                                  ? "bg-[#FFE14E]"
                                  : isHolidayDate
                                    ? "bg-[#FFE14E]"
                                    : theme === "dark"
                                      ? "bg-[#FFE14E]/85"
                                      : "bg-[#1f2f56]"
                              )}
                              aria-hidden
                            />
                          )}
                          <span
                            className={cn(
                              selected
                                ? "text-white"
                                : sameMonth
                                  ? theme === "dark"
                                    ? isHolidayDate
                                      ? "text-[#FFE14E]"
                                      : "text-slate-100"
                                    : "text-[#24355f]"
                                  : theme === "dark"
                                    ? "text-slate-500"
                                    : "text-[#b0c2d4]"
                            )}
                          >
                            {day.getDate()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div
                  key={`shared-cal-n-${scheduleMonthKey}`}
                  className={cn(
                    "animate-cal-tabs mt-1 border-t pt-3",
                    theme === "dark" ? "border-white/10" : "border-[#c7d8ea]"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p
                      className={cn(
                        "text-base font-semibold",
                        theme === "dark" ? "text-slate-100" : "text-[#192853]"
                      )}
                    >
                      Your events
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => openScheduleDialogForDate(toLocalDateKey(scheduleSelectedDate))}
                      className={cn(
                        "relative z-40 h-8 rounded-full px-3 text-xs font-semibold pointer-events-auto",
                        "bg-[#234271] text-[#FFE14E] hover:bg-[#1c365f]"
                      )}
                    >
                      <Plus className="mr-1 size-3.5" />
                      Add new
                    </Button>
                  </div>

                  <nav
                    role="tablist"
                    aria-label="Schedule category"
                    className={cn(
                      "mt-3 border-b pb-1",
                      theme === "dark" ? "border-white/10" : "border-[#d7e4f1]"
                    )}
                  >
                    <div className="flex flex-wrap items-end justify-center gap-6">
                      {(
                        [
                          { key: "meetings" as const, label: "Meetings", Icon: MessagesSquare },
                          { key: "events" as const, label: "Events", Icon: Calendar },
                          { key: "holidays" as const, label: "Holidays", Icon: Gift },
                        ] as const
                      ).map(({ key, label, Icon }) => {
                        const active = scheduleTab === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setScheduleTab(key)}
                            className={cn(
                              "relative inline-flex items-center gap-1.5 pb-2 text-sm transition-colors",
                              active
                                ? theme === "dark"
                                  ? "font-semibold text-slate-100"
                                  : "font-semibold text-[#234271]"
                                : theme === "dark"
                                  ? "font-normal text-slate-400 hover:text-slate-200"
                                  : "font-normal text-[#6a86a0] hover:text-[#355f88]"
                            )}
                          >
                            <Icon className="size-3.5" />
                            {label}
                            {active && (
                              <span
                                className={cn(
                                  "absolute -bottom-[5px] left-0 right-0 h-1 rounded-sm",
                                  theme === "dark" ? "bg-[#FFE14E]" : "bg-[#234271]"
                                )}
                                aria-hidden
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </nav>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-hide pr-1">
                  <ul
                    key={`${toLocalDateKey(scheduleSelectedDate)}-${scheduleTab}`}
                    className="flex flex-col gap-2.5 pt-1"
                  >
                    {filteredScheduleDayEvents.length === 0 ? (
                      <li
                        className={cn(
                          "animate-cal-empty rounded-2xl border border-dashed px-4 py-4 text-center text-xs",
                          theme === "dark"
                            ? "border-white/10 text-slate-400"
                            : "border-[#b7cde3] text-[#355f88]"
                        )}
                      >
                        {scheduleTab === "meetings" && "No meetings on this day."}
                        {scheduleTab === "events" && "No events on this day."}
                        {scheduleTab === "holidays" && "No holidays on this day."}
                      </li>
                    ) : (
                      filteredScheduleDayEvents.map((ev, rowIndex) => {
                        const ph = formatScheduleDateTimeInPH(ev.date, ev.startTime);
                        const eventDay = ph.dayLabel || "--";
                        const eventWeekday = ph.weekdayLabel || "";
                        const editableScheduleId = ev.id.startsWith("agenda-")
                          ? ev.id.replace("agenda-", "")
                          : null;
                        const linkedScheduleItem = editableScheduleId
                          ? scheduleItems.find((item) => item.id === editableScheduleId) ?? null
                          : null;
                        const status =
                          ev.category === "meetings"
                            ? {
                                label: "Upcoming",
                                cls:
                                  theme === "dark"
                                    ? "bg-[#28446f] text-[#d8e9fa]"
                                    : "bg-[#e8f2ff] text-[#355f88]",
                              }
                            : ev.category === "events"
                              ? {
                                  label: "Pending",
                                  cls:
                                    theme === "dark"
                                      ? "bg-[#5a4b17] text-[#ffe79a]"
                                      : "bg-[#fff3cc] text-[#9a6b00]",
                                }
                              : {
                                  label: "Holiday",
                                  cls:
                                    theme === "dark"
                                      ? "bg-[#2e5a43] text-[#c9f2dc]"
                                      : "bg-[#d8f5e5] text-[#1b6b46]",
                                };
                        const location = ev.location || "Main Office";

                        return (
                          <li
                            key={ev.id}
                            className={cn(
                              "animate-cal-event-row flex items-center gap-3 rounded-2xl border p-3",
                              theme === "dark"
                                ? "border-white/10 bg-white/[0.03]"
                                : "border-[#dce7f3] bg-white"
                            )}
                            style={
                              {
                                ["--cal-row-delay" as string]: `${rowIndex * 52}ms`,
                              } as React.CSSProperties
                            }
                          >
                            <div
                              className={cn(
                                "flex w-14 shrink-0 flex-col items-center justify-center rounded-xl border py-2",
                                theme === "dark"
                                  ? "border-white/10 bg-white/[0.04]"
                                  : "border-[#e4edf6] bg-[#f8fbff]"
                              )}
                            >
                              <span
                                className={cn(
                                  "text-lg font-semibold leading-none",
                                  theme === "dark" ? "text-white" : "text-[#1f2f56]"
                                )}
                              >
                                {eventDay}
                              </span>
                              <span
                                className={cn(
                                  "mt-1 text-[10px] font-semibold tracking-wide",
                                  theme === "dark" ? "text-slate-400" : "text-[#87a0b9]"
                                )}
                              >
                                {eventWeekday}
                              </span>
                            </div>

                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  "truncate text-[15px] font-semibold",
                                  theme === "dark" ? "text-white" : "text-[#192853]"
                                )}
                              >
                                {ev.title}
                              </p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                                <span className={cn("rounded-md px-2 py-0.5 font-semibold", status.cls)}>
                                  {status.label}
                                </span>
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1",
                                    theme === "dark" ? "text-slate-300" : "text-[#5f7a96]"
                                  )}
                                >
                                  <Calendar className="size-3.5" />
                                  {ev.category === "holidays"
                                    ? `${ph.dateLabel} • All day`
                                    : `${ph.dateLabel} at ${ph.timeLabel}`}
                                </span>
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1",
                                    theme === "dark" ? "text-slate-300" : "text-[#5f7a96]"
                                  )}
                                >
                                  <MapPin className="size-3.5" />
                                  {location}
                                </span>
                              </div>
                            </div>

                            {linkedScheduleItem && (
                              <div className="flex shrink-0 items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className={cn(
                                    "size-8 rounded-lg",
                                    theme === "dark"
                                      ? "text-slate-300 hover:bg-white/10 hover:text-white"
                                      : "text-[#355f88] hover:bg-[#eaf2fb] hover:text-[#1f2f56]"
                                  )}
                                  onClick={() => {
                                    setEditingScheduleItem(linkedScheduleItem);
                                    setScheduleDialogCategory(
                                      inferCategoryFromScheduleType(linkedScheduleItem.type)
                                    );
                                    setScheduleDialogDate(
                                      linkedScheduleItem.date ?? getTodayDateKey()
                                    );
                                    setScheduleDialogOpen(true);
                                  }}
                                  aria-label={`Edit ${ev.title}`}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className={cn(
                                    "size-8 rounded-lg",
                                    theme === "dark"
                                      ? "text-red-300 hover:bg-red-500/15 hover:text-red-200"
                                      : "text-red-600 hover:bg-red-50 hover:text-red-700"
                                  )}
                                  onClick={() => removeScheduleItem(linkedScheduleItem.id)}
                                  aria-label={`Delete ${ev.title}`}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            )}
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>
              </CardContent>
              </Card>
            )}
          </div>
        )}
      </section>
      {/* Employee-specific welcome + tasks layout removed at user request */}

      {/* HR Admin / HR Manager / Super Admin / Department Manager Analytics */}
      {widgets.analytics &&
        (currentUser.role === "HR_ADMIN" ||
        currentUser.role === "HR_MANAGER" ||
        currentUser.role === "SUPER_ADMIN") && (
        <section className="space-y-4" aria-label="Analytics">
          {/* Analytics grid (cards without shared background container) */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 lg:[grid-template-columns:0.9fr_1.3fr_1.4fr]">
              <HeadcountByDepartmentChart />
              <EmploymentTypeChart />
              <PayrollAnalyticsCard />
            </div>
            {/* Leave & Workflow trend charts – stack on small screens, 2 columns on large screens */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <LeaveRequestsTrendChart />
              <WorkflowRequestsTrendChart />
            </div>
          </div>
        </section>
      )}

      
      </>
      )}

      <AddTaskDialog
        open={scheduleDialogOpen}
        onOpenChange={(open) => {
          if (!open) setEditingScheduleItem(null);
          setScheduleDialogOpen(open);
        }}
        editingItem={editingScheduleItem}
        onAdd={addScheduleItem}
        onUpdate={updateScheduleItem}
        dateKey={scheduleDialogDate}
        initialCategory={scheduleDialogCategory}
        onCategoryChange={(category, savedDate) => {
          setScheduleTab(category);
          const safeDate = savedDate || scheduleDialogDate || getTodayDateKey();
          setScheduleDialogDate(safeDate);
          setScheduleSelectedDate(startOfLocalDay(new Date(`${safeDate}T12:00:00`)));
        }}
      />
    </div>
  );
}

const SCHEDULE_TYPE_OPTIONS: { value: ScheduleItem["type"]; label: string }[] = [
  { value: "meeting", label: "Meeting" },
  { value: "interview", label: "Interview" },
  { value: "task", label: "Task" },
  { value: "other", label: "Other" },
];

function getScheduleItemStyle(type: ScheduleItem["type"]) {
  switch (type) {
    case "interview":
      // Strong yellow card with Space Cadet border
      return "bg-[#FFE14E] border-[#192853] text-[#192853]";
    case "meeting":
      // Same yellow card for meetings for consistent palette
      return "bg-[#FFE14E] border-[#192853] text-[#192853]";
    default:
      // Slightly softer yellow for tasks/other, still with navy border
      return "bg-[#FFF7B0] border-[#192853] text-[#192853]";
  }
}

function TodayScheduleCard({
  scheduleItems,
  onAdd,
  onEdit,
  onRemove,
}: {
  scheduleItems: ScheduleItem[];
  onAdd: () => void;
  onEdit: (item: ScheduleItem) => void;
  onRemove: (id: string) => void;
}) {
  const [headingDate, setHeadingDate] = useState("Today");
  useEffect(() => {
    setHeadingDate(
      new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "Asia/Manila",
      })
    );
  }, []);

  const sorted = [...scheduleItems].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );

  return (
    <Card className="h-full rounded-3xl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Today&apos;s schedule</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {headingDate}
          </span>
          <Button
            size="sm"
            className="h-8 px-3 text-xs font-medium"
            onClick={onAdd}
          >
            Add task
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No events scheduled for today.</p>
        ) : (
          <div className="max-h-[280px] overflow-y-auto scrollbar-hide pr-1">
            <ul className="space-y-2">
              {sorted.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    "schedule-item flex items-center gap-3 rounded-md border px-3 py-2 text-sm group",
                    getScheduleItemStyle(item.type)
                  )}
                >
                  <span className="shrink-0 w-20 text-xs font-medium opacity-90">
                    {item.startTime} – {item.endTime}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 hover:!text-destructive"
                      onClick={() => onEdit(item)}
                      aria-label={`Edit ${item.title}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 hover:!text-destructive"
                      onClick={() => onRemove(item.id)}
                      aria-label={`Remove ${item.title}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AnnouncementDialog({
  open,
  onOpenChange,
  editingItem,
  onAdd,
  onUpdate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem: AnnouncementItem | null;
  onAdd: (item: Omit<AnnouncementItem, "id">) => void;
  onUpdate: (id: string, updates: Omit<AnnouncementItem, "id">) => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("Today");
  const [time, setTime] = useState("10:30 AM");
  const [error, setError] = useState("");

  const formatDateFromNative = (value: string) => {
    if (!value) return "";
    const parsed = new Date(value + "T12:00:00");
    if (Number.isNaN(parsed.getTime())) return "";
    const month = (parsed.getMonth() + 1).toString().padStart(2, "0");
    const day = parsed.getDate().toString().padStart(2, "0");
    const year = parsed.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const formatTimeFromNative = (value: string) => {
    if (!value) return "";
    const [hoursStr, minutes = "00"] = value.split(":");
    const hoursNum = Number(hoursStr);
    if (Number.isNaN(hoursNum)) return value;
    const suffix = hoursNum >= 12 ? "PM" : "AM";
    const normalized = ((hoursNum + 11) % 12) + 1;
    const displayHours = normalized.toString();
    return `${displayHours}:${minutes.padStart(2, "0")} ${suffix}`;
  };

  const isEditing = !!editingItem;

  const reset = useCallback(() => {
    setTitle("");
    setDate("Today");
    setTime("10:30 AM");
    setError("");
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      if (editingItem) {
        setTitle(editingItem.title);
        setDate(editingItem.date);
        setTime(editingItem.time);
        setError("");
      } else {
        reset();
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, editingItem, reset]);

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("Please enter a title.");
      return;
    }
    const payload = {
      title: title.trim(),
      date: date.trim() || "Today",
      time: time.trim() || "10:30 AM",
    };
    if (isEditing && editingItem) {
      onUpdate(editingItem.id, payload);
    } else {
      onAdd(payload);
    }
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit announcement" : "Add announcement"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update this announcement."
              : "Add a new announcement to the list."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="announcement-title">Title</Label>
            <Input
              id="announcement-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Meeting HR Department"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="announcement-date">Date</Label>
            <div className="relative">
              <Input
                id="announcement-date"
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="e.g. Today, Yesterday, 01/15/2025"
                className="date-input rounded-full pr-[2.75rem]"
              />
              <input
                type="date"
                aria-label="Pick announcement date"
                className="absolute inset-y-0 right-0 w-10 cursor-pointer opacity-0"
                onChange={(e) => setDate(formatDateFromNative(e.target.value))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="announcement-time">Time</Label>
            <div className="relative">
              <Input
                id="announcement-time"
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="e.g. 10:30 AM"
                className="time-input rounded-full pr-[2.75rem]"
              />
              <input
                type="time"
                aria-label="Pick announcement time"
                className="absolute inset-y-0 right-0 w-10 cursor-pointer opacity-0"
                onChange={(e) => setTime(formatTimeFromNative(e.target.value))}
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {isEditing ? "Save changes" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddTaskDialog({
  open,
  onOpenChange,
  editingItem,
  onAdd,
  onUpdate,
  dateKey,
  initialCategory,
  onCategoryChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem: ScheduleItem | null;
  onAdd: (item: Omit<ScheduleItem, "id">) => void;
  onUpdate: (id: string, updates: Omit<ScheduleItem, "id">) => void;
  dateKey: string;
  initialCategory: AddableScheduleCategory;
  onCategoryChange: (category: AddableScheduleCategory, savedDate: string) => void;
}) {
  const [date, setDate] = useState(dateKey);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [startTime, setStartTime] = useState(() => getDefaultScheduleTimesInPH().startTime);
  const [endTime, setEndTime] = useState(() => getDefaultScheduleTimesInPH().endTime);
  const [type, setType] = useState<ScheduleItem["type"]>("task");
  const [category, setCategory] = useState<AddableScheduleCategory>("events");
  const [error, setError] = useState("");

  const isEditing = !!editingItem;

  const reset = useCallback(() => {
    const defaults = getDefaultScheduleTimesInPH();
    setDate(dateKey);
    setTitle("");
    setLocation("");
    setStartTime(defaults.startTime);
    setEndTime(defaults.endTime);
    setCategory(initialCategory);
    setType(initialCategory === "meetings" ? "meeting" : "task");
    setError("");
  }, [dateKey, initialCategory]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      if (editingItem) {
        setDate(editingItem.date ?? dateKey);
        setTitle(editingItem.title);
        setLocation(editingItem.location ?? "");
        setStartTime(editingItem.startTime);
        setEndTime(editingItem.endTime);
        setType(editingItem.type);
        setCategory(inferCategoryFromScheduleType(editingItem.type));
        setError("");
      } else {
        reset();
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, editingItem, dateKey, reset]);

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const end = timeToMinutes(endTime);
    const start = timeToMinutes(startTime);
    if (!title.trim()) {
      setError("Please enter a title.");
      return;
    }
    if (!location.trim()) {
      setError("Please enter a place.");
      return;
    }
    if (end <= start) {
      setError("End time must be after start time.");
      return;
    }
    const normalizedDate = date || dateKey || getTodayDateKey();
    const updates = {
      date: normalizedDate,
      title: title.trim(),
      location: location.trim(),
      startTime,
      endTime,
      type,
    };
    onCategoryChange(category, normalizedDate);
    if (isEditing && editingItem) {
      onUpdate(editingItem.id, updates);
    } else {
      onAdd(updates);
    }
    handleOpenChange(false);
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal((
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={() => handleOpenChange(false)}
        aria-label="Close add task dialog"
      />
      <div className="relative z-[121] w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-2xl">
        <div className="mb-4 space-y-1.5">
          <h3 className="text-lg font-semibold leading-none tracking-tight">
            {isEditing ? "Edit task" : "Add task"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isEditing
              ? "Update this event in the selected schedule date."
              : `Add an event to ${dateKey}.`}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="schedule-category">Add to</Label>
            <select
              id="schedule-category"
              value={category}
              onChange={(e) => {
                const next = e.target.value as AddableScheduleCategory;
                setCategory(next);
                setType(next === "meetings" ? "meeting" : "task");
              }}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="meetings">Meetings</option>
              <option value="events">Events</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedule-date">Date</Label>
            <Input
              id="schedule-date"
              type="date"
              className="date-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedule-title">Title</Label>
            <Input
              id="schedule-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Team standup"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedule-location">Place</Label>
            <Input
              id="schedule-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Conference Room A"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="schedule-start">Start time</Label>
              <Input
                id="schedule-start"
                type="time"
                className="time-input"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-end">End time</Label>
              <Input
                id="schedule-end"
                type="time"
                className="time-input"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedule-type">Type</Label>
            <select
              id="schedule-type"
              value={type}
              onChange={(e) => setType(e.target.value as ScheduleItem["type"])}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              {SCHEDULE_TYPE_OPTIONS.filter((opt) =>
                category === "meetings"
                  ? opt.value === "meeting" || opt.value === "interview"
                  : opt.value === "task" || opt.value === "other"
              ).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{isEditing ? "Save changes" : "Add task"}</Button>
          </div>
        </form>
      </div>
    </div>
  ), document.body);
}
