"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { departments, employees as mockEmployees, type Employee, type Role } from "@/lib/mock";
import { cn } from "@/lib/utils";
import { isSupabaseAuthConfigured } from "@/lib/supabase/supabaseAuth";
import { supabase } from "@/lib/supabase/client";
import { canAccessMyTime } from "@/lib/auth/permissions";
import {
  getPendingItAccountActionRequests,
  markItAccountActionRequestCompleted,
} from "@/features/it-account-actions/services/itAccountActions.service";
import type { ItAccountActionRequest } from "@/features/it-account-actions/types";

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object") return null;
  return v as Record<string, unknown>;
}

export default function UserManagementPage() {
  const { user } = useCurrentUser();
  const isSystemAdmin = user.role === "SUPER_ADMIN";
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<Employee | null>(null);
  const [editRole, setEditRole] = useState<Role>("EMPLOYEE");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [offboardOpen, setOffboardOpen] = useState(false);
  const [offboardRow, setOffboardRow] = useState<Employee | null>(null);
  const [offboardBusy, setOffboardBusy] = useState(false);
  const [offboardError, setOffboardError] = useState("");

  const [itRequests, setItRequests] = useState<ItAccountActionRequest[]>([]);
  const [itBusyId, setItBusyId] = useState<string | null>(null);
  const [itReqError, setItReqError] = useState("");

  const deptNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of departments) m.set(d.id, d.name);
    return m;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        if (!isSystemAdmin) {
          setRows([]);
          return;
        }

        // Demo / no-Supabase fallback: show mock users (read-only role changes are stored locally).
        if (!isSupabaseAuthConfigured()) {
          const overrides = (() => {
            try {
              return JSON.parse(localStorage.getItem("hris-user-mgmt-roles") ?? "{}") as Record<
                string,
                Role
              >;
            } catch {
              return {};
            }
          })();
          const statusOverrides = (() => {
            try {
              return JSON.parse(localStorage.getItem("hris-user-mgmt-status") ?? "{}") as Record<
                string,
                Employee["employmentStatus"]
              >;
            } catch {
              return {};
            }
          })();
          const merged = mockEmployees.map((e) => ({
            ...e,
            role: overrides[e.id] ?? e.role,
            employmentStatus: statusOverrides[e.id] ?? e.employmentStatus,
          }));
          if (!cancelled) setRows(merged);
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error("No active session. Please sign in again.");

        const resp = await fetch("/api/employees", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await resp.json().catch(() => null)) as unknown;
        const obj = asRecord(json);
        if (!resp.ok) {
          throw new Error(String(obj?.error ?? "Failed to load users."));
        }
        const employees = (obj?.employees ?? []) as Employee[];
        if (!cancelled) setRows(employees);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load users.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [isSystemAdmin]);

  useEffect(() => {
    if (!isSystemAdmin) return;
    setItRequests(getPendingItAccountActionRequests());
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith("hris-it-account-actions")) {
        setItRequests(getPendingItAccountActionRequests());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [isSystemAdmin]);

  const roleOptions: Role[] = useMemo(
    () => [
      "EMPLOYEE",
      "MANAGER",
      "DEPARTMENT_MANAGER",
      "HR_STAFF",
      "HR_MANAGER",
      "HR_ADMIN",
      "AUDITOR",
      "EXECUTIVE",
      "BOARD",
      "SUPER_ADMIN",
    ],
    []
  );

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.employmentStatus === "ACTIVE").length;
    const canUseMyTime = rows.filter((r) => canAccessMyTime(r.role)).length;
    return { total, active, canUseMyTime };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (roleFilter !== "ALL" && r.role !== roleFilter) return false;
      if (!q) return true;
      const hay = `${r.firstName} ${r.lastName} ${r.email} ${r.employeeNumber}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, roleFilter]);

  const openEdit = (row: Employee) => {
    setEditRow(row);
    setEditRole(row.role);
    setSaveError("");
    setEditOpen(true);
  };

  const openOffboard = (row: Employee) => {
    setOffboardRow(row);
    setOffboardError("");
    setOffboardOpen(true);
  };

  const runOffboard = async (authAction: "disable" | "delete") => {
    if (!offboardRow) return;
    setOffboardBusy(true);
    setOffboardError("");
    try {
      if (!isSupabaseAuthConfigured()) {
        const raw = localStorage.getItem("hris-user-mgmt-status") ?? "{}";
        const parsed = JSON.parse(raw) as Record<string, Employee["employmentStatus"]>;
        parsed[offboardRow.id] = "OFFBOARDED";
        localStorage.setItem("hris-user-mgmt-status", JSON.stringify(parsed));
        setRows((prev) =>
          prev.map((r) => (r.id === offboardRow.id ? { ...r, employmentStatus: "OFFBOARDED" } : r))
        );
        setOffboardOpen(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("No active session. Please sign in again.");

      const resp = await fetch(`/api/employees/${encodeURIComponent(offboardRow.id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ employmentStatus: "OFFBOARDED", authAction }),
      });
      const json = (await resp.json().catch(() => null)) as unknown;
      const obj = asRecord(json);
      if (!resp.ok) {
        throw new Error(String(obj?.error ?? "Failed to offboard user."));
      }

      setRows((prev) =>
        prev.map((r) => (r.id === offboardRow.id ? { ...r, employmentStatus: "OFFBOARDED" } : r))
      );
      setOffboardOpen(false);
    } catch (e) {
      setOffboardError(e instanceof Error ? e.message : "Failed to offboard user.");
    } finally {
      setOffboardBusy(false);
    }
  };

  const fulfillItRequest = async (req: ItAccountActionRequest) => {
    setItReqError("");
    setItBusyId(req.id);
    try {
      const authAction = req.action === "DELETE_ACCOUNT" ? "delete" : "disable";
      if (!isSupabaseAuthConfigured()) {
        const raw = localStorage.getItem("hris-user-mgmt-status") ?? "{}";
        const parsed = JSON.parse(raw) as Record<string, Employee["employmentStatus"]>;
        parsed[req.employeeId] = "OFFBOARDED";
        localStorage.setItem("hris-user-mgmt-status", JSON.stringify(parsed));
        setRows((prev) =>
          prev.map((r) => (r.id === req.employeeId ? { ...r, employmentStatus: "OFFBOARDED" } : r))
        );
        markItAccountActionRequestCompleted(req.id);
        setItRequests(getPendingItAccountActionRequests());
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("No active session. Please sign in again.");

      const resp = await fetch(`/api/employees/${encodeURIComponent(req.employeeId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ employmentStatus: "OFFBOARDED", authAction }),
      });
      const json = (await resp.json().catch(() => null)) as unknown;
      const obj = asRecord(json);
      if (!resp.ok) throw new Error(String(obj?.error ?? "Failed to apply IT request."));

      setRows((prev) =>
        prev.map((r) => (r.id === req.employeeId ? { ...r, employmentStatus: "OFFBOARDED" } : r))
      );
      markItAccountActionRequestCompleted(req.id);
      setItRequests(getPendingItAccountActionRequests());
    } catch (e) {
      setItReqError(e instanceof Error ? e.message : "Failed to apply IT request.");
    } finally {
      setItBusyId(null);
    }
  };

  const saveRole = async () => {
    if (!editRow) return;
    setSaving(true);
    setSaveError("");
    try {
      // Demo mode: persist overrides locally.
      if (!isSupabaseAuthConfigured()) {
        const raw = localStorage.getItem("hris-user-mgmt-roles") ?? "{}";
        const parsed = JSON.parse(raw) as Record<string, Role>;
        parsed[editRow.id] = editRole;
        localStorage.setItem("hris-user-mgmt-roles", JSON.stringify(parsed));
        setRows((prev) => prev.map((r) => (r.id === editRow.id ? { ...r, role: editRole } : r)));
        setEditOpen(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("No active session. Please sign in again.");

      const resp = await fetch(`/api/employees/${encodeURIComponent(editRow.id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: editRole }),
      });
      const json = (await resp.json().catch(() => null)) as unknown;
      const obj = asRecord(json);
      if (!resp.ok) {
        throw new Error(String(obj?.error ?? "Failed to update user role."));
      }

      setRows((prev) => prev.map((r) => (r.id === editRow.id ? { ...r, role: editRole } : r)));
      setEditOpen(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to update user role.");
    } finally {
      setSaving(false);
    }
  };

  if (!isSystemAdmin) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>User management</CardTitle>
            <CardDescription>You don’t have access to manage accounts.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            User management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage accounts, roles, and access for Workzen HRIS.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total users</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-2xl">{stats.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Can use My Time</CardDescription>
            <CardTitle className="text-2xl">{stats.canUseMyTime}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Users</CardTitle>
            <CardDescription>Search users and update their portal role.</CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, employee #"
              className="w-full sm:w-[320px]"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as Role | "ALL")}
              className={cn(
                "h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              )}
            >
              <option value="ALL">All roles</option>
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Loading users…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium tabular-nums">
                      {r.employeeNumber || "—"}
                    </TableCell>
                    <TableCell>
                      {`${r.firstName} ${r.lastName}`.trim() || r.email || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.email || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {deptNameById.get(r.departmentId) ?? r.departmentId ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{r.role.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={r.employmentStatus === "ACTIVE" ? "default" : "outline"}
                      >
                        {r.employmentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                          Edit role
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openOffboard(r)}
                          disabled={r.employmentStatus === "OFFBOARDED"}
                        >
                          Offboard
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>IT account action requests</CardTitle>
          <CardDescription>
            Requests coming from HR offboarding to disable or delete accounts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {itReqError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
              {itReqError}
            </div>
          )}

          {itRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending IT requests.</p>
          ) : (
            <div className="space-y-2">
              {itRequests.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-border/70 bg-background px-3 py-3 sm:px-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">
                          {r.action === "DELETE_ACCOUNT" ? "Delete account" : "Disable access"}
                        </Badge>
                        <p className="text-sm font-semibold text-foreground break-words">
                          {r.employeeName}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground break-words">
                        {r.employeeEmail || "—"} • Requested by {r.requestedByName} (
                        {r.requestedByRole.replace(/_/g, " ")}) •{" "}
                        {new Date(r.requestedAt).toLocaleString()}
                      </p>
                      <p className="mt-2 text-sm text-foreground/90 break-words">{r.reason}</p>
                    </div>
                    <div className="flex shrink-0 gap-2 sm:justify-end">
                      <Button
                        size="sm"
                        variant={r.action === "DELETE_ACCOUNT" ? "destructive" : "outline"}
                        onClick={() => void fulfillItRequest(r)}
                        disabled={itBusyId === r.id}
                      >
                        {itBusyId === r.id ? "Working…" : "Apply"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Update role</DialogTitle>
            <DialogDescription>
              Changes affect which modules the user can access in the portal.
            </DialogDescription>
          </DialogHeader>

          {editRow && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-sm font-medium text-foreground">
                  {`${editRow.firstName} ${editRow.lastName}`.trim() || editRow.email || "User"}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{editRow.email || "—"}</div>
              </div>

              <div className="space-y-1.5">
                <div className="text-sm font-medium text-foreground">Role</div>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as Role)}
                  className={cn(
                    "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  )}
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {r.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>

              {saveError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                  {saveError}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveRole} disabled={saving || !editRow}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={offboardOpen} onOpenChange={setOffboardOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Offboard employee</DialogTitle>
            <DialogDescription>
              Recommended: disable login access and keep HR records for audit/history.
            </DialogDescription>
          </DialogHeader>

          {offboardRow && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-sm font-medium text-foreground">
                  {`${offboardRow.firstName} ${offboardRow.lastName}`.trim() ||
                    offboardRow.email ||
                    "User"}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {offboardRow.email || "—"} • {offboardRow.employeeNumber || "—"}
                </div>
              </div>

              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                Disabling is reversible. Deleting is permanent and may break historical references.
              </div>

              {offboardError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                  {offboardError}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOffboardOpen(false)} disabled={offboardBusy}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => runOffboard("disable")}
              disabled={offboardBusy || !offboardRow}
            >
              {offboardBusy ? "Working…" : "Disable access"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => runOffboard("delete")}
              disabled={offboardBusy || !offboardRow}
            >
              {offboardBusy ? "Working…" : "Delete account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
