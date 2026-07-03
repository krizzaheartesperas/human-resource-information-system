import { normalizeSystemCode } from "@/lib/auth/sessionAccess";
import { safeNextPath } from "@/lib/auth/safeNextPath";

function trimBaseUrl(value: string | null | undefined): string | null {
  const trimmed = String(value ?? "").replace(/\/$/, "").trim();
  return trimmed || null;
}

function defaultEntryPath(systemCode: string): string {
  if (systemCode === "recruitment") {
    return (process.env.NEXT_PUBLIC_RECRUITMENT_ENTRY_PATH ?? "/dashboard").trim();
  }
  return "/dashboard";
}

function normalizeEntryPath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

export function getExternalSystemBaseUrl(systemCode: string | null | undefined): string | null {
  const code = normalizeSystemCode(systemCode ?? "");
  if (code === "recruitment") {
    return trimBaseUrl(process.env.NEXT_PUBLIC_RECRUITMENT_URL);
  }
  return null;
}

export function resolveExternalSystemRedirect(
  systemCode: string | null | undefined,
  nextPath?: string | null
): string | null {
  const baseUrl = getExternalSystemBaseUrl(systemCode);
  if (!baseUrl) return null;

  const safeNext = safeNextPath(nextPath);
  const destination = safeNext ?? normalizeEntryPath(defaultEntryPath(normalizeSystemCode(systemCode ?? "")));
  return new URL(destination, `${baseUrl}/`).toString();
}
