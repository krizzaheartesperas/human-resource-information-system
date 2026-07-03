import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Role } from "@/lib/mock";

function getServerSupabaseWithToken(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !anon) return null;
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceRole) return null;
  return createClient(url, serviceRole);
}

function normalizeRole(raw: unknown): Role | null {
  const v = String(raw ?? "").trim().toUpperCase();
  const allowed: Role[] = [
    "SUPER_ADMIN",
    "HR_ADMIN",
    "HR_MANAGER",
    "HR_STAFF",
    "DEPARTMENT_MANAGER",
    "MANAGER",
    "EMPLOYEE",
    "AUDITOR",
    "EXECUTIVE",
    "BOARD",
  ];
  return (allowed as string[]).includes(v) ? (v as Role) : null;
}

function normalizeEmploymentStatus(raw: unknown): "ACTIVE" | "ONBOARDING" | "OFFBOARDED" | null {
  const v = String(raw ?? "").trim().toUpperCase();
  return v === "ACTIVE" || v === "ONBOARDING" || v === "OFFBOARDED" ? v : null;
}

async function isRequesterSystemAdmin(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return false;
  // RLS should allow the requester to see their own employee row.
  const { data, error } = await supabase
    .from("employees")
    .select("portal_role, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) return false;
  const row = data as { portal_role?: unknown; role?: unknown };
  const role = String(row.portal_role ?? row.role ?? "").toUpperCase();
  return role === "SUPER_ADMIN";
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
  }

  const supabase = getServerSupabaseWithToken(token);
  if (!supabase) {
    return NextResponse.json({ error: "Supabase env is not configured." }, { status: 500 });
  }

  const ok = await isRequesterSystemAdmin(supabase);
  if (!ok) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as null | {
    role?: unknown;
    employmentStatus?: unknown;
    authAction?: unknown;
  };
  const nextRole = typeof body?.role === "undefined" ? null : normalizeRole(body?.role);
  const nextStatus =
    typeof body?.employmentStatus === "undefined"
      ? null
      : normalizeEmploymentStatus(body?.employmentStatus);
  const authActionRaw = String(body?.authAction ?? "").trim().toLowerCase();
  const authAction =
    authActionRaw === "disable" || authActionRaw === "enable" || authActionRaw === "delete"
      ? authActionRaw
      : null;

  if (!nextRole && !nextStatus && !authAction) {
    return NextResponse.json({ error: "No valid updates provided." }, { status: 400 });
  }
  if (typeof body?.role !== "undefined" && !nextRole) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }
  if (typeof body?.employmentStatus !== "undefined" && !nextStatus) {
    return NextResponse.json({ error: "Invalid employment status." }, { status: 400 });
  }
  if (body?.authAction && !authAction) {
    return NextResponse.json({ error: "Invalid auth action." }, { status: 400 });
  }

  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json(
      { error: "Supabase service key is not configured." },
      { status: 500 }
    );
  }

  let updateError: string | null = null;

  if (nextRole) {
    // Prefer `portal_role`, fallback to `role` if the schema doesn't have it.
    for (const col of ["portal_role", "role"] as const) {
      const { error } = await service.from("employees").update({ [col]: nextRole }).eq("id", id);
      if (!error) {
        updateError = null;
        break;
      }
      const missingColumn = error.message.match(/column employees\.([a-zA-Z0-9_]+) does not exist/i)?.[1];
      if (missingColumn && missingColumn === col) continue;
      updateError = error.message;
      break;
    }
  }

  if (!updateError && nextStatus) {
    const { error } = await service
      .from("employees")
      .update({ employment_status: nextStatus })
      .eq("id", id);
    if (error) {
      const missingColumn = error.message.match(/column employees\.([a-zA-Z0-9_]+) does not exist/i)?.[1];
      if (!missingColumn || missingColumn !== "employment_status") {
        updateError = error.message;
      }
    }
  }

  if (!updateError && authAction) {
    const { data, error } = await service
      .from("employees")
      .select("user_id")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      updateError = error.message;
    } else {
      const userId = String((data as { user_id?: unknown } | null)?.user_id ?? "").trim();
      if (!userId) {
        updateError = "Employee has no linked auth user_id.";
      } else if (authAction === "delete") {
        const { error: delErr } = await service.auth.admin.deleteUser(userId);
        if (delErr) updateError = delErr.message;
      } else {
        const banDuration = authAction === "disable" ? "876000h" : "none";
        const { error: updErr } = await service.auth.admin.updateUserById(userId, {
          ban_duration: banDuration,
        });
        if (updErr) updateError = updErr.message;
      }
    }
  }

  if (updateError) {
    return NextResponse.json({ error: updateError }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
