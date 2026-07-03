import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

  const { data, error } = await supabase
    .from("departments")
    .select("id,name,department_code,manager_id")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const departments = ((data as any[]) ?? []).map((d) => ({
    id: String(d.id),
    name: String(d.name ?? ""),
    code: d?.department_code ? String(d.department_code) : undefined,
    managerId: d?.manager_id ? String(d.manager_id) : null,
  }));

  const response = NextResponse.json({ departments });
  response.headers.set("Cache-Control", "private, max-age=60, stale-while-revalidate=120");
  return response;
}

