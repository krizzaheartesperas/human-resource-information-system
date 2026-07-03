/**
 * Legacy query params used before Recruitment → HRIS ticket handoff.
 * Recruitment must migrate to `/auth/consume?ticket=...&next=...`.
 * Remove handling after this date.
 */
export const LEGACY_MAIN_PORTAL_QUERY_REMOVAL_DATE = "2026-07-01";

export function isLegacyForceSelectorQuery(searchParams: URLSearchParams): boolean {
  return (
    searchParams.get("from") === "main-portal" || searchParams.get("selectSystem") === "1"
  );
}
