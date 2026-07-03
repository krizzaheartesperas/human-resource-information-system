import { randomBytes, createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { safeNextPath } from "@/lib/auth/safeNextPath";

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceRole) return null;
  return createClient(url, serviceRole);
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function getSsoTicketTtlMs(): number {
  const raw = Number(process.env.SSO_TICKET_TTL_MS ?? "");
  if (Number.isFinite(raw) && raw >= 60_000) return raw;
  return 15 * 60 * 1000;
}

function getExternalSystemBaseUrl(systemCode: string): string | null {
  const code = systemCode.toLowerCase();
  if (code === "recruitment") {
    return (process.env.NEXT_PUBLIC_RECRUITMENT_URL ?? "").replace(/\/$/, "").trim();
  }
  // Add other systems if they exist
  return null;
}

export async function POST(req: NextRequest) {
  const admin = getServiceSupabase();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "sso_not_configured" }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.split(" ")[1];
  
  let user;
  if (token) {
    const { data: { user: authUser } } = await admin.auth.getUser(token);
    user = authUser;
  } else {
    const { data: { session } } = await admin.auth.getSession();
    user = session?.user;
  }

  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const targetSystem = String(body.targetSystem || "hris");
  const next = safeNextPath(body.next || null);

  const rawTicket = randomBytes(32).toString("hex");
  const hash = sha256Hex(rawTicket);
  const expiresAt = new Date(Date.now() + getSsoTicketTtlMs()).toISOString(); 

  const forwarded = req.headers.get("x-forwarded-for");
  const createdIp = forwarded?.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent");

  // Aligned metadata with teammate's implementation
  const { error: insertErr } = await admin
    .from("sso_handoff_tickets")
    .insert({
      secret_hash: hash,
      user_id: user.id,
      expires_at: expiresAt,
      metadata: {
        created_ip: createdIp,
        user_agent: userAgent,
        target_system: targetSystem,
        issued_by_system: "hris",
        next: next ?? undefined,
      },
    });

  if (insertErr) {
    return NextResponse.json({ ok: false, error: "ticket_creation_failed" }, { status: 500 });
  }

  await admin.from("sso_handoff_audit").insert({
    event: "ticket_issued",
    user_id: user.id,
    ip: createdIp,
    user_agent: userAgent,
    detail: { target_system: targetSystem, expires_at: expiresAt },
  });

  // Build the full redirectTo URL on the server (similar to teammate's resolveExternalSystemRedirect)
  const baseUrl = getExternalSystemBaseUrl(targetSystem);
  if (baseUrl) {
    const url = new URL(baseUrl);
    url.pathname = "/auth/callback";
    url.searchParams.set("ticket", rawTicket);
    url.searchParams.set("target", targetSystem);
    if (next) url.searchParams.set("next", next);
    
    return NextResponse.json({
      ok: true,
      ticket: rawTicket,
      redirectTo: url.toString(),
      expiresAt,
    });
  }

  return NextResponse.json({
    ok: true,
    ticket: rawTicket,
    expiresAt,
  });
}
