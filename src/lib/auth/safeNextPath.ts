/**
 * Prevent open redirects: only same-app relative paths are allowed.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (!s.startsWith("/")) return null;
  if (s.startsWith("//") || s.startsWith("/\\")) return null;
  if (s.includes("://")) return null;
  if (/[\s\x00-\x1f]/.test(s)) return null;
  const lower = s.toLowerCase();
  if (lower.startsWith("/javascript:") || lower.startsWith("/data:") || lower.startsWith("/vbscript:")) {
    return null;
  }
  return s;
}
