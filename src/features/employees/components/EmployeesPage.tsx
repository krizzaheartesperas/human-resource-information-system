"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DashboardSectionTopBar } from "@/components/layout/DashboardSectionTopBar";
import { EmployeeSectionHeader } from "@/components/layout/EmployeeSectionHeader";
import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeletonRows } from "@/components/ui/table-skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { PhoneInput } from "@/components/ui/phone-input";
import Image from "next/image";
import { Search, User, Download, Plus, Upload } from "lucide-react";
import { employees, departments, type Employee, type EmploymentType } from "@/lib/mock";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { supabase } from "@/lib/supabase/client";
import { isSupabaseAuthConfigured } from "@/lib/supabase/supabaseAuth";
import { useDebounce } from "@/hooks/useDebounce";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/ui/pagination-controls";

const EMPLOYEE_OVERRIDES_KEY = "hris-employee-overrides";
const ADD_EMPLOYEE_PHOTO_KEY = "hris-add-employee-profile-photo";
const ADDED_EMPLOYEES_KEY = "hris-added-employees";

type EmployeeOverrides = Record<string, Partial<Employee>>;

function loadEmployeeOverrides(): EmployeeOverrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(EMPLOYEE_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as EmployeeOverrides;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function loadAddedEmployees(): Employee[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ADDED_EMPLOYEES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Employee[];
  } catch {
    return [];
  }
}

function saveAddedEmployees(list: Employee[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ADDED_EMPLOYEES_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function nextEmployeeNumber(existing: Employee[]): string {
  const nums = existing
    .map((e) => parseInt(e.employeeNumber.replace(/\D/g, ""), 10))
    .filter((n) => !Number.isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return "E" + String(max + 1).padStart(3, "0");
}

const EMPLOYMENT_TYPE_OPTIONS: { value: EmploymentType; label: string }[] = [
  { value: "FULL_TIME", label: "Full time" },
  { value: "PART_TIME", label: "Part time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "INTERNSHIP", label: "Internship" },
  { value: "PROBATION", label: "Probation" },
];

/** Loose row from API JSON or dynamic Supabase selects (columns vary by migration). */
type JsonObject = Record<string, unknown>;

function strU(v: unknown): string {
  return v == null ? "" : String(v);
}

type SupabaseRpcClient = {
  rpc: (fn: string) => Promise<{ data: unknown }>;
};

const API_TABLE_CACHE_TTL_MS = 30_000;
let employeesApiCache:
  | {
      key: string;
      timestamp: number;
      departments: JsonObject[];
      employees: JsonObject[];
      authUserId: string | null;
      rowsCount: number;
    }
  | null = null;

export default function EmployeesPage() {
  const { user: currentUser } = useCurrentUser();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [open, setOpen] = useState(false);
  const [addedEmployees, setAddedEmployees] = useState<Employee[]>([]);
  const [dbEmployees, setDbEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState<boolean>(isSupabaseAuthConfigured());
  const [employeesDebugMessage, setEmployeesDebugMessage] = useState<string>("");
  const [dbDepartments, setDbDepartments] = useState<
    Array<{ id: string; name: string; code?: string; managerId?: string | null }>
  >([]);
  const [dmManagedEmployeeIds, setDmManagedEmployeeIds] = useState<string[]>([]);
  const [dmDepartmentId, setDmDepartmentId] = useState<string | null>(null);
  const [dmManagedDepartmentIds, setDmManagedDepartmentIds] = useState<string[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    setAddedEmployees(loadAddedEmployees());
  }, []);

  useEffect(() => {
    if (!isSupabaseAuthConfigured()) return;
    let cancelled = false;
    const normalizedAuthUserId = String(currentUser.id ?? "").replace(/^auth-/i, "");
    setLoadingEmployees(true);

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user && !cancelled) {
        setEmployeesDebugMessage(
          "No Supabase auth session detected. Employee Records uses database-only mode, so no rows will appear without a signed-in Supabase user."
        );
      } else if (!cancelled) {
        setEmployeesDebugMessage("");
      }

      if (session?.access_token) {
        try {
          const cacheKey = `employees:${normalizedAuthUserId}`;
          const cached =
            employeesApiCache &&
            employeesApiCache.key === cacheKey &&
            Date.now() - employeesApiCache.timestamp < API_TABLE_CACHE_TTL_MS
              ? employeesApiCache
              : null;

          let apiDepartments: JsonObject[] = [];
          let apiEmployees: JsonObject[] = [];
          let apiAuthUserId: string | null = null;
          let apiRowsCount = 0;

          if (cached) {
            apiDepartments = cached.departments;
            apiEmployees = cached.employees;
            apiAuthUserId = cached.authUserId;
            apiRowsCount = cached.rowsCount;
          } else {
            const [deptResp, empResp] = await Promise.all([
              fetch("/api/departments", {
                headers: { Authorization: `Bearer ${session.access_token}` },
              }),
              fetch("/api/employees?includeAuthEmail=0", {
                headers: { Authorization: `Bearer ${session.access_token}` },
              }),
            ]);

            const deptJson = await deptResp.json().catch(() => ({}));
            const empJson = await empResp.json().catch(() => ({}));

            if (!deptResp.ok) {
              throw new Error(String(deptJson?.error ?? "Could not load departments"));
            }
            if (!empResp.ok) {
              throw new Error(String(empJson?.error ?? "Could not load employees"));
            }

            apiDepartments = Array.isArray((deptJson as { departments?: unknown }).departments)
              ? ((deptJson as { departments: unknown[] }).departments as JsonObject[])
              : [];
            apiEmployees = Array.isArray((empJson as { employees?: unknown }).employees)
              ? ((empJson as { employees: unknown[] }).employees as JsonObject[])
              : [];
            apiAuthUserId = empJson?.debug?.authUserId ? String(empJson.debug.authUserId) : null;
            apiRowsCount = Number(empJson?.debug?.rowsCount ?? apiEmployees.length ?? 0);

            employeesApiCache = {
              key: cacheKey,
              timestamp: Date.now(),
              departments: apiDepartments,
              employees: apiEmployees,
              authUserId: apiAuthUserId,
              rowsCount: apiRowsCount,
            };
          }

          if (!cancelled) {
            setDbDepartments(
              apiDepartments.map((d) => ({
                id: strU(d.id),
                name: strU(d.name) || "Department",
                code: d.code != null && d.code !== "" ? strU(d.code) : undefined,
                managerId:
                  d.managerId != null && d.managerId !== "" ? strU(d.managerId) : null,
              })),
            );
            setDbEmployees(apiEmployees as unknown as Employee[]);

            const normalizedAuthUserId = String(currentUser.id ?? "").replace(/^auth-/i, "");
            const viewer =
              apiEmployees.find((e) => strU(e.id) === String(currentUser.employeeId)) ??
              apiEmployees.find(
                (e) =>
                  strU(e.employeeNumber).toLowerCase() ===
                  String(currentUser.employeeNumber ?? "").toLowerCase()
              ) ??
              null;
            const managerEmployeeId = viewer?.id ? strU(viewer.id) : null;

            const managedIds = apiEmployees
              .filter(
                (e) =>
                  strU(e.managerId) === String(managerEmployeeId ?? "") ||
                  strU(e.managerId) === normalizedAuthUserId
              )
              .map((e) => strU(e.id))
              .filter(Boolean);

            const managedDepartmentIds = apiDepartments
              .filter((d) => {
                const depMgr = strU(d.managerId);
                return (
                  depMgr === String(managerEmployeeId ?? "") ||
                  depMgr === normalizedAuthUserId
                );
              })
              .map((d) => strU(d.id))
              .filter(Boolean);

            setDmManagedEmployeeIds(Array.from(new Set(managedIds)));
            setDmManagedDepartmentIds(Array.from(new Set(managedDepartmentIds)));
            setDmDepartmentId(viewer?.departmentId ? strU(viewer.departmentId) : null);

            if (currentUser.role === "DEPARTMENT_MANAGER" && apiEmployees.length <= 1) {
              setEmployeesDebugMessage(
                `Department Manager can currently see only own/no employee rows from database (rows=${apiRowsCount}, authUserId=${apiAuthUserId ?? "unknown"}). This usually means RLS scope or login session mismatch.`
              );
            } else {
              setEmployeesDebugMessage("");
            }
            setLoadingEmployees(false);
          }
          return;
        } catch (apiError) {
          if (!cancelled) {
            setEmployeesDebugMessage(
              `Could not load employees from database: ${
                apiError instanceof Error ? apiError.message : "Unknown API error"
              }`
            );
          }
        }
      }

      let deptSelectCols = ["id", "name", "department_code", "manager_id"];
      let deptRows: JsonObject[] | null = null;
      for (let i = 0; i < 6; i++) {
        const { data, error } = await supabase.from("departments").select(deptSelectCols.join(", "));
        if (!error) {
          deptRows = (data as unknown as JsonObject[]) ?? [];
          break;
        }
        const missingColumn = error.message.match(/column departments\.([a-zA-Z0-9_]+) does not exist/i)?.[1];
        if (!missingColumn) {
          deptRows = [];
          break;
        }
        deptSelectCols = deptSelectCols.filter((c) => c !== missingColumn);
        if (deptSelectCols.length === 0) {
          deptRows = [];
          break;
        }
      }
      if (!cancelled) {
        setDbDepartments(
          (deptRows ?? [])
            .filter((d) => d.id && d.name)
            .map((d) => ({
              id: strU(d.id),
              name: strU(d.name),
              code: d.department_code ? strU(d.department_code) : undefined,
              managerId: d.manager_id ? strU(d.manager_id) : null,
            }))
        );
      }

      let selectCols = [
        "id",
        "employee_code",
        "employee_number",
        "department_id",
        "department_code",
        "department",
        "dept_id",
        "department_name",
        "position",
        "employment_type",
        "employment_status",
        "portal_role",
        "role",
        "manager_id",
        "user_id",
        "auth_user_id",
      ];

      let rows: JsonObject[] | null = null;
      let employeesQueryError: string | null = null;
      for (let i = 0; i < 8; i++) {
        const { data, error } = await supabase.from("employees").select(selectCols.join(", "));
        if (!error) {
          rows = (data as unknown as JsonObject[]) ?? [];
          employeesQueryError = null;
          break;
        }
        const missingColumn = error.message.match(/column employees\.([a-zA-Z0-9_]+) does not exist/i)?.[1];
        if (!missingColumn) {
          rows = [];
          employeesQueryError = error.message;
          break;
        }
        selectCols = selectCols.filter((c) => c !== missingColumn);
        if (selectCols.length === 0) {
          rows = [];
          employeesQueryError = error.message;
          break;
        }
      }

      const empRows = rows ?? [];
      const userIds = Array.from(
        new Set(
          empRows
            .map((r) => strU(r.user_id ?? r.auth_user_id))
            .filter((v) => v.length > 0)
        )
      );

      const profileByUserId = new Map<string, JsonObject>();
      if (userIds.length > 0) {
        let profileSelectCols = [
          "user_id",
          "first_name",
          "last_name",
          "email",
          "birthday",
          "personal_phone",
          "phone",
          "current_address",
          "avatar_url",
        ];
        let profRows: JsonObject[] | null = null;
        for (let i = 0; i < 8; i++) {
          const { data, error } = await supabase
            .from("profiles")
            .select(profileSelectCols.join(", "))
            .in("user_id", userIds);
          if (!error) {
            profRows = (data as unknown as JsonObject[]) ?? [];
            break;
          }
          const missingColumn = error.message.match(/column profiles\.([a-zA-Z0-9_]+) does not exist/i)?.[1];
          if (!missingColumn) {
            profRows = [];
            break;
          }
          profileSelectCols = profileSelectCols.filter((c) => c !== missingColumn);
          if (profileSelectCols.length === 0) {
            profRows = [];
            break;
          }
        }

        for (const p of profRows ?? []) {
          const uid = strU(p.user_id);
          if (!uid) continue;
          profileByUserId.set(uid, p);
        }
      }

      const mapped: Employee[] = empRows.map((r) => {
        const uid = strU(r.user_id ?? r.auth_user_id);
        const p = uid ? profileByUserId.get(uid) : null;
        const mappedDepartmentId = strU(
          r.department_id ??
            r.department_code ??
            r.department ??
            r.dept_id ??
            r.department_name ??
            ""
        );
        return {
          id: strU(r.id) || crypto.randomUUID(),
          employeeNumber: strU(r.employee_code ?? r.employee_number) || "—",
          firstName: strU(p?.first_name),
          lastName: strU(p?.last_name),
          email: strU(p?.email),
          departmentId: mappedDepartmentId,
          jobTitle: strU(r.position),
          managerId: r.manager_id ? strU(r.manager_id) : null,
          employmentStatus: strU(r.employment_status ?? "ACTIVE").toUpperCase() === "ONBOARDING"
            ? "ONBOARDING"
            : strU(r.employment_status ?? "ACTIVE").toUpperCase() === "OFFBOARDED"
            ? "OFFBOARDED"
            : "ACTIVE",
          startDate: new Date().toISOString().slice(0, 10),
          role: strU(r.portal_role ?? r.role ?? "EMPLOYEE").toUpperCase() as Employee["role"],
          employmentType: (
            strU(r.employment_type ?? "FULL_TIME").toUpperCase().replace(/\s+/g, "_")
          ) as EmploymentType,
          birthday: p?.birthday ? strU(p.birthday) : undefined,
          currentAddress: p?.current_address ? strU(p.current_address) : undefined,
          personalPhone: p?.personal_phone
            ? strU(p.personal_phone)
            : p?.phone
            ? strU(p.phone)
            : undefined,
          profilePhoto: p?.avatar_url ? strU(p.avatar_url) : undefined,
        };
      });

      if (currentUser.role === "DEPARTMENT_MANAGER") {
        const viewerById = empRows.find((r) => strU(r.id) === String(currentUser.employeeId));
        const viewerByUser = empRows.find((r) => strU(r.user_id ?? r.auth_user_id) === normalizedAuthUserId);
        const viewerByCode = empRows.find(
          (r) =>
            strU(r.employee_code ?? r.employee_number).toLowerCase() ===
            String(currentUser.employeeNumber ?? "").toLowerCase()
        );
        const managerRow = viewerById ?? viewerByUser ?? viewerByCode ?? null;
        const managerEmployeeId = managerRow?.id ? strU(managerRow.id) : null;
        const managerDepartmentId = managerRow?.department_id
          ? strU(managerRow.department_id)
          : managerRow?.department_code
          ? strU(managerRow.department_code)
          : managerRow?.department
          ? strU(managerRow.department)
          : null;

        const managedIds = managerEmployeeId
          ? empRows
              .filter((r) => strU(r.manager_id) === managerEmployeeId)
              .map((r) => strU(r.id))
              .filter(Boolean)
          : [];
        const managedByAuthUserIds = empRows
          .filter((r) => strU(r.manager_id) === normalizedAuthUserId)
          .map((r) => strU(r.id))
          .filter(Boolean);

        const managedDepartmentIds = (deptRows ?? [])
          .filter((d) => {
            const depMgr = strU(d.manager_id);
            if (!depMgr) return false;
            return (
              depMgr === String(managerEmployeeId ?? "") ||
              depMgr === String(currentUser.employeeId ?? "") ||
              depMgr === normalizedAuthUserId
            );
          })
          .map((d) => strU(d.id))
          .filter(Boolean);

        if (!cancelled) {
          setDmManagedEmployeeIds(Array.from(new Set([...managedIds, ...managedByAuthUserIds])));
          setDmDepartmentId(managerDepartmentId);
          setDmManagedDepartmentIds(Array.from(new Set(managedDepartmentIds)));
        }

        // Fallback: resolve manager id from DB session directly, then fetch direct reports.
        // This handles cases where local currentUser fields don't match DB ids.
        if ((managedIds.length === 0 || !managerEmployeeId) && !cancelled) {
          try {
            const { data: meId } = await (supabase as unknown as SupabaseRpcClient).rpc(
              "current_employee_id"
            );
            const resolvedManagerId = typeof meId === "string" ? meId : null;
            if (resolvedManagerId) {
              const { data: teamRows } = await supabase
                .from("employees")
                .select("id,manager_id")
                .eq("manager_id", resolvedManagerId);
              const teamIds = ((teamRows as unknown as JsonObject[]) ?? [])
                .map((r) => strU(r.id))
                .filter(Boolean);
              if (teamIds.length > 0) {
                setDmManagedEmployeeIds(Array.from(new Set(teamIds)));
              }
            }
          } catch {
            // ignore fallback errors
          }
        }
      } else if (!cancelled) {
        setDmManagedEmployeeIds([]);
        setDmDepartmentId(null);
        setDmManagedDepartmentIds([]);
      }

      if (!cancelled) setDbEmployees(mapped);

      if (!cancelled && employeesQueryError) {
        setEmployeesDebugMessage(`Could not load employees from database: ${employeesQueryError}`);
      } else if (!cancelled && currentUser.role === "DEPARTMENT_MANAGER" && mapped.length <= 1) {
        setEmployeesDebugMessage(
          "Department Manager can currently see only own/no employee rows from database. This is usually caused by RLS policy scope or login session mismatch."
        );
      }
      if (!cancelled) setLoadingEmployees(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser.role, currentUser.id, currentUser.employeeId, currentUser.employeeNumber]);

  const canManageEmployees =
    currentUser.role === "SUPER_ADMIN" ||
    currentUser.role === "HR_ADMIN" ||
    currentUser.role === "HR_MANAGER" ||
    currentUser.role === "HR_STAFF";

  const allDepartments = useMemo(() => {
    const merged = [
      ...departments.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        managerId: d.managerId,
      })),
      ...dbDepartments,
    ];
    const byKey = new Map<string, { id: string; name: string; code?: string; managerId?: string | null }>();
    for (const d of merged) {
      const key = `${String(d.id)}::${String(d.code ?? "")}::${String(d.name).toLowerCase()}`;
      if (!byKey.has(key)) byKey.set(key, d);
    }
    return Array.from(byKey.values());
  }, [dbDepartments]);

  const findDepartmentName = useCallback((departmentIdOrCode: string) => {
    const normalized = String(departmentIdOrCode ?? "").trim().toLowerCase();
    if (!normalized) return "—";
    const match =
      allDepartments.find((d) => String(d.id).trim().toLowerCase() === normalized) ??
      allDepartments.find((d) => d.code && String(d.code).trim().toLowerCase() === normalized) ??
      allDepartments.find((d) => String(d.name).trim().toLowerCase() === normalized);
    return match?.name ?? (departmentIdOrCode ? String(departmentIdOrCode) : "—");
  }, [allDepartments]);

  const allEmployees = useMemo(() => {
    const useDbOnly = isSupabaseAuthConfigured();
    let base: Employee[] = [];
    if (useDbOnly) {
      // DB-integrated mode: use only records loaded from Supabase.
      base = [...dbEmployees];
    } else {
      // Demo/local mode: keep existing mock + local behavior.
      const overrides = loadEmployeeOverrides();
      const source = [...employees, ...addedEmployees];
      base = source.map((e) =>
        overrides[e.id] ? ({ ...e, ...overrides[e.id] } as Employee) : e
      );
    }
    // Department managers should see employees they manage; if manager links are not yet set,
    // fall back to same department visibility.
    if (currentUser.role === "DEPARTMENT_MANAGER") {
      const directReports = base.filter((e) => dmManagedEmployeeIds.includes(e.id));
      if (directReports.length > 0) return directReports;
      if (dmManagedDepartmentIds.length > 0) {
        const managedDeptNames = new Set(
          dmManagedDepartmentIds.map((id) => findDepartmentName(id).toLowerCase())
        );
        const viaManagedDepartments = base.filter(
          (e) =>
            (dmManagedDepartmentIds.includes(e.departmentId) ||
              managedDeptNames.has(findDepartmentName(e.departmentId).toLowerCase())) &&
            e.id !== currentUser.employeeId
        );
        if (viaManagedDepartments.length > 0) return viaManagedDepartments;
      }
      if (dmDepartmentId) {
        const managerDeptName = findDepartmentName(dmDepartmentId).toLowerCase();
        const sameDeptByResolvedManager = base.filter(
          (e) =>
            (e.departmentId === dmDepartmentId ||
              findDepartmentName(e.departmentId).toLowerCase() === managerDeptName) &&
            e.id !== currentUser.employeeId
        );
        if (sameDeptByResolvedManager.length > 0) return sameDeptByResolvedManager;
      }
      const currentDeptName = findDepartmentName(currentUser.departmentId).toLowerCase();
      const sameAsCurrentDept = base.filter(
        (e) =>
          (e.departmentId === currentUser.departmentId ||
            findDepartmentName(e.departmentId).toLowerCase() === currentDeptName) &&
          e.id !== currentUser.employeeId
      );
      if (sameAsCurrentDept.length > 0) return sameAsCurrentDept;

      // Final fallback for mixed UUID/mock department keys:
      // infer managed department from title (e.g. "Information Technology Department Manager").
      const titleDeptHint = currentUser.jobTitle
        .replace(/department manager/gi, "")
        .replace(/manager/gi, "")
        .trim()
        .toLowerCase();
      if (titleDeptHint) {
        const fromTitleHint = base.filter(
          (e) =>
            findDepartmentName(e.departmentId).toLowerCase().includes(titleDeptHint) &&
            e.id !== currentUser.employeeId
        );
        if (fromTitleHint.length > 0) return fromTitleHint;
      }

      // Last safety fallback: show all currently visible DB rows except self.
      // This prevents false-empty screens when role/ID mapping is inconsistent
      // but RLS already returned subordinate rows.
      return base.filter((e) => e.id !== currentUser.employeeId);
    }
    return base;
  }, [
    addedEmployees,
    currentUser.role,
    currentUser.employeeId,
    currentUser.departmentId,
    currentUser.jobTitle,
    dbEmployees,
    dmManagedEmployeeIds,
    dmDepartmentId,
    dmManagedDepartmentIds,
    findDepartmentName,
  ]);

  const isEmployeeView = currentUser.role === "EMPLOYEE";
  const isRecordsView = !isEmployeeView;

  const filtered = useMemo(() => {
    let base =
      departmentFilter === "all"
        ? allEmployees
        : allEmployees.filter((e) => e.departmentId === departmentFilter);

    if (statusFilter !== "all") {
      base = base.filter((e) => {
        const raw = String(e.employmentStatus ?? "").toUpperCase();
        if (statusFilter === "ACTIVE") return raw === "ACTIVE";
        if (statusFilter === "PRE_HIRE") return raw === "ONBOARDING" || raw === "PRE_HIRE";
        if (statusFilter === "TERMINATED") return raw === "OFFBOARDED" || raw === "TERMINATED";
        if (statusFilter === "INACTIVE") return raw === "INACTIVE";
        return true;
      });
    }

    if (!debouncedSearch.trim()) return base;
    const q = debouncedSearch.toLowerCase();
    return base.filter((e) => {
      const deptName = findDepartmentName(e.departmentId).toLowerCase();
      const matchName = e.firstName.toLowerCase().includes(q) || e.lastName.toLowerCase().includes(q);
      const matchDept = deptName.includes(q);
      if (currentUser.role === "EMPLOYEE") {
        return matchName || matchDept;
      }
      return (
        matchName ||
        e.email.toLowerCase().includes(q) ||
        e.employeeNumber.toLowerCase().includes(q) ||
        matchDept
      );
    });
  }, [debouncedSearch, allEmployees, currentUser.role, departmentFilter, statusFilter, findDepartmentName]);

  const {
    paginatedItems: paginatedEmployees,
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    totalItems,
    canGoNext,
    canGoPrev,
    setPage,
    nextPage,
    prevPage,
    resetPage,
  } = usePagination(filtered, { pageSize: 20 });

  useEffect(() => {
    resetPage();
  }, [debouncedSearch, departmentFilter, statusFilter, resetPage]);

  const handleExport = () => {
    const headers = ["Employee #", "First name", "Last name", "Email", "Department", "Job title", "Employment type", "Status"];
    const rows = filtered.map((emp) => {
      const deptName = findDepartmentName(emp.departmentId);
      const typeLabel = emp.employmentType ? emp.employmentType.replace(/_/g, " ") : "";
      return [
        emp.employeeNumber,
        emp.firstName,
        emp.lastName,
        emp.email,
        deptName,
        emp.jobTitle,
        typeLabel,
        emp.employmentStatus,
      ];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `employees-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const headerTitle =
    currentUser.role === "HR_STAFF" ||
    currentUser.role === "HR_ADMIN" ||
    currentUser.role === "HR_MANAGER" ||
    currentUser.role === "DEPARTMENT_MANAGER" ||
    currentUser.role === "AUDITOR" ||
    currentUser.role === "EXECUTIVE" ||
    isEmployeeView
      ? "Employees"
      : "Employee Records";
  const useEmployeeLikeHeader =
    currentUser.role === "EMPLOYEE" ||
    currentUser.role === "HR_STAFF" ||
    currentUser.role === "HR_ADMIN" ||
    currentUser.role === "HR_MANAGER" ||
    currentUser.role === "DEPARTMENT_MANAGER" ||
    currentUser.role === "AUDITOR" ||
    currentUser.role === "EXECUTIVE";
  const managerNameById = useMemo(
    () =>
      new Map(
        allEmployees.map((e) => [e.id, `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim() || e.employeeNumber])
      ),
    [allEmployees]
  );

  const formatStatusLabel = (status: string) => {
    const raw = String(status ?? "").toUpperCase();
    if (raw === "ACTIVE") return "Active";
    if (raw === "ONBOARDING" || raw === "PRE_HIRE") return "Pre-Hire";
    if (raw === "OFFBOARDED" || raw === "TERMINATED") return "Terminated";
    if (raw === "INACTIVE") return "Inactive";
    return "Inactive";
  };

  const statusBadgeClass = (status: string) => {
    const raw = String(status ?? "").toUpperCase();
    if (raw === "ACTIVE") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    if (raw === "ONBOARDING" || raw === "PRE_HIRE")
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    if (raw === "OFFBOARDED" || raw === "TERMINATED")
      return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
    return "bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200";
  };
  const recordsHeadClass =
    currentUser.role === "HR_STAFF"
      ? "h-10 py-2 font-semibold text-[#192853] text-xs uppercase tracking-[0.06em] text-center"
      : "font-semibold text-[#192853] text-xs uppercase tracking-[0.06em] text-center";
  const recordsHeadNameClass =
    currentUser.role === "HR_STAFF"
      ? "h-10 py-2 font-semibold text-[#192853] text-xs uppercase tracking-[0.06em] text-center"
      : "font-semibold text-[#192853] text-xs uppercase tracking-[0.06em] text-center";

  return (
    <div className="min-w-0 w-full max-w-full flex flex-col gap-4">
      {/* Employees topbar + navbar (mirrors Workflow Requests layout) */}
      <div className={currentUser.role === "HR_ADMIN" || currentUser.role === "HR_MANAGER" || currentUser.role === "DEPARTMENT_MANAGER" || currentUser.role === "AUDITOR" || currentUser.role === "EXECUTIVE" ? "contents" : "min-w-0 space-y-3"}>
        {useEmployeeLikeHeader ? (
          <div className="flex flex-col gap-6">
            <EmployeeModuleTopbar searchPlaceholder="Search" />
            <EmployeeSectionHeader
              title={headerTitle}
              tabs={[{ id: "records", label: headerTitle }]}
              activeTab="records"
              onTabChange={() => {}}
            />
          </div>
        ) : (
          <>
            <DashboardSectionTopBar
              breadcrumb={
                <>
                  <span className="truncate font-semibold">Employees</span>
                  <span className="shrink-0 opacity-70">&gt;</span>
                  <span className="truncate font-semibold text-foreground">{headerTitle}</span>
                </>
              }
              searchPlaceholder={
                isEmployeeView
                  ? "Search by name or department..."
                  : "Search by name, email, or department..."
              }
              searchInputProps={{
                value: search,
                onChange: (e) => setSearch(e.target.value),
              }}
            />

            {/* Navbar tabs for Employees */}
            <div className="border-b border-border/70">
              <div className="-mx-1 flex gap-1 overflow-x-auto py-1 [scrollbar-width:thin] sm:gap-6 lg:gap-8 [&::-webkit-scrollbar]:h-1.5">
                <button
                  type="button"
                  className="relative flex shrink-0 items-center gap-2 whitespace-nowrap pb-3 -mb-px px-2 text-sm transition-colors text-primary font-medium sm:text-base"
                >
                  <User className="size-4 shrink-0" />
                  <span>{headerTitle}</span>
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left bg-primary transition-transform duration-200 scale-x-100" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Filters row below topbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by employee name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {!isEmployeeView && (
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="flex h-10 rounded-xl border border-input bg-background text-foreground px-3 py-1 text-sm"
            >
              <option value="all">All departments</option>
              {allDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex h-10 rounded-xl border border-input bg-background text-foreground px-3 py-1 text-sm"
            >
              <option value="all">All status</option>
              <option value="ACTIVE">Active</option>
              <option value="PRE_HIRE">Pre-Hire</option>
              <option value="TERMINATED">Terminated</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="size-4 mr-2" />
              Export
            </Button>
            {canManageEmployees && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="size-4 mr-2" />
                    Add Employee
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-hide">
                  <DialogHeader>
                    <DialogTitle>Add Employee</DialogTitle>
                    <DialogDescription>
                      Create a new employee record. This will be wired to the API later.
                    </DialogDescription>
                  </DialogHeader>
                  <AddEmployeeForm
                    addedEmployees={addedEmployees}
                    onAdd={(employee) => {
                      const next = [...addedEmployees, employee];
                      setAddedEmployees(next);
                      saveAddedEmployees(next);
                      try {
                        localStorage.removeItem(ADD_EMPLOYEE_PHOTO_KEY);
                      } catch {
                        // ignore
                      }
                    }}
                    onSuccess={() => setOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>
        )}
      </div>

      {employeesDebugMessage ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {employeesDebugMessage}
        </div>
      ) : null}

      <div className="rounded-2xl border border-border/80 bg-card shadow-sm max-h-[70vh] overflow-y-auto scrollbar-hide">
        <Table>
          <TableHeader>
            <TableRow
              className={
                isEmployeeView
                  ? undefined
                  : `sticky top-0 z-10 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/85 shadow-[0_1px_0_0_var(--border)] ${
                      "h-10"
                    }`
              }
            >
              {isEmployeeView ? (
                <>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Job Title</TableHead>
                </>
              ) : (
                <>
                  <TableHead className={recordsHeadClass}>
                    Employee ID
                  </TableHead>
                  <TableHead className={recordsHeadNameClass}>
                    Name
                  </TableHead>
                  <TableHead className={recordsHeadClass}>
                    Department
                  </TableHead>
                  <TableHead className={recordsHeadClass}>
                    Position
                  </TableHead>
                  <TableHead className={recordsHeadClass}>
                    Employment Type
                  </TableHead>
                  <TableHead className={recordsHeadClass}>
                    Status
                  </TableHead>
                  <TableHead className={recordsHeadClass}>
                    Manager
                  </TableHead>
                  <TableHead className={recordsHeadClass}>
                    Hire Date
                  </TableHead>
                  <TableHead className={`w-[120px] ${recordsHeadClass}`}>
                    Actions
                  </TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingEmployees ? (
              <TableSkeletonRows
                columns={isEmployeeView ? 3 : 9}
                prefix="employees-sk"
              />
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isEmployeeView ? 3 : 9} className="text-center text-muted-foreground py-10">
                  No employee records found
                </TableCell>
              </TableRow>
            ) : (
              paginatedEmployees.map((emp) => {
                const deptName = findDepartmentName(emp.departmentId);
                const managerName = emp.managerId ? managerNameById.get(emp.managerId) ?? "Unassigned" : "Unassigned";
                return (
                  <TableRow
                    key={emp.id}
                    className="cursor-pointer transition-colors hover:bg-muted/40"
                    onClick={() => {
                      window.location.assign(`/employees/${emp.id}`);
                    }}
                  >
                    {isEmployeeView ? (
                      <>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="relative flex size-9 shrink-0 overflow-hidden rounded-full bg-muted">
                              {emp.profilePhoto ? (
                                <Image
                                  src={emp.profilePhoto}
                                  alt=""
                                  fill
                                  className="object-cover"
                                  sizes="36px"
                                  unoptimized={emp.profilePhoto.startsWith("data:")}
                                />
                              ) : (
                                <div className="flex size-full items-center justify-center">
                                  <User className="size-4 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div>
                              <span className="font-medium">
                                {emp.firstName} {emp.lastName}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{deptName}</TableCell>
                        <TableCell>{emp.jobTitle}</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="text-center">{emp.employeeNumber}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="relative flex size-9 shrink-0 overflow-hidden rounded-full bg-muted">
                              {emp.profilePhoto ? (
                                <Image
                                  src={emp.profilePhoto}
                                  alt=""
                                  fill
                                  className="object-cover"
                                  sizes="36px"
                                  unoptimized={emp.profilePhoto.startsWith("data:")}
                                />
                              ) : (
                                <div className="flex size-full items-center justify-center">
                                  <User className="size-4 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div>
                              <span className="font-medium">
                                {emp.firstName} {emp.lastName}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{deptName}</TableCell>
                        <TableCell className="text-center">{emp.jobTitle}</TableCell>
                        <TableCell className="text-center">
                          {emp.employmentType
                            ? emp.employmentType.replace(/_/g, " ")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(emp.employmentStatus)}`}>
                            {formatStatusLabel(emp.employmentStatus)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">{managerName}</TableCell>
                        <TableCell className="text-center">{emp.startDate ?? "—"}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()} className="text-center">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/employees/${emp.id}`}>
                                View Profile
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        startIndex={startIndex}
        endIndex={endIndex}
        canGoNext={canGoNext}
        canGoPrev={canGoPrev}
        onPageChange={setPage}
        onNext={nextPage}
        onPrev={prevPage}
        itemLabel="employees"
      />
    </div>
  );
}

function AddEmployeeForm({
  addedEmployees,
  onAdd,
  onSuccess,
}: {
  addedEmployees: Employee[];
  onAdd: (employee: Employee) => void;
  onSuccess: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(ADD_EMPLOYEE_PHOTO_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState("");
  const [currentAddress, setCurrentAddress] = useState("");
  const [personalPhone, setPersonalPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [employmentType, setEmploymentType] =
    useState<EmploymentType>("FULL_TIME");
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");

  const handleUploadPhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setProfilePhoto(dataUrl);
      try {
        localStorage.setItem(ADD_EMPLOYEE_PHOTO_KEY, dataUrl);
      } catch {
        // ignore
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const allExisting = [...employees, ...addedEmployees];
        const nextNum = nextEmployeeNumber(allExisting);
        const id = "emp-added-" + Date.now();
        const newEmployee: Employee = {
          id,
          employeeNumber: nextNum,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          departmentId,
          jobTitle: jobTitle.trim() || "Staff",
          managerId: null,
          employmentStatus: "ACTIVE",
          startDate: new Date().toISOString().slice(0, 10),
          role: "EMPLOYEE",
          employmentType,
          birthday: birthday.trim() || undefined,
          currentAddress: currentAddress.trim() || undefined,
          personalPhone: personalPhone.trim() || undefined,
          profilePhoto: profilePhoto || undefined,
        };
        onAdd(newEmployee);
        setFirstName("");
        setLastName("");
        setEmail("");
        setBirthday("");
        setCurrentAddress("");
        setPersonalPhone("");
        setProfilePhoto("");
        setJobTitle("");
        setEmploymentType("FULL_TIME");
        setDepartmentId(departments[0]?.id ?? "");
        onSuccess();
      }}
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div className="space-y-1.5">
          <Label>First name</Label>
          <Input
            placeholder="First name"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Last name</Label>
          <Input
            placeholder="Last name"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input
            type="email"
            placeholder="email@company.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Job title</Label>
          <Input
            placeholder="e.g. Staff, Analyst"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Birthday</Label>
          <Input
            type="date"
            placeholder="YYYY-MM-DD"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Personal phone</Label>
          <PhoneInput value={personalPhone} onChange={setPersonalPhone} />
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label>Current address</Label>
          <AddressAutocomplete
            placeholder="Start typing address or location..."
            value={currentAddress}
            onChange={setCurrentAddress}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Employment type</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm"
            value={employmentType}
            onChange={(e) =>
              setEmploymentType(e.target.value as EmploymentType)
            }
          >
            {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Department</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 col-span-2 flex flex-col">
          <Label>Profile photo</Label>
          <div className="flex items-center gap-3">
            <div className="relative flex size-12 shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-border">
              {profilePhoto ? (
                <Image
                  src={profilePhoto}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="48px"
                  unoptimized={profilePhoto.startsWith("data:")}
                />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <User className="size-6 text-muted-foreground" />
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoFileChange}
              aria-label="Upload profile photo"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUploadPhotoClick}
            >
              <Upload className="size-4 mr-2" />
              Upload photo
            </Button>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button type="submit">Create employee</Button>
      </DialogFooter>
    </form>
  );
}
