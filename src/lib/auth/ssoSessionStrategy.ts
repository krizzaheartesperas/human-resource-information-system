/**
 * SSO session establishment (post–ticket consume).
 *
 * Spike outcome (this codebase, Supabase JS v2 + GoTrue):
 * - Primary: redirect the browser to Supabase Auth `action_link` from
 *   `auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } })`.
 *   That hits GoTrue’s standard verify endpoint, then redirects back to HRIS with tokens
 *   in the URL; the browser client (`detectSessionInUrl`) + `/auth/sso-complete` finish the session.
 * - Fallback: return `hashed_token` to the client and call `verifyOtp` when
 *   `NEXT_PUBLIC_SSO_MAGICLINK_FALLBACK === "true"` (e.g. redirect allowlist issues in dev).
 */
export type SsoConsumeClientFlow = "gotrue_redirect" | "verify_otp";

export function isMagicLinkVerifyOtpFallbackEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SSO_MAGICLINK_FALLBACK === "true";
}
