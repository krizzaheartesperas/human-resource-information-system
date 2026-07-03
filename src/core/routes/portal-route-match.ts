/**
 * Leave + complaints href matching (standalone module so Webpack does not alias
 * these exports to a removed `pathMatchesAccount` slot in dev caches).
 */

export function pathMatchesLeave(pathname: string, leavePath: string): boolean {
  return pathname === leavePath || pathname.startsWith(`${leavePath}/`);
}

/** True when `pathname` + current query matches the given `href` (path + optional query). */
export function matchesComplaintsHref(
  pathname: string,
  searchParams: { get: (key: string) => string | null },
  href: string,
): boolean {
  const q = href.indexOf("?");
  const path = q === -1 ? href : href.slice(0, q);
  if (pathname !== path) return false;
  if (q === -1) return true;
  const target = new URLSearchParams(href.slice(q + 1));
  for (const key of target.keys()) {
    if (searchParams.get(key) !== target.get(key)) return false;
  }
  return true;
}
