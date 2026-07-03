"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  currentUser as defaultUser,
  getDemoNameForEmail,
  type CurrentUser,
  type CurrentUserEditable,
  type Role,
} from "@/lib/mock";

import {
  buildCurrentUserForAuthSession,
  isSupabaseAuthConfigured,
} from "@/lib/supabase/supabaseAuth";

import { supabase } from "@/lib/supabase/client";
import { formatPersonName } from "@/lib/utils";

import {
  normalizeSystemCode,
  pickDefaultSystemAccess,
  pickSystemAccess,
  roleFromSystemRoleCode,
} from "@/lib/auth/sessionAccess";

function isMissingAuthSessionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "AuthSessionMissingError" ||
    error.message.toLowerCase().includes("auth session missing")
  );
}

/* =========================
   STORAGE KEYS
========================= */
const PROFILE_STORAGE_KEY = "hris-account-profile";
const AUTH_STORAGE_KEY = "hris-auth-user";
const SYSTEM_STORAGE_KEY = "hris-selected-system";
const ACCESS_STORAGE_KEY = "hris-selected-access";
const ROLE_STORAGE_KEY = "hris-selected-role";

const ROLE_VALUES = new Set<Role>([
  "SUPER_ADMIN",
  "HR_ADMIN",
  "HR_MANAGER",
  "HR_STAFF",
  "DEPARTMENT_MANAGER",
  "MANAGER",
  "EMPLOYEE",
  "AUDITOR",
  "EXECUTIVE",
  "BOARD",
]);

/* =========================
   SAFE STORAGE HELPERS
========================= */
function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function loadFromStorage(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveToStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function removeFromStorage(key: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/* =========================
   AUTH STORAGE
========================= */
export function loadAuthUser(): CurrentUser | null {
  return safeParse<CurrentUser>(loadFromStorage(AUTH_STORAGE_KEY));
}

export function saveAuthUser(user: CurrentUser) {
  saveAuthUserInternal(user);
  saveSelectedRole(user.role);
  if (user.selectedAccessId) {
    saveSelectedAccessId(user.selectedAccessId);
  } else {
    clearSelectedAccessId();
  }
  if (user.selectedSystemCode) {
    saveSelectedSystemCode(user.selectedSystemCode);
  }
}

export function clearAuthUser() {
  clearAuthUserInternal();
  removeFromStorage(SYSTEM_STORAGE_KEY);
  removeFromStorage(ACCESS_STORAGE_KEY);
  removeFromStorage(ROLE_STORAGE_KEY);
}

export function clearAccountProfileOverrides() {
  removeFromStorage(PROFILE_STORAGE_KEY);
}

function saveAuthUserInternal(user: CurrentUser) {
  saveToStorage(AUTH_STORAGE_KEY, JSON.stringify(user));
}

function clearAuthUserInternal() {
  removeFromStorage(AUTH_STORAGE_KEY);
}

/* =========================
   PROFILE OVERRIDES
========================= */
function loadProfileOverrides(): Partial<CurrentUser> | null {
  return safeParse<Partial<CurrentUser>>(
    loadFromStorage(PROFILE_STORAGE_KEY)
  );
}

function saveProfileOverrides(partial: Partial<CurrentUser>) {
  saveToStorage(PROFILE_STORAGE_KEY, JSON.stringify(partial));
}

/* =========================
   SYSTEM HELPERS
========================= */
export function loadSelectedSystemCodeFromStorage(): string | null {
  const v = loadFromStorage(SYSTEM_STORAGE_KEY);
  return v ? normalizeSystemCode(v) : null;
}

export function loadSelectedAccessIdFromStorage(): string | null {
  return loadFromStorage(ACCESS_STORAGE_KEY);
}

export function loadSelectedRoleFromStorage(): Role | null {
  const v = loadFromStorage(ROLE_STORAGE_KEY)?.toUpperCase();
  return v && ROLE_VALUES.has(v as Role) ? (v as Role) : null;
}

function saveSelectedRole(role: Role) {
  saveToStorage(ROLE_STORAGE_KEY, role);
}

function saveSelectedAccessId(id: string) {
  saveToStorage(ACCESS_STORAGE_KEY, id);
}

function saveSelectedSystemCode(code: string) {
  saveToStorage(SYSTEM_STORAGE_KEY, normalizeSystemCode(code));
}

function clearSelectedAccessId() {
  removeFromStorage(ACCESS_STORAGE_KEY);
}

/* =========================
   CONTEXT
========================= */
const CurrentUserContext = createContext<{
  user: CurrentUser;
  updateUser: (updates: CurrentUserEditable) => void;
  switchSystem: (systemCode: string) => void;
  switchAccess: (accessId: string) => void;
  switchRole: (role: Role) => void;
  isHydrated: boolean;
} | null>(null);

/* =========================
   PROVIDER
========================= */
export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser>(defaultUser);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        if (!isSupabaseAuthConfigured()) {
          setUser(defaultUser);
          setIsHydrated(true);
          return;
        }

        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError) {
          if (isMissingAuthSessionError(authError)) {
            clearAuthUserInternal();
            if (!cancelled) {
              setUser(defaultUser);
              setIsHydrated(true);
            }
            return;
          }
          throw authError;
        }

        const authUser = authData.user;

        if (!authUser) {
          clearAuthUserInternal();
          if (!cancelled) {
            setUser(defaultUser);
            setIsHydrated(true);
          }
          return;
        }

        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) {
          if (isMissingAuthSessionError(sessionError)) {
            clearAuthUserInternal();
            if (!cancelled) {
              setUser(defaultUser);
              setIsHydrated(true);
            }
            return;
          }
          throw sessionError;
        }

        const { data, error: buildError } =
          await buildCurrentUserForAuthSession(authUser, {
            accessToken: sessionData?.session?.access_token,
            selectedAccessId: loadSelectedAccessIdFromStorage(),
            selectedSystemCode: loadSelectedSystemCodeFromStorage(),
          });

        if (buildError || !data) {
          clearAuthUserInternal();
          if (!cancelled) {
            setUser(defaultUser);
            setIsHydrated(true);
          }
          return;
        }

        const overrides = loadProfileOverrides() ?? {};
        const merged = { ...data, ...overrides } as CurrentUser;

        const preferredRole = loadSelectedRoleFromStorage();
        const demoName = getDemoNameForEmail(merged.email);

        const next: CurrentUser = {
          ...merged,
          role: preferredRole ?? merged.role,
          name: demoName ?? formatPersonName(merged.name),
        };

        if (!cancelled) {
          setUser(next);
          setIsHydrated(true);
        }

        saveAuthUserInternal(next);
      } catch (err) {
        if (!isMissingAuthSessionError(err)) {
          console.error("CurrentUser hydration error:", err);
        }

        if (!cancelled) {
          setUser(defaultUser);
          setIsHydrated(true);
        }
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  /* =========================
     UPDATE USER
  ========================= */
  const updateUser = useCallback((updates: CurrentUserEditable) => {
    setUser((prev) => {
      const next = { ...prev, ...updates } as CurrentUser;

      saveProfileOverrides({
        profilePhoto: next.profilePhoto,
        personalPhone: next.personalPhone,
        currentAddress: next.currentAddress,
      });

      saveAuthUserInternal(next);
      return next;
    });
  }, []);

  /* =========================
     SWITCH SYSTEM
  ========================= */
  const switchSystem = useCallback((systemCode: string) => {
    const normalized = normalizeSystemCode(systemCode);

    setUser((prev) => {
      const selected = pickDefaultSystemAccess(
        prev.accessibleSystems ?? [],
        normalized
      );

      if (!selected) return prev;

      const next = {
        ...prev,
        role: roleFromSystemRoleCode(selected.roleCode, selected.roleName),
        selectedAccessId: selected.id,
        selectedSystemCode: selected.systemCode,
        selectedSystemName: selected.systemName,
        selectedSystemRoleCode: selected.roleCode,
        selectedSystemRoleName: selected.roleName,
      };

      saveSelectedSystemCode(selected.systemCode);
      saveSelectedAccessId(selected.id);
      saveSelectedRole(next.role);
      saveAuthUserInternal(next);

      return next;
    });
  }, []);

  /* =========================
     SWITCH ACCESS
  ========================= */
  const switchAccess = useCallback((accessId: string) => {
    setUser((prev) => {
      const selected = pickSystemAccess(prev.accessibleSystems ?? [], accessId);
      if (!selected) return prev;

      const next = {
        ...prev,
        role: roleFromSystemRoleCode(selected.roleCode, selected.roleName),
        selectedAccessId: selected.id,
        selectedSystemCode: selected.systemCode,
        selectedSystemName: selected.systemName,
        selectedSystemRoleCode: selected.roleCode,
        selectedSystemRoleName: selected.roleName,
      };

      saveSelectedAccessId(selected.id);
      saveSelectedSystemCode(selected.systemCode);
      saveSelectedRole(next.role);
      saveAuthUserInternal(next);

      return next;
    });
  }, []);

  /* =========================
     SWITCH ROLE
  ========================= */
  const switchRole = useCallback((role: Role) => {
    setUser((prev) => {
      const next = { ...prev, role } as CurrentUser;

      saveSelectedRole(role);
      saveAuthUserInternal(next);

      return next;
    });
  }, []);

  return (
    <CurrentUserContext.Provider
      value={{
        user,
        updateUser,
        switchSystem,
        switchAccess,
        switchRole,
        isHydrated,
      }}
    >
      {children}
    </CurrentUserContext.Provider>
  );
}

/* =========================
   HOOK
========================= */
export function useCurrentUser() {
  const ctx = useContext(CurrentUserContext);

  if (!ctx) {
    throw new Error("useCurrentUser must be used within CurrentUserProvider");
  }

  return ctx;
}