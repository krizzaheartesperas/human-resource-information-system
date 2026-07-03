import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { issueSsoTicket } from "@/lib/auth/ssoHandoff";
import { safeNextPath } from "@/lib/auth/safeNextPath";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return NextResponse.json({ error: "Missing authorization token" }, { status: 401 });
  }

  const supabase = createServerSupabaseClient(token);
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const targetSystem = body.system || "hris";
  const next = safeNextPath(body.next);

  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent");

  const result = await issueSsoTicket(user.id, targetSystem, {
    ip,
    userAgent,
    next,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Switch failed" }, { status: 500 });
  }

  const finalRedirect = result.redirectTo || "/dashboard";

  return NextResponse.json({
    ok: true,
    redirectTo: finalRedirect,
  });
}
