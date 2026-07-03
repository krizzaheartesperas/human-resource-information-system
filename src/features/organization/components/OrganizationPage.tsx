"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { DashboardSectionTopBar } from "@/components/layout/DashboardSectionTopBar";
import { EmployeeSectionHeader } from "@/components/layout/EmployeeSectionHeader";
import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";
import { Building2, Network, Search } from "lucide-react";
import {
  departments,
  employees,
  getDepartmentById,
  type Department,
  type Employee,
} from "@/lib/mock";
import { cn } from "@/lib/utils";

export default function OrganizationPage() {
  const { user: currentUser } = useCurrentUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Employee["role"]>("all");

  const me: Employee | undefined = useMemo(
    () => employees.find((e) => e.id === currentUser.employeeId),
    [currentUser.employeeId]
  );

  const myDepartment: Department | undefined = me
    ? getDepartmentById(me.departmentId)
    : undefined;

  /** Current user's reporting manager (who they report to). */
  const myManager: Employee | null = useMemo(() => {
    if (!me || !me.managerId) return null;
    return employees.find((e) => e.id === me.managerId) ?? null;
  }, [me]);

  /** Manager of "My department" (from department.managerId) — used for the department card. */
  const departmentManager: Employee | null = useMemo(() => {
    if (!myDepartment || !myDepartment.managerId) return null;
    return employees.find((e) => e.id === myDepartment.managerId) ?? null;
  }, [myDepartment]);

  const myTeam: Employee[] = useMemo(() => {
    if (!myDepartment) return [];
    return employees.filter((e) => e.departmentId === myDepartment.id);
  }, [myDepartment]);

  const simpleOrg = useMemo(
    () =>
      departments.map((dept) => ({
        dept,
        count: employees.filter((e) => e.departmentId === dept.id).length,
      })),
    []
  );

  const [highlightEmployeeId, setHighlightEmployeeId] = useState<string | null>(null);

  const matchingEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return employees
      .filter((emp) => {
        if (roleFilter !== "all" && emp.role !== roleFilter) return false;
        const dept = getDepartmentById(emp.departmentId);
        const haystack = [
          emp.firstName,
          emp.lastName,
          emp.jobTitle,
          emp.email,
          dept?.name ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 8);
  }, [searchQuery, roleFilter]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const trimmed = searchQuery.trim();
      if (!trimmed) {
        setHighlightEmployeeId(null);
        return;
      }
      if (matchingEmployees.length === 0) {
        setHighlightEmployeeId(null);
        return;
      }
      setHighlightEmployeeId((prev) => {
        if (prev && matchingEmployees.some((e) => e.id === prev)) return prev;
        return matchingEmployees[0].id;
      });
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [searchQuery, matchingEmployees]);

  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(tabParam === "diagram" || tabParam === "chart" ? tabParam : "diagram");

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t !== "diagram" && t !== "chart") return;
    const id = window.setTimeout(() => setActiveTab(t), 0);
    return () => window.clearTimeout(id);
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const url = value === "diagram" ? "/organization?tab=diagram" : "/organization?tab=chart";
    router.replace(url);
  };

  const headerByTab = {
    diagram: "Departments",
    chart: "Company Organization Chart",
  } as const;

  const headerTitle =
    headerByTab[activeTab as "diagram" | "chart"] ?? "Company Organization Chart";

  return (
    <div className="min-w-0 w-full max-w-full space-y-6">
      {/* Topbar + navbar (aligned with Complaints/Workflow/Payroll) */}
      <div className="min-w-0 space-y-3">
        {currentUser.role === "EMPLOYEE" || currentUser.role === "HR_STAFF" ? (
          <div className="flex flex-col gap-6">
            <EmployeeModuleTopbar searchPlaceholder="Search" />
            <EmployeeSectionHeader
              title="People Directory"
              tabs={[
                { id: "chart", label: "Company Organization Chart" },
                { id: "diagram", label: "Departments" },
              ]}
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          </div>
        ) : (
          <>
            <DashboardSectionTopBar
              breadcrumb={
                <>
                  <span className="truncate font-semibold">Organization</span>
                  <span className="shrink-0 opacity-70">&gt;</span>
                  <span className="truncate font-semibold text-foreground">{headerTitle}</span>
                </>
              }
              searchPlaceholder="Search people or departments..."
              searchInputProps={{
                value: searchQuery,
                onChange: (e) => setSearchQuery(e.target.value),
              }}
            />

            <div className="border-b border-border/70">
              <div className="-mx-1 flex gap-1 overflow-x-auto py-1 [scrollbar-width:thin] sm:gap-6 lg:gap-8 [&::-webkit-scrollbar]:h-1.5">
                <button
                  type="button"
                  onClick={() => handleTabChange("chart")}
                  className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap pb-3 -mb-px px-2 text-sm transition-colors sm:text-base ${
                    activeTab === "chart"
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:text-primary"
                  }`}
                >
                  <Network className="size-4 shrink-0" />
                  <span>Company Organization Chart</span>
                  <span
                    className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left bg-primary transition-transform duration-200 ${
                      activeTab === "chart" ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange("diagram")}
                  className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap pb-3 -mb-px px-2 text-sm transition-colors sm:text-base ${
                    activeTab === "diagram"
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:text-primary"
                  }`}
                >
                  <Building2 className="size-4 shrink-0" />
                  <span>Departments</span>
                  <span
                    className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left bg-primary transition-transform duration-200 ${
                      activeTab === "diagram" ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Organization content, switched by navbar tab for all roles */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="min-w-0 w-full space-y-3">
          <TabsContent value="diagram" className="min-w-0 space-y-4">
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              <Card className="flex max-h-[calc(100dvh-11rem)] min-h-[280px] min-w-0 flex-col overflow-hidden pt-1 pb-2 md:max-h-none md:h-[83vh] md:min-h-[480px]">
                <CardHeader>
                  <CardTitle className="text-base">My department</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-3 text-sm flex-1 min-h-0">
                {myDepartment ? (
                  <>
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
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

              <Card className="flex max-h-[calc(100dvh-11rem)] min-h-[280px] min-w-0 flex-col overflow-hidden pt-1 pb-2 md:max-h-none md:h-[83vh] md:min-h-[480px]">
                <CardHeader>
                  <CardTitle className="text-base">My team members</CardTitle>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col pt-6">
                {myDepartment && myTeam.length > 0 ? (
                  <div className="min-w-0 flex-1 overflow-x-auto overflow-y-auto scrollbar-hide rounded-md border border-border p-2 pb-3">
                    <Table scrollable={false} className="min-w-[520px]">
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
          </TabsContent>

          <TabsContent value="chart" className="min-w-0 space-y-3">
            <Card className="min-w-0 pt-1 pb-2">
              <CardHeader className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="text-base">Company org chart</CardTitle>
                <div className="flex w-full min-w-0 flex-col gap-3 md:w-auto md:flex-row md:items-center md:justify-end">
                  <div className="flex min-w-0 flex-1 items-start gap-2 md:max-w-xs">
                    <div className="relative w-full min-w-0">
                      <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder="Search people"
                        value={searchQuery}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSearchQuery(value);
                          if (!value.trim()) {
                            setHighlightEmployeeId(null);
                          }
                        }}
                        className="pl-8 h-8 text-sm"
                      />
                      {searchQuery.trim() && (
                        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto scrollbar-hide rounded-md border border-border bg-popover text-xs shadow-md">
                          {matchingEmployees.length === 0 ? (
                            <p className="px-3 py-2 text-muted-foreground">
                              No people found.
                            </p>
                          ) : (
                            matchingEmployees.map((emp) => {
                              const dept = getDepartmentById(emp.departmentId);
                              return (
                                <button
                                  key={emp.id}
                                  type="button"
                                  onClick={() => setHighlightEmployeeId(emp.id)}
                                  className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-muted/70"
                                >
                                  <p className="text-sm font-medium">
                                    {emp.firstName} {emp.lastName}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {emp.jobTitle} · {dept?.name ?? "—"}
                                  </p>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex w-full min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
                    <span className="shrink-0 text-xs text-muted-foreground">Filter by role</span>
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value as "all" | Employee["role"])}
                      className="h-9 w-full min-w-0 rounded-md border border-border bg-background px-2 text-xs sm:h-8 sm:w-auto"
                    >
                      <option value="all">All roles</option>
                      <option value="SUPER_ADMIN">Super Admin</option>
                      <option value="HR_ADMIN">HR Administrator</option>
                      <option value="HR_MANAGER">HR Manager</option>
                      <option value="HR_STAFF">HR Officer</option>
                      <option value="DEPARTMENT_MANAGER">Department Manager</option>
                      <option value="EMPLOYEE">Employee</option>
                      <option value="AUDITOR">Auditor</option>
                      <option value="EXECUTIVE">Executive</option>
                      <option value="BOARD">Board</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="min-w-0 pt-2">
                <div className="min-h-[280px] min-w-0 overflow-x-auto overflow-y-auto scrollbar-hide rounded-md border border-border p-4 sm:min-h-[320px] sm:p-5 md:h-[62vh] md:min-h-[62vh]">
                  <OrgChart
                    searchQuery={searchQuery}
                    highlightEmployeeId={highlightEmployeeId}
                    roleFilter={roleFilter}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    </div>
  );
}

function getRoleVisuals(role: Employee["role"]) {
  switch (role) {
    case "SUPER_ADMIN":
      return {
        borderClass: "border-pink-400/60",
        bgClass: "bg-pink-500/10",
        badgeLabel: "Super Admin",
        badgeClass: "border-pink-400 text-pink-200",
      };
    case "HR_ADMIN":
      return {
        borderClass: "border-emerald-400/60",
        bgClass: "bg-emerald-500/10",
        badgeLabel: "HR Admin",
        badgeClass: "border-emerald-400 text-emerald-200",
      };
    case "HR_MANAGER":
      return {
        borderClass: "border-emerald-400/60",
        bgClass: "bg-emerald-500/10",
        badgeLabel: "HR Manager",
        badgeClass: "border-emerald-400 text-emerald-200",
      };
    case "HR_STAFF":
      return {
        borderClass: "border-emerald-400/60",
        bgClass: "bg-emerald-500/10",
        badgeLabel: "HR Officer",
        badgeClass: "border-emerald-400 text-emerald-200",
      };
    case "DEPARTMENT_MANAGER":
      return {
        borderClass: "border-sky-400/60",
        bgClass: "bg-sky-500/10",
        badgeLabel: "Dept Manager",
        badgeClass: "border-sky-400 text-sky-200",
      };
    case "AUDITOR":
      return {
        borderClass: "border-amber-400/60",
        bgClass: "bg-amber-500/10",
        badgeLabel: "Auditor",
        badgeClass: "border-amber-400 text-amber-200",
      };
    case "EXECUTIVE":
      return {
        borderClass: "border-indigo-400/60",
        bgClass: "bg-indigo-500/10",
        badgeLabel: "Executive",
        badgeClass: "border-indigo-400 text-indigo-200",
      };
    case "BOARD":
      return {
        borderClass: "border-violet-400/60",
        bgClass: "bg-violet-500/10",
        badgeLabel: "Board",
        badgeClass: "border-violet-400 text-violet-200",
      };
    default:
      return {
        borderClass: "border-primary/40",
        bgClass: "bg-primary/10",
        badgeLabel: "Employee",
        badgeClass: "border-primary/40 text-primary/80",
      };
  }
}

function OrgChart({
  searchQuery,
  highlightEmployeeId,
  roleFilter,
}: {
  searchQuery: string;
  highlightEmployeeId: string | null;
  roleFilter: "all" | Employee["role"];
}) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const roots = departments.filter((d) => d.parentId === null);

  const deptNodes = roots.map((root) => ({
    root,
    children: departments.filter((d) => d.parentId === root.id),
  }));

  const matchesQuery = (emp: Employee | undefined, dept: Department) => {
    if (!normalizedQuery) return true;
    const q = normalizedQuery;
    const parts = [
      emp?.firstName ?? "",
      emp?.lastName ?? "",
      emp?.jobTitle ?? "",
      emp?.email ?? "",
      dept.name,
    ];
    return parts.join(" ").toLowerCase().includes(q);
  };

  const matchesRole = (emp: Employee | undefined, roleFilter: "all" | Employee["role"]) => {
    if (!emp || roleFilter === "all") return true;
    return emp.role === roleFilter;
  };

  const renderDeptColumn = (dept: Department, roleFilter: "all" | Employee["role"]) => {
    const mgr = dept.managerId
      ? employees.find((e) => e.id === dept.managerId)
      : undefined;
    const fullTeam = employees.filter(
      (e) => e.departmentId === dept.id && matchesRole(e, roleFilter)
    );
    const team = normalizedQuery
      ? fullTeam.filter((e) => matchesQuery(e, dept))
      : fullTeam;

    // When searching, hide departments that don't match manager, team, or dept name
    if (
      (normalizedQuery || roleFilter !== "all") &&
      team.length === 0 &&
      !matchesQuery(mgr, dept) &&
      !matchesRole(mgr ?? undefined, roleFilter)
    ) {
      return null;
    }

    return (
      <div key={dept.id} className="flex flex-col items-center gap-2">
        <div className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-2 w-56 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold leading-tight">{dept.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {mgr
                  ? `${mgr.firstName} ${mgr.lastName}`
                  : "No manager assigned"}
              </p>
            </div>
            <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0.5">
              {dept.code}
            </Badge>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {fullTeam.length} employee{fullTeam.length === 1 ? "" : "s"}
          </p>
        </div>
        {team.length > 0 && (
          <>
            <div className="h-4 w-0.5 bg-muted-foreground/60" />
            <div className="flex flex-wrap justify-center gap-2">
              {team.map((emp) => {
                const isHighlighted = emp.id === highlightEmployeeId;
                const { borderClass, bgClass, badgeLabel, badgeClass } = getRoleVisuals(
                  emp.role
                );
                return (
                  <div
                    key={emp.id}
                    className={cn(
                      "rounded-md border px-2 py-1 text-[11px] w-40 text-center transition-colors shadow-sm",
                      borderClass,
                      bgClass,
                      isHighlighted && "ring-2 ring-primary/60"
                    )}
                  >
                    <p
                      className={cn(
                        "font-medium truncate",
                        isHighlighted && "text-primary"
                      )}
                    >
                      {emp.firstName} {emp.lastName}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {emp.jobTitle}
                    </p>
                    <p
                      className={cn(
                        "mt-1 inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wide",
                        badgeClass
                      )}
                    >
                      {badgeLabel}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex w-full min-w-0 flex-col items-center text-sm">
      {/* Root company node */}
      <div className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 shadow-sm sm:px-6">
        <p className="text-sm font-semibold">Company</p>
        <p className="text-xs text-muted-foreground">
          Departments and managers
        </p>
      </div>

      {/* Connector + departments: w-max avoids circular width with w-full inside min-w-max (was collapsing to 0). */}
      <div className="h-6 w-0.5 shrink-0 bg-muted-foreground/60" />

      <div className="w-full overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]">
        {deptNodes.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            No top-level departments to display. Add departments with no parent in mock data.
          </p>
        ) : (
          <div className="mx-auto flex w-max max-w-none flex-col items-stretch px-2">
            <div className="h-0.5 w-full min-w-[280px] shrink-0 bg-muted-foreground/60" />
            <div className="flex justify-center gap-4 pt-0 sm:gap-8">
              {deptNodes.map(({ root }) => (
                <div key={root.id} className="flex flex-col items-center">
                  <div className="h-6 w-0.5 shrink-0 bg-muted-foreground/60" />
                  {renderDeptColumn(root, roleFilter)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
