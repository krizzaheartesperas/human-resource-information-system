import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { safeNextPath } from "@/lib/auth/safeNextPath";
import { isMagicLinkVerifyOtpFallbackEnabled } from "@/lib/auth/ssoSessionStrategy";

function getServiceSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceRole) return null;
  return createClient(url, serviceRole);
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function getPublicHrisOrigin(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_HRIS_URL?.replace(/\/$/, "").trim();
  if (env) return env;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = (req.headers.get("x-forwarded-proto") ?? "http").split(",")[0]?.trim() || "http";
  if (host) return `${proto}://${host}`;
  return new URL(req.url).origin;
}

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? null;
  return null;
}

type AuditEvent =
  | "ticket_consumed"
  | "consume_failed"
  | "consume_expired"
  | "consume_replay"
  | "consume_session_mint_failed";

async function writeAudit(
  admin: SupabaseClient,
  row: {
    event: AuditEvent;
    ticketId: string | null;
    userId: string | null;
    ip: string | null;
    userAgent: string | null;
    detail: Record<string, unknown>;
  }
) {
  await admin.from("sso_handoff_audit").insert({
    event: row.event,
    ticket_id: row.ticketId,
    user_id: row.userId,
    ip: row.ip,
    user_agent: row.userAgent,
    detail: row.detail,
  });
}

export async function POST(req: NextRequest) {
  const admin = getServiceSupabase();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "sso_not_configured" }, { status: 503 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const rawTicket = typeof body.ticket === "string" ? body.ticket.trim() : "";
  if (!rawTicket) {
    await writeAudit(admin, {
      event: "consume_failed",
      ticketId: null,
      userId: null,
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
      detail: { reason: "missing_ticket" },
    });
    return NextResponse.json({ ok: false, error: "invalid_ticket" }, { status: 400 });
  }

  const safeNext = safeNextPath(body.next ?? null);
  const hash = sha256Hex(rawTicket);
  const nowIso = new Date().toISOString();
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent");

  const { data: consumed, error: consumeErr } = await admin
    .from("sso_handoff_tickets")
    .update({ used_at: nowIso })
    .eq("secret_hash", hash)
    .is("used_at", null)
    .gt("expires_at", nowIso)
    .select("id, user_id, expires_at, created_at, metadata")
    .maybeSingle();

  if (consumeErr) {
    await writeAudit(admin, {
      event: "consume_failed",
      ticketId: null,
      userId: null,
      ip,
      userAgent: ua,
      detail: { reason: "consume_update_error", message: consumeErr.message },
    });
    return NextResponse.json({ ok: false, error: "invalid_ticket" }, { status: 400 });
  }

  if (!consumed?.id || !consumed.user_id) {
    const { data: probe } = await admin
      .from("sso_handoff_tickets")
      .select("id, used_at, expires_at, user_id")
      .eq("secret_hash", hash)
      .maybeSingle();

    if (probe?.used_at) {
      await writeAudit(admin, {
        event: "consume_replay",
        ticketId: String(probe.id),
        userId: probe.user_id ? String(probe.user_id) : null,
        ip,
        userAgent: ua,
        detail: {},
      });
    } else if (probe && new Date(String(probe.expires_at)).getTime() <= Date.now()) {
      await writeAudit(admin, {
        event: "consume_expired",
        ticketId: String(probe.id),
        userId: probe.user_id ? String(probe.user_id) : null,
        ip,
        userAgent: ua,
        detail: {},
      });
    } else {
      await writeAudit(admin, {
        event: "consume_failed",
        ticketId: null,
        userId: null,
        ip,
        userAgent: ua,
        detail: { reason: "unknown_or_consumed_ticket" },
      });
    }
    return NextResponse.json({ ok: false, error: "invalid_ticket" }, { status: 400 });
  }

  const ticketId = String(consumed.id);
  const userId = String(consumed.user_id);

  await writeAudit(admin, {
    event: "ticket_consumed",
    ticketId,
    userId,
    ip,
    userAgent: ua,
    detail: { next: safeNext ?? null },
  });

  const { data: authUser, error: authLookupErr } = await admin.auth.admin.getUserById(userId);
  const email = String(authUser?.user?.email ?? "").trim();
  if (authLookupErr || !email) {
    await writeAudit(admin, {
      event: "consume_session_mint_failed",
      ticketId,
      userId,
      ip,
      userAgent: ua,
      detail: { reason: "missing_auth_email", message: authLookupErr?.message },
    });
    return NextResponse.json({ ok: false, error: "invalid_ticket" }, { status: 400 });
  }

  const metadata = (consumed.metadata as any) || {};
  const targetSystem = String(metadata.target_system || "hris");

  const origin = getPublicHrisOrigin(req);
  let redirectTo = `${origin}/auth/sso-complete`;
  const params = new URLSearchParams();
  if (safeNext) params.set("next", safeNext);
  if (targetSystem) params.set("target", targetSystem);
  const qs = params.toString();
  if (qs) redirectTo += `?${qs}`;

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  if (linkErr || !linkData) {
    await writeAudit(admin, {
      event: "consume_session_mint_failed",
      ticketId,
      userId,
      ip,
      userAgent: ua,
      detail: { reason: "generate_link_failed", message: linkErr?.message },
    });
    return NextResponse.json({ ok: false, error: "session_start_failed" }, { status: 503 });
  }

  const props = linkData.properties as Record<string, string | undefined> | undefined;
  const actionLink = props?.action_link ?? (linkData as { action_link?: string }).action_link;
  const hashedToken = props?.hashed_token;

  if (isMagicLinkVerifyOtpFallbackEnabled() && hashedToken) {
    return NextResponse.json({ ok: true, flow: "verify_otp", tokenHash: hashedToken, ticketId, targetSystem });
  }

  if (actionLink && typeof actionLink === "string") {
    return NextResponse.json({ ok: true, flow: "gotrue_redirect", redirectUrl: actionLink, ticketId, targetSystem });
  }

  if (hashedToken) {
    return NextResponse.json({ ok: true, flow: "verify_otp", tokenHash: hashedToken, ticketId, targetSystem });
  }

  await writeAudit(admin, {
    event: "consume_session_mint_failed",
    ticketId,
    userId,
    ip,
    userAgent: ua,
    detail: { reason: "generate_link_missing_links" },
  });

  return NextResponse.json({ ok: false, error: "session_start_failed" }, { status: 503 });
}
