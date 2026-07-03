export type AppNotification = {
  id: string;
  title: string;
  body: string;
  /** Human-readable time label (demo) */
  time: string;
  /** When true, show unread dot/badge (demo) */
  unread?: boolean;
};

export const DEMO_NOTIFICATIONS: AppNotification[] = [
  {
    id: "n-1",
    title: "New leave request",
    body: "Glean Ramos requested Annual Leave (3 days).",
    time: "Just now",
    unread: true,
  },
  {
    id: "n-2",
    title: "Attendance correction",
    body: "Lisa Chen submitted an attendance correction for yesterday.",
    time: "10 min ago",
    unread: true,
  },
  {
    id: "n-3",
    title: "Payroll published",
    body: "Your latest payslip is now available.",
    time: "2 hrs ago",
  },
];

export function getUnreadCount(items: AppNotification[]): number {
  return items.reduce((acc, n) => acc + (n.unread ? 1 : 0), 0);
}

function storageKey(scope: string) {
  return `hris-notifications:${scope}`;
}

function safeParseArray(raw: string | null): AppNotification[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as AppNotification[];
  } catch {
    return [];
  }
}

export function loadRoleNotifications(role: string): AppNotification[] {
  if (typeof window === "undefined") return [];
  return safeParseArray(localStorage.getItem(storageKey(role)));
}

export function pushRoleNotification(role: string, n: Omit<AppNotification, "id">): AppNotification {
  const created: AppNotification = {
    ...n,
    id: `notif-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    unread: n.unread ?? true,
  };
  if (typeof window !== "undefined") {
    const prev = loadRoleNotifications(role);
    localStorage.setItem(storageKey(role), JSON.stringify([created, ...prev].slice(0, 200)));
  }
  return created;
}

export function getNotificationsForRole(role: string): AppNotification[] {
  // Keep demo notifications for now, but also include role-targeted items (offboarding -> IT).
  const local = loadRoleNotifications(role);
  return [...local, ...DEMO_NOTIFICATIONS];
}
