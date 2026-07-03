import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type JsonObject = Record<string, unknown>;

function getServerSupabaseWithToken(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !anon) return null;
  return createClient(url, anon, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceRole) return null;
  return createClient(url, serviceRole);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
  }

  const supabase = getServerSupabaseWithToken(token);
  if (!supabase) {
    return NextResponse.json({ error: "Supabase env is not configured." }, { status: 500 });
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get("pageSize") ?? "50", 10) || 50));
  const searchQuery = req.nextUrl.searchParams.get("search")?.trim() ?? "";

  const departmentId = req.nextUrl.searchParams.get("departmentId");
  const includeAuthEmail = req.nextUrl.searchParams.get("includeAuthEmail") === "1";
  let selectCols = [
    "id",
    "user_id",
    "department_id",
    "position",
    "employment_type",
    "employment_status",
    "manager_id",
    "employee_code",
    "employee_number",
    "portal_role",
    "role",
  ];
  let rows: JsonObject[] | null = null;
  let employeesError: string | null = null;
  let totalCount: number | null = null;

  for (let i = 0; i < 8; i++) {
    let query = supabase.from("employees").select(selectCols.join(", "), { count: "exact" }).order("position", { ascending: true }).range((page - 1) * pageSize, page * pageSize - 1);
    if (departmentId) {
      query = query.eq("department_id", departmentId);
    }
    const { data, error, count } = await query;
    if (!error) {
      rows = (data as JsonObject[]) ?? [];
      totalCount = count ?? null;
      employeesError = null;
      break;
    }
    const missingColumn = error.message.match(/column employees\.([a-zA-Z0-9_]+) does not exist/i)?.[1];
    if (!missingColumn) {
      employeesError = error.message;
      break;
    }
    selectCols = selectCols.filter((c) => c !== missingColumn);
    if (selectCols.length === 0) {
      employeesError = error.message;
      break;
    }
  }

  if (employeesError) {
    return NextResponse.json({ error: employeesError }, { status: 400 });
  }

  const userIds = Array.from(
    new Set(
      ((rows as JsonObject[]) ?? [])
        .map((r) => String(r?.user_id ?? ""))
        .filter((v) => v.length > 0)
    )
  );

  const profileByUser = new Map<string, JsonObject>();
  if (userIds.length > 0) {
    let profileCols = [
      "user_id",
      "first_name",
      "last_name",
      "email",
      "birthday",
      "phone",
      "personal_phone",
      "current_address",
      "avatar_url",
    ];
    let profiles: JsonObject[] | null = null;
    let profilesErrorMessage: string | null = null;
    for (let i = 0; i < 8; i++) {
      const { data, error } = await supabase
        .from("profiles")
        .select(profileCols.join(", "))
        .in("user_id", userIds);
      if (!error) {
        profiles = (data as JsonObject[]) ?? [];
        profilesErrorMessage = null;
        break;
      }
      const missingColumn = error.message.match(/column profiles\.([a-zA-Z0-9_]+) does not exist/i)?.[1];
      if (!missingColumn) {
        profilesErrorMessage = error.message;
        break;
      }
      profileCols = profileCols.filter((c) => c !== missingColumn);
      if (profileCols.length === 0) {
        profilesErrorMessage = error.message;
        break;
      }
    }
    if (profilesErrorMessage) {
      return NextResponse.json({ error: profilesErrorMessage }, { status: 400 });
    }
    for (const p of (profiles as JsonObject[]) ?? []) {
      if (!p?.user_id) continue;
      profileByUser.set(String(p.user_id), p);
    }
  }

  // Optional email enrichment from Authentication (auth.users).
  // We only enrich rows already visible via RLS from the user-scoped employees query above.
  const authEmailByUser = new Map<string, string>();
  const missingEmailUserIds = ((rows as JsonObject[]) ?? [])
    .map((r) => String(r?.user_id ?? ""))
    .filter((uid) => uid.length > 0)
    .filter((uid) => {
      const p = profileByUser.get(uid);
      const profileEmail = String(p?.email ?? "").trim();
      return !profileEmail;
    });
  if (includeAuthEmail && missingEmailUserIds.length > 0) {
    const serviceSupabase = getServiceSupabase();
    if (serviceSupabase) {
      const uniqueMissing = Array.from(new Set(missingEmailUserIds));
      for (const uid of uniqueMissing) {
        try {
          const { data, error } = await serviceSupabase.auth.admin.getUserById(uid);
          if (!error) {
            const email = String(data?.user?.email ?? "").trim();
            if (email) authEmailByUser.set(uid, email);
          }
        } catch {
          // Ignore per-user auth lookup failures; row remains without work email.
        }
      }
    }
  }

  const employees = ((rows as JsonObject[]) ?? []).map((row) => {
    const profile = row.user_id ? profileByUser.get(String(row.user_id)) : undefined;
    return {
      id: String(row.id),
      employeeNumber: String(row.employee_code ?? row.employee_number ?? ""),
      firstName: String(profile?.first_name ?? ""),
      lastName: String(profile?.last_name ?? ""),
      email: String(profile?.email ?? authEmailByUser.get(String(row.user_id ?? "")) ?? ""),
      departmentId: String(row.department_id ?? ""),
      jobTitle: String(row.position ?? ""),
      managerId: row.manager_id ? String(row.manager_id) : null,
      employmentStatus: String(row.employment_status ?? "ACTIVE").toUpperCase(),
      employmentType: String(row.employment_type ?? "FULL_TIME").toUpperCase().replace(/\s+/g, "_"),
      role: String(row.portal_role ?? row.role ?? "EMPLOYEE").toUpperCase(),
      birthday: profile?.birthday ? String(profile.birthday) : undefined,
      currentAddress: profile?.current_address ? String(profile.current_address) : undefined,
      personalPhone: profile?.personal_phone
        ? String(profile.personal_phone)
        : profile?.phone
        ? String(profile.phone)
        : undefined,
      profilePhoto: profile?.avatar_url ? String(profile.avatar_url) : undefined,
      startDate: new Date().toISOString().slice(0, 10),
    };
  });

  const total = totalCount ?? employees.length;
  const response = NextResponse.json({
    employees,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
    debug: {
      authUserId: authUser?.id ?? null,
      rowsCount: employees.length,
    },
  });
  response.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
  return response;
}

