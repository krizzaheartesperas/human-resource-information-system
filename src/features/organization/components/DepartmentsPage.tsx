"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeletonRows } from "@/components/ui/table-skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, User, Plus, Trash2 } from "lucide-react";
import { departments as baseDepartments, getEmployeeById, employees, type Department, type Employee } from "@/lib/mock";
import { useCurrentUser } from "@/lib/CurrentUserContext";

const DEPARTMENTS_STORAGE_KEY = "hris-departments";

function loadDepartments(): Department[] {
  if (typeof window === "undefined") return baseDepartments;
  try {
    const raw = window.localStorage.getItem(DEPARTMENTS_STORAGE_KEY);
    if (!raw) return baseDepartments;
    const parsed = JSON.parse(raw) as Department[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : baseDepartments;
  } catch {
    return baseDepartments;
  }
}

function saveDepartments(list: Department[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEPARTMENTS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function DepartmentOverviewCard({
  dept,
  canManage,
  onEdit,
  onDelete,
  teamTableLoading,
}: {
  dept: Department;
  canManage: boolean;
  onEdit: (dept: Department) => void;
  onDelete: (deptId: string) => void;
  teamTableLoading?: boolean;
}) {
  const manager = dept.managerId ? getEmployeeById(dept.managerId) : null;
  const team: Employee[] = useMemo(
    () => employees.filter((e) => e.departmentId === dept.id),
    [dept.id]
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="size-4" />
          <span>{dept.name}</span>
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[11px] px-2 py-0.5">
            {dept.code}
          </Badge>
          {canManage && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 text-xs"
                onClick={() => onEdit(dept)}
                aria-label="Edit department"
              >
                ✎
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => onDelete(dept.id)}
                aria-label="Delete department"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <User className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">Department manager</span>
          </div>
          <div className="ml-6">
            {manager ? (
              <>
                <div className="font-medium">
                  {manager.firstName} {manager.lastName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {manager.jobTitle} · {manager.email}
                </div>
              </>
            ) : (
              <div className="text-xs text-muted-foreground">No manager assigned yet.</div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-muted-foreground">Team size</div>
            <div className="font-medium">
              {team.length} employee{team.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Team members</div>
          {team.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No employees assigned to this department yet.
            </p>
          ) : (
            <div className="rounded-md border border-border max-h-64 overflow-y-auto scrollbar-hide">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Job title</TableHead>
                    <TableHead>Employee #</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamTableLoading ? (
                    <TableSkeletonRows columns={3} prefix={`dept-team-${dept.id}`} />
                  ) : (
                  team.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <div className="font-medium">
                          {emp.firstName} {emp.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {emp.email}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{emp.jobTitle}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {emp.employeeNumber}
                      </TableCell>
                    </TableRow>
                  ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DepartmentsPage() {
  const { user: currentUser } = useCurrentUser();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("dept") ?? undefined;
  const [allDepts, setAllDepts] = useState<Department[]>(() => loadDepartments());
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [parentId, setParentId] = useState<string | "">("");
  const [managerId, setManagerId] = useState<string | "">("");
  const canManageStructure = currentUser.role === "SUPER_ADMIN";

  // For Employee view: reuse the Org diagram-style cards (My department / My team members)
  const me: Employee | undefined = useMemo(
    () => employees.find((e) => e.id === currentUser.employeeId),
    [currentUser.employeeId]
  );

  const myDepartment: Department | undefined = useMemo(
    () => (me ? allDepts.find((d) => d.id === me.departmentId) : undefined),
    [me, allDepts]
  );

  const departmentManager: Employee | null = useMemo(() => {
    if (!myDepartment || !myDepartment.managerId) return null;
    return getEmployeeById(myDepartment.managerId) ?? null;
  }, [myDepartment]);

  const myTeam: Employee[] = useMemo(() => {
    if (!myDepartment) return [];
    return employees.filter((e) => e.departmentId === myDepartment.id);
  }, [myDepartment]);

  const allowedDepartments =
    currentUser.role === "EMPLOYEE"
      ? []
      : currentUser.role === "DEPARTMENT_MANAGER"
      ? allDepts.filter((d) => d.managerId === currentUser.employeeId)
      : allDepts;

  const selectedDept = allowedDepartments.find((d) => d.id === selectedId);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setCode("");
    setParentId("");
    setManagerId("");
    setEditOpen(true);
  };

  const openEdit = (dept: Department) => {
    setEditing(dept);
    setName(dept.name);
    setCode(dept.code);
    setParentId(dept.parentId ?? "");
    setManagerId(dept.managerId ?? "");
    setEditOpen(true);
  };

  const handleSaveDept = () => {
    const trimmedName = name.trim();
    const trimmedCode = code.trim();
    if (!trimmedName || !trimmedCode) return;
    if (editing) {
      const next = allDepts.map((d) =>
        d.id === editing.id
          ? {
              ...d,
              name: trimmedName,
              code: trimmedCode,
              parentId: parentId || null,
              managerId: managerId || null,
            }
          : d
      );
      setAllDepts(next);
      saveDepartments(next);
    } else {
      const id = "dept-added-" + Date.now();
      const newDept: Department = {
        id,
        name: trimmedName,
        code: trimmedCode,
        parentId: parentId || null,
        managerId: managerId || null,
      };
      const next = [...allDepts, newDept];
      setAllDepts(next);
      saveDepartments(next);
    }
    setEditOpen(false);
  };

  const handleDeleteDept = (deptId: string) => {
    const next = allDepts.filter((d) => d.id !== deptId);
    setAllDepts(next);
    saveDepartments(next);
  };

  return (
    <div className="space-y-6 -mt-2">
      <div className="mt-[10px] flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Departments
        </h1>
        {canManageStructure && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4 mr-2" />
            Add department
          </Button>
        )}
      </div>

      {currentUser.role === "EMPLOYEE" || currentUser.role === "HR_STAFF" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="h-[83vh] min-h-[480px] flex flex-col min-h-0 pt-1 pb-2">
            <CardHeader>
              <CardTitle className="text-base">My department</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-3 text-sm flex-1 min-h-0">
              {myDepartment ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{myDepartment.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Department code: {myDepartment.code}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="font-mono text-[11px] px-2 py-0.5"
                    >
                      {myDepartment.code}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Manager</p>
                    {departmentManager ? (
                      <div>
                        <p className="font-medium">
                          {departmentManager.firstName} {departmentManager.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {departmentManager.jobTitle}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {departmentManager.email}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No manager assigned to this department yet.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  We couldn&apos;t find your department in the mock data.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="h-[83vh] min-h-[480px] flex flex-col min-h-0 pt-1 pb-2">
            <CardHeader>
              <CardTitle className="text-base">My team members</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 flex-1 flex flex-col min-h-0">
              {myDepartment && myTeam.length > 0 ? (
                <div className="rounded-md border border-border flex-1 overflow-y-auto scrollbar-hide p-2 pb-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Job title</TableHead>
                        <TableHead>Employee #</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myTeam.map((emp) => (
                        <TableRow key={emp.id}>
                          <TableCell>
                            <div className="font-medium">
                              {emp.firstName} {emp.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {emp.email}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{emp.jobTitle}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {emp.employeeNumber}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No team members found for your department in the mock data.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : selectedDept ? (
        <div className="space-y-4">
          <DepartmentOverviewCard
            dept={selectedDept}
            canManage={canManageStructure}
            onEdit={openEdit}
            onDelete={handleDeleteDept}
            teamTableLoading={false}
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {allowedDepartments.map((dept) => (
            <DepartmentOverviewCard
              key={dept.id}
              dept={dept}
              canManage={canManageStructure}
              onEdit={openEdit}
              onDelete={handleDeleteDept}
              teamTableLoading={false}
            />
          ))}
        </div>
      )}

      {canManageStructure && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit department" : "Add department"}
              </DialogTitle>
              <DialogDescription>
                {editing
                  ? "Update department name, code, manager, or parent."
                  : "Create a new department and assign its manager and parent in the org structure."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="dept-name">Name</Label>
                <Input
                  id="dept-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Human Resources"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dept-code">Code</Label>
                <Input
                  id="dept-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. HR"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dept-parent">Parent department</Label>
                <select
                  id="dept-parent"
                  className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm"
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                >
                  <option value="">None (top-level)</option>
                  {allDepts
                    .filter((d) => !editing || d.id !== editing.id)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="dept-manager">Manager</Label>
                <select
                  id="dept-manager"
                  className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm"
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.firstName} {e.lastName} — {e.jobTitle}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveDept}>
                {editing ? "Save changes" : "Create department"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
