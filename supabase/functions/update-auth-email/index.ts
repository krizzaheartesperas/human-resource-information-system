// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// TypeScript in your local editor may not include Deno globals types.
// Supabase Edge Functions runs in Deno, so this is safe for the actual runtime.
declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response>) => void;
  env: { get: (key: string) => string | undefined };
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FUNCTION_VERSION = "portal_role_lookup_v2";

function jsonResponse(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...(init ?? {}),
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
      ...corsHeaders,
    },
  });
}

function normalizeRoleToken(raw: unknown): string {
  return String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "_");
}

function inferCallerRole(role: unknown, position: unknown, jobTitle: unknown): string {
  const roleToken = normalizeRoleToken(role);
  const pos = String(position ?? "").toLowerCase();
  const job = String(jobTitle ?? "").toLowerCase();

  // Role column sometimes uses aliases (e.g. HR_ADMINISTRATOR vs HR_ADMIN).
  if (roleToken === "HR_ADMIN" || roleToken === "HRADMIN" || roleToken === "HR_ADMINISTRATOR" || roleToken.includes("HR_ADMIN")) {
    return "HR_ADMIN";
  }
  if (roleToken === "SUPER_ADMIN" || roleToken === "SUPERADMIN") return "SUPER_ADMIN";
  if (roleToken === "EXECUTIVE" || roleToken === "CEO") return "EXECUTIVE";

  // Best-effort fallback when `role` column is empty and title/position is used.
  if (pos.includes("hr admin") || pos.includes("hr administrator") || job.includes("hr admin") || job.includes("hr administrator")) {
    return "HR_ADMIN";
  }
  if (pos.includes("ceo") || pos.includes("chief executive") || pos.includes("executive") || job.includes("executive")) {
    return "EXECUTIVE";
  }
  if (pos.includes("system admin") || pos.includes("super admin") || job.includes("system admin") || job.includes("super admin")) {
    return "SUPER_ADMIN";
  }

  return roleToken || "UNKNOWN";
}

async function resolveCallerEmployeeDebug(
  supabaseAdmin: ReturnType<typeof createClient>,
  callerAuthUser: { id: string; email?: string | null }
): Promise<{
  employee: Record<string, unknown> | null;
  debug: {
    callerId: string;
    eqFound: boolean;
    eqError: string | null;
    scanFound: boolean;
    scanError: string | null;
  };
}> {
  // Current schema (from your query screenshot) uses:
  // - `user_id` (uuid) to link to auth.users.id
  // - `portal_role` (text) as the app role
  // - `position` for title/backup inference
  const callerId = String(callerAuthUser.id);
  const debug = {
    callerId,
    eqFound: false,
    eqError: null as string | null,
    scanFound: false,
    scanError: null as string | null,
  };
  try {
    const { data, error } = await supabaseAdmin
      .from("employees")
      .select("id,portal_role,position,user_id")
      .eq("user_id", callerId)
      .maybeSingle();
    if (error) {
      debug.eqError = error.message;
    } else if (data) {
      debug.eqFound = true;
      return { employee: data as Record<string, unknown>, debug };
    }
  } catch {
    // ignore
  }

  // Fallback: scan and match by string to avoid uuid casting surprises.
  try {
    const { data: rows } = await supabaseAdmin
      .from("employees")
      .select("id,portal_role,position,user_id")
      .limit(5000);
    const match = rows?.find((r: any) => r?.user_id !== null && r?.user_id !== undefined && String(r.user_id) === callerId);
    if (match) {
      debug.scanFound = true;
      return { employee: match as Record<string, unknown>, debug };
    }
  } catch {
    // ignore
    // note: keep scanError null; without access to error message
  }

  return { employee: null, debug };
}

function resolveCallerRoleFromAuthMetadata(callerAuthUser: any): string | null {
  const md = callerAuthUser?.user_metadata ?? {};
  const appMd = callerAuthUser?.app_metadata ?? {};

  const roleLike =
    (typeof md?.role === "string" ? md.role : null) ||
    (typeof md?.app_role === "string" ? md.app_role : null) ||
    (typeof md?.employment_role === "string" ? md.employment_role : null) ||
    (typeof appMd?.role === "string" ? appMd.role : null) ||
    (typeof appMd?.app_role === "string" ? appMd.app_role : null) ||
    (typeof appMd?.employment_role === "string" ? appMd.employment_role : null);

  // Position/job_title metadata fallback (best effort).
  const positionLike =
    (typeof md?.position === "string" ? md.position : null) ||
    (typeof md?.job_title === "string" ? md.job_title : null) ||
    (typeof appMd?.position === "string" ? appMd.position : null) ||
    (typeof appMd?.job_title === "string" ? appMd.job_title : null);

  const inferred = inferCallerRole(roleLike ?? null, positionLike ?? null, positionLike ?? null);
  if (inferred !== "UNKNOWN") return inferred;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return jsonResponse({ error: "Missing Authorization bearer token." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const userId = body?.userId as string | undefined;
    const newEmail = body?.newEmail as string | undefined;
    if (!userId || !newEmail) {
      return jsonResponse({ error: "Missing userId or newEmail." }, { status: 400 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Create a client that includes the caller JWT so DB helper functions that depend on `auth.uid()`
    // (used by `public.current_employee_role()`) can resolve the caller.
    const supabaseAsCaller = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // Identify caller
    const { data: callerData, error: callerErr } = await supabaseAdmin.auth.getUser(token);
    const callerAuthUser = callerData?.user;
    if (callerErr || !callerAuthUser) {
      return jsonResponse({ error: callerErr?.message ?? "Unauthorized." }, { status: 401 });
    }

    // Resolve caller role from employees row (best effort).
    const { employee: emp, debug: employeeDebug } = await resolveCallerEmployeeDebug(supabaseAdmin, {
      id: callerAuthUser.id,
      email: callerAuthUser.email,
    });

    // Prefer DB helper: it already uses `auth.uid()` and maps to employees.role safely.
    let callerRoleFromDb: string | null = null;
    try {
      const { data, error } = await supabaseAsCaller.rpc("current_employee_role");
      if (!error && typeof data === "string") callerRoleFromDb = data;
    } catch {
      // ignore
    }

    const callerRole =
      callerRoleFromDb ||
      inferCallerRole(emp?.portal_role, emp?.position, emp?.position) ||
      resolveCallerRoleFromAuthMetadata(callerAuthUser) ||
      "UNKNOWN";

    const allowed = new Set(["HR_ADMIN", "SUPER_ADMIN", "EXECUTIVE"]);
    if (!allowed.has(callerRole)) {
      return jsonResponse(
        {
          error: `Forbidden: caller role ${callerRole} cannot update auth email.`,
          debug: {
            version: FUNCTION_VERSION,
            callerAuthUserId: callerAuthUser.id,
            callerAuthEmail: callerAuthUser.email ?? null,
            callerRoleFromDb: callerRoleFromDb ?? null,
            callerAuthUserMetadata: {
              user_metadata: callerAuthUser.user_metadata ?? null,
              app_metadata: callerAuthUser.app_metadata ?? null,
            },
            employeeResolved: Boolean(emp),
            employeeRole: emp?.portal_role ?? null,
            employeeJobTitle: emp?.position ?? null,
            employeePosition: emp?.position ?? null,
            employeeDebug,
          },
        },
        { status: 403 }
      );
    }

    // Update auth.users email (admin API via service role).
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email: newEmail,
    });

    if (updateErr) {
      return jsonResponse({ error: updateErr.message ?? "Failed to update auth email." }, { status: 400 });
    }

    return jsonResponse({ ok: true, version: FUNCTION_VERSION });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
});

