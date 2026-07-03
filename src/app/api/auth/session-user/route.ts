import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  normalizeSystemCode,
  pickSystemAccess,
  type SystemAccess,
} from "@/lib/auth/sessionAccess";

type SessionUserResponseBody = Record<string, unknown>;

const SESSION_USER_CACHE_TTL_MS = 60_000;
const sessionUserCache = new Map<
  string,
  { expiresAt: number; body: SessionUserResponseBody }
>();

/**
 * Loads the signed-in user's employee (+ profile) row bypassing RLS.
 * Used when client-side selects return no rows due to strict policies.
 * Only returns data for the JWT subject (auth.getUser).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
  }

  const preferredAccessId = String(req.nextUrl.searchParams.get("accessId") ?? "").trim();
  const preferredSystemCode = normalizeSystemCode(
    req.nextUrl.searchParams.get("system")
  );
  const cacheKey = `${token}|${preferredAccessId}|${preferredSystemCode}`;
  const cached = sessionUserCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.body);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!url || !anonKey) {
    return NextResponse.json({ error: "Supabase URL or anon key missing." }, { status: 500 });
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });
  }

  if (!serviceRole) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not set on the server.", employee: null, profile: null },
      { status: 503 }
    );
  }

  const admin = createClient(url, serviceRole);
  const uid = user.id;

  const [employeeByUserIdResult, profileResult, accessResult] = await Promise.all([
    admin.from("employees").select("id,user_id,employee_code,employee_number,department_id,position,employment_type,employment_status,portal_role,role,manager_id").eq("user_id", uid).maybeSingle(),
    admin.from("profiles").select("user_id,first_name,last_name,email,birthday,phone,personal_phone,current_address,avatar_url").eq("user_id", uid).maybeSingle(),
    admin
      .from("user_system_access")
      .select("id,user_id,system_id,role,status,system_role_id")
      .eq("user_id", uid),
  ]);

  if (employeeByUserIdResult.error) {
    return NextResponse.json({ error: employeeByUserIdResult.error.message }, { status: 400 });
  }

  let employee = employeeByUserIdResult.data;

  if (!employee) {
    const { data: byLegacy, error: err2 } = await admin
      .from("employees")
      .select("id,user_id,employee_code,employee_number,department_id,position,employment_type,employment_status,portal_role,role,manager_id")
      .eq("auth_user_id", uid)
      .maybeSingle();
    if (err2) {
      const msg = err2.message.toLowerCase();
      if (
        !(msg.includes("auth_user_id") && (msg.includes("does not exist") || msg.includes("schema cache")))
      ) {
        return NextResponse.json({ error: err2.message }, { status: 400 });
      }
    } else {
      employee = byLegacy;
    }
  }

  const { data: profile } = profileResult;
  const { data: accessRows, error: accessErr } = accessResult;

  if (accessErr) {
    return NextResponse.json({ error: accessErr.message }, { status: 400 });
  }

  const activeRows = ((accessRows ?? []) as Array<Record<string, unknown>>).filter(
    (row) => String(row.status ?? "").trim().toLowerCase() === "active"
  );
  const systemIds = Array.from(
    new Set(activeRows.map((r) => String(r.system_id ?? "")).filter(Boolean))
  );
  const systemRoleIds = Array.from(
    new Set(activeRows.map((r) => Number(r.system_role_id ?? NaN)).filter((v) => Number.isFinite(v)))
  );

  const [systemsResult, rolesResult] = await Promise.all([
    systemIds.length
      ? admin.from("systems").select("id,code,name").in("id", systemIds)
      : Promise.resolve({ data: [], error: null }),
    systemRoleIds.length
      ? admin.from("system_roles").select("id,code,name,system_id").in("id", systemRoleIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const { data: systemsRows, error: systemsErr } = systemsResult;
  if (systemsErr) {
    return NextResponse.json({ error: systemsErr.message }, { status: 400 });
  }

  const { data: roleRows, error: rolesErr } = rolesResult;
  if (rolesErr) {
    return NextResponse.json({ error: rolesErr.message }, { status: 400 });
  }

  const systemsById = new Map(
    ((systemsRows ?? []) as Array<Record<string, unknown>>).map((s) => [
      String(s.id ?? ""),
      { code: String(s.code ?? ""), name: String(s.name ?? "Unknown System") },
    ])
  );
  const rolesById = new Map(
    ((roleRows ?? []) as Array<Record<string, unknown>>).map((r) => [
      Number(r.id ?? NaN),
      { code: String(r.code ?? ""), name: String(r.name ?? ""), systemId: String(r.system_id ?? "") },
    ])
  );

  const accessibleSystems: SystemAccess[] = activeRows
    .map((row) => {
      const systemId = String(row.system_id ?? "");
      const systemMeta = systemsById.get(systemId);
      const parsedRoleId = Number(row.system_role_id ?? NaN);
      const roleMeta = Number.isFinite(parsedRoleId) ? rolesById.get(parsedRoleId) : undefined;
      const roleCode = String(roleMeta?.code ?? row.role ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_");
      const roleName = String(roleMeta?.name ?? row.role ?? "Employee").trim();
      return {
        id: String(row.id ?? ""),
        userId: String(row.user_id ?? uid),
        systemId,
        systemCode: normalizeSystemCode(systemMeta?.code ?? ""),
        systemName: String(systemMeta?.name ?? "Unknown System"),
        roleCode,
        roleName,
        status: String(row.status ?? "active"),
        systemRoleId: Number.isFinite(parsedRoleId) ? parsedRoleId : null,
      } satisfies SystemAccess;
    })
    .filter((row) => row.id && row.systemId && row.systemCode && row.roleCode);

  const defaultSystem = pickSystemAccess(
    accessibleSystems,
    preferredAccessId,
    preferredSystemCode
  );

  const body = {
    employee: employee ?? null,
    profile: profile ?? null,
    accessibleSystems,
    defaultSystem,
  };

  sessionUserCache.set(cacheKey, {
    expiresAt: Date.now() + SESSION_USER_CACHE_TTL_MS,
    body,
  });

  const response = NextResponse.json(body);
  response.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
  return response;
}
