"use client";

import type { CurrentUser } from "@/lib/mock";
import { normalizeSystemCode, pickDefaultSystemAccess, pickSystemAccess } from "@/lib/auth/sessionAccess";

const SYSTEM_SWITCHING_KEY = "system_switching";
const SSO_POST_LOGIN_TARGET_KEY = "sso_post_login_target";
const DEFAULT_TRANSITION_TTL_MS = 60_000;

function getWindowWithSsoFlag() {
  if (typeof window === "undefined") return null;
  return window as Window & typeof globalThis & { EXTERNAL_SSO_NAVIGATION?: boolean };
}

function now() {
  return Date.now();
}

function parseExpiry(raw: string | null): number | null {
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return value;
}

export function startSsoTransition(targetSystemCode: string, ttlMs = DEFAULT_TRANSITION_TTL_MS) {
  if (typeof window === "undefined") return;
  const expiresAt = now() + ttlMs;
  localStorage.setItem(SYSTEM_SWITCHING_KEY, String(expiresAt));
  localStorage.setItem(SSO_POST_LOGIN_TARGET_KEY, normalizeSystemCode(targetSystemCode));
  const win = getWindowWithSsoFlag();
  if (win) {
    win.EXTERNAL_SSO_NAVIGATION = true;
  }
}

export function getSsoPostLoginTarget(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(SSO_POST_LOGIN_TARGET_KEY);
    return value ? normalizeSystemCode(value) : null;
  } catch {
    return null;
  }
}

export function isSsoTransitionActive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const expiry = parseExpiry(localStorage.getItem(SYSTEM_SWITCHING_KEY));
    if (!expiry) return false;
    if (expiry <= now()) {
      clearSsoTransition();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function clearSsoTransition() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SYSTEM_SWITCHING_KEY);
    localStorage.removeItem(SSO_POST_LOGIN_TARGET_KEY);
  } catch {
    // ignore
  }
  const win = getWindowWithSsoFlag();
  if (win) {
    win.EXTERNAL_SSO_NAVIGATION = false;
  }
}

export function clearSsoTransitionIfTargetMatches(systemCode: string | null | undefined) {
  const target = getSsoPostLoginTarget();
  if (!target) return;
  if (target === normalizeSystemCode(systemCode ?? "")) {
    clearSsoTransition();
  }
}

export function applySelectedSystemToUser(
  user: CurrentUser,
  systemCode: string | null | undefined
): CurrentUser {
  const normalized = normalizeSystemCode(systemCode ?? "");
  if (!normalized) return user;
  const selected = pickDefaultSystemAccess(user.accessibleSystems ?? [], normalized);
  if (!selected) return user;
  return {
    ...user,
    selectedAccessId: selected.id,
    selectedSystemCode: selected.systemCode,
    selectedSystemName: selected.systemName,
    selectedSystemRoleCode: selected.roleCode,
    selectedSystemRoleName: selected.roleName,
  };
}

export function applySelectedAccessToUser(
  user: CurrentUser,
  accessId: string | null | undefined
): CurrentUser {
  const selected = pickSystemAccess(user.accessibleSystems ?? [], accessId);
  if (!selected) return user;
  return {
    ...user,
    selectedAccessId: selected.id,
    selectedSystemCode: selected.systemCode,
    selectedSystemName: selected.systemName,
    selectedSystemRoleCode: selected.roleCode,
    selectedSystemRoleName: selected.roleName,
  };
}
