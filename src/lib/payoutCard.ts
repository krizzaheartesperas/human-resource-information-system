/** PAN helpers for Maya-linked card (demo / UI). Full PAN is never persisted — only masked. */

export function digitsOnlyPan(value: string): string {
  return value.replace(/\D/g, "");
}

/** 16 digits, Visa-style (starts with 4). */
export function isValidLinkedCardPan16(digits: string): boolean {
  return digits.length === 16 && /^\d{16}$/.test(digits) && digits.startsWith("4");
}

export function maskPan16Digits(digits16: string): string {
  const d = digitsOnlyPan(digits16);
  if (d.length < 4) return "";
  return `**** **** **** ${d.slice(-4)}`;
}

/** Format typed digits as 4-4-4-4 for display (max 16 digits). */
export function formatPanInputGroups(digits: string): string {
  const d = digitsOnlyPan(digits).slice(0, 16);
  return d.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}
