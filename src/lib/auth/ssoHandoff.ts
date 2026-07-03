import { randomBytes, createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";

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

export type SsoTicketResult = {
  ok: boolean;
  ticket?: string;
  redirectTo?: string;
  error?: string;
};

export async function issueSsoTicket(
  userId: string,
  targetSystem: string,
  options: { ip?: string | null; userAgent?: string | null; next?: string | null } = {}
): Promise<SsoTicketResult> {
  const admin = getServiceSupabase();
  if (!admin) return { ok: false, error: "sso_not_configured" };

  const rawTicket = randomBytes(32).toString("hex");
  const hash = sha256Hex(rawTicket);
  const expiresAt = new Date(Date.now() + getSsoTicketTtlMs()).toISOString();

  const { error: insertErr } = await admin.from("sso_handoff_tickets").insert({
    secret_hash: hash,
    user_id: userId,
    expires_at: expiresAt,
    metadata: {
      created_ip: options.ip,
      user_agent: options.userAgent,
      target_system: targetSystem,
      issued_by_system: "hris",
      next: options.next ?? undefined,
    },
  });

  if (insertErr) {
    console.error("SSO ticket insertion error:", insertErr);
    return { ok: false, error: "ticket_creation_failed" };
  }

  // Audit log
  await admin.from("sso_handoff_audit").insert({
    event: "ticket_issued",
    user_id: userId,
    ip: options.ip,
    user_agent: options.userAgent,
    detail: { target_system: targetSystem, expires_at: expiresAt },
  });

  const code = targetSystem.toLowerCase();
  if (code === "recruitment") {
    const baseUrl = (process.env.NEXT_PUBLIC_RECRUITMENT_URL ?? "").replace(/\/$/, "").trim();
    if (baseUrl) {
      const url = new URL(baseUrl);
      // PER FIX 5: Use /auth/consume instead of /auth/callback for handoff
      url.pathname = "/auth/consume";
      url.searchParams.set("ticket", rawTicket);
      url.searchParams.set("target", code);
      if (options.next) url.searchParams.set("next", options.next);
      return { ok: true, ticket: rawTicket, redirectTo: url.toString() };
    }
  }

  // Internal system redirect
  if (code === "hris") {
    return { ok: true, ticket: rawTicket, redirectTo: options.next || "/dashboard" };
  }

  return { ok: true, ticket: rawTicket };
}
