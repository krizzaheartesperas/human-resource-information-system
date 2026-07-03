"use client";

import { useState, useRef, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  UserCircle,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  Building2,
  User,
  Shield,
  Bell,
  LogOut,
  Pencil,
  X,
  Check,
  FileText,
  Download,
  Eye,
  CircleAlert,
} from "lucide-react";
import { getDepartmentById, getEmployeeById, getJobHistoryByEmployeeId } from "@/lib/mock";
import { cn, formatPersonName } from "@/lib/utils";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { getPortalPaths } from "@/core/routes/portal-routes";
import { signOutApp } from "@/lib/auth-actions";
import { useTheme } from "@/components/theme/ThemeProvider";
import { DashboardSectionTopBar } from "@/components/layout/DashboardSectionTopBar";
import { EmployeeSectionHeader } from "@/components/layout/EmployeeSectionHeader";
import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";
import { supabase } from "@/lib/supabase/client";
import {
  fetchEmployeeForAuthUser,
  fetchProfileForAuthUser,
  isSupabaseAuthConfigured,
} from "@/lib/supabase/supabaseAuth";
import { appendAuditLog } from "@/features/audit/services/audit.service";
import { loadRequestsFromStorage, saveRequestsToStorage } from "@/features/workflow/services/workflowRequests";
import { workflowRequests } from "@/lib/mock";
import {
  buildProfileChangeRequest,
  formatBirthday,
  formatEmploymentType,
  loadNotificationPrefs,
  saveNotificationPrefs,
  type NotificationPrefs,
  type RequestField,
} from "@/features/profile/services/profile.service";

export default function AccountPage() {
  const router = useRouter();
  const { user: currentUser, updateUser } = useCurrentUser();
  const paths = useMemo(
    () => getPortalPaths(currentUser.role),
    [currentUser.role]
  );
  const { theme, setTheme } = useTheme();
  const department = getDepartmentById(currentUser.departmentId);
  const manager = currentUser.managerId
    ? getEmployeeById(currentUser.managerId)
    : null;
  const employeeRecord = getEmployeeById(currentUser.employeeId);
  const employmentHistoryRows = getJobHistoryByEmployeeId(currentUser.employeeId);
  const profileDocuments = useMemo(
    () => [
      { id: "doc-profile", name: "Profile Photo Consent.pdf", type: "PDF", updatedAt: "2026-03-14" },
      { id: "doc-contract", name: "Employment Contract.pdf", type: "PDF", updatedAt: "2026-01-22" },
    ],
    []
  );

  const [editingPersonal, setEditingPersonal] = useState(false);
  const [personalForm, setPersonalForm] = useState(() => ({
    name: currentUser.name,
    email: currentUser.email,
    personalPhone: currentUser.personalPhone,
    birthday: currentUser.birthday,
    currentAddress: currentUser.currentAddress,
  }));
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [passwordForm, setPasswordForm] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [personalMessage, setPersonalMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestField, setRequestField] = useState<RequestField>("EMAIL");
  const [requestNewValue, setRequestNewValue] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [requestAttachment, setRequestAttachment] = useState<File | null>(null);
  const [requestMessage, setRequestMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  const [notifications, setNotifications] = useState<NotificationPrefs>(() =>
    loadNotificationPrefs()
  );
  const [accountTab, setAccountTab] = useState<
    "personal" | "employment" | "security" | "preferences" | "documents" | "history"
  >(
    "personal"
  );

  const profileHistoryRows = useMemo(() => {
    const list = loadRequestsFromStorage();
    return list
      .filter(
        (req) =>
          req.createdBy === currentUser.employeeId &&
          req.type === "PERSONAL_INFO_CHANGE"
      )
      .slice(0, 12)
      .map((req) => {
        const match = (req.description ?? "").match(/From "([^"]*)" to "([^"]*)"/i);
        return {
          id: req.id,
          field: req.title.replace("Profile change request: ", ""),
          oldValue: match?.[1] ?? "—",
          newValue: match?.[2] ?? "—",
          effectiveDate: req.effectiveDate ?? "—",
          timestamp: new Date(req.createdAt).toLocaleString(),
        };
      });
  }, [currentUser.employeeId]);

  const startEditingPersonal = () => {
    setPersonalForm({
      name: currentUser.name,
      email: currentUser.email,
      personalPhone: currentUser.personalPhone,
      birthday: currentUser.birthday,
      currentAddress: currentUser.currentAddress,
    });
    setEditingPersonal(true);
  };

  const handleSavePersonal = async () => {
    const normalizedPhone = personalForm.personalPhone?.trim() || "";
    const normalizedAddress = personalForm.currentAddress?.trim() || "";

    setPersonalMessage(null);
    setSavingPersonal(true);

    if (isSupabaseAuthConfigured()) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setPersonalMessage({ type: "error", text: "No active session. Please log in again." });
        setSavingPersonal(false);
        return;
      }

      const { data: emp, error: empErr } = await fetchEmployeeForAuthUser(
        session.user.id,
        session.user.email
      );
      if (empErr || !emp) {
        setPersonalMessage({
          type: "error",
          text: empErr || "Could not resolve your employee row.",
        });
        setSavingPersonal(false);
        return;
      }

      const employeePayload: Record<string, string | null> = {};

      let employeesUpdateErr: { message: string } | null = null;
      if (Object.keys(employeePayload).length > 0) {
        // Some deployments have partial employees schema; retry after removing missing columns.
        for (let i = 0; i < 6; i++) {
          const { error } = await supabase
            .from("employees")
            .update(employeePayload)
            .eq("id", emp.id);
          if (!error) {
            employeesUpdateErr = null;
            break;
          }
          employeesUpdateErr = error;
          const missingColumn = error.message.match(/Could not find the '([^']+)' column/i)?.[1];
          if (!missingColumn || !(missingColumn in employeePayload)) {
            break;
          }
          delete employeePayload[missingColumn];
        }
      }

      if (employeesUpdateErr) {
        setPersonalMessage({
          type: "error",
          text: `Could not save employee info: ${employeesUpdateErr.message}`,
        });
        setSavingPersonal(false);
        return;
      }

      const profilePayload: Record<string, string | null> = {
        phone: normalizedPhone || null,
        current_address: normalizedAddress || null,
      };

      async function updateProfilesWithRetry(
        apply: (payload: Record<string, string | null>) => Promise<{ error: { message: string } | null }>
      ): Promise<{ ok: boolean; error: { message: string } | null }> {
        const payload = { ...profilePayload };
        let lastErr: { message: string } | null = null;
        for (let i = 0; i < 8; i++) {
          const { error } = await apply(payload);
          if (!error) return { ok: true, error: null };
          lastErr = error;
          const missingColumn = error.message.match(/Could not find the '([^']+)' column/i)?.[1];
          if (!missingColumn || !(missingColumn in payload)) break;
          delete payload[missingColumn];
        }
        return { ok: false, error: lastErr };
      }

      let profileSaved = false;
      let profileSaveErr: { message: string } | null = null;

      const { data: profile, error: profileErr } = await fetchProfileForAuthUser(session.user, emp);
      if (profileErr) {
        setPersonalMessage({ type: "error", text: `Could not load profile row: ${profileErr}` });
        setSavingPersonal(false);
        return;
      }
      if (profile) {
        const result = await updateProfilesWithRetry(async (payload) => {
          const { error } = await supabase
            .from("profiles")
            .update(payload)
            .eq("id", profile.id);
          return { error };
        });
        profileSaved = result.ok;
        profileSaveErr = result.error;
      }

      if (!profileSaved) {
        const insertPayload: Record<string, string | null> = {
          ...profilePayload,
          user_id: session.user.id,
        };
        for (let i = 0; i < 8; i++) {
          const { error } = await supabase.from("profiles").insert(insertPayload);
          if (!error) {
            profileSaved = true;
            profileSaveErr = null;
            break;
          }
          profileSaveErr = error;
          const missingColumn = error.message.match(/Could not find the '([^']+)' column/i)?.[1];
          if (missingColumn && missingColumn in insertPayload) {
            delete insertPayload[missingColumn];
            continue;
          }
          if (/invalid input syntax/i.test(error.message) && "user_id" in insertPayload) {
            delete insertPayload.user_id;
            continue;
          }
          break;
        }
      }

      if (!profileSaved && profileSaveErr) {
        setPersonalMessage({
          type: "error",
          text: `Saved employee info, but profile update failed: ${profileSaveErr.message}`,
        });
        setSavingPersonal(false);
        return;
      }
    }

    updateUser({
      name: currentUser.name,
      email: currentUser.email,
      personalPhone: normalizedPhone || undefined,
      birthday: currentUser.birthday,
      currentAddress: normalizedAddress || undefined,
    });
    setEditingPersonal(false);
    setSavingPersonal(false);
    setPersonalMessage({ type: "success", text: "Editable personal info saved." });
  };

  const handleCancelPersonal = () => {
    setPersonalForm({
      name: currentUser.name,
      email: currentUser.email,
      personalPhone: currentUser.personalPhone,
      birthday: currentUser.birthday,
      currentAddress: currentUser.currentAddress,
    });
    setEditingPersonal(false);
  };

  const handleChangePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      updateUser({ profilePhoto: dataUrl });
      void (async () => {
        if (!isSupabaseAuthConfigured()) return;
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;
        const { data: emp } = await fetchEmployeeForAuthUser(
          session.user.id,
          session.user.email
        );
        if (!emp) return;
        await supabase
          .from("employees")
          .update({ profile_photo: dataUrl })
          .eq("id", emp.id);
      })();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordMessage({ type: "error", text: "New password and confirmation do not match." });
      return;
    }
    if (passwordForm.new.length < 8) {
      setPasswordMessage({ type: "error", text: "New password must be at least 8 characters." });
      return;
    }
    setPasswordMessage({ type: "success", text: "Password updated successfully. (Demo: not sent to server.)" });
    setPasswordForm({ current: "", new: "", confirm: "" });
  };

  const handleNotificationChange = (key: keyof NotificationPrefs, value: boolean) => {
    const next = { ...notifications, [key]: value };
    setNotifications(next);
    saveNotificationPrefs(next);
  };

  const handleSignOut = async () => {
    await signOutApp();
    router.push("/login");
  };

  const openChangeRequestModal = (field: RequestField) => {
    setRequestField(field);
    setRequestReason("");
    setRequestAttachment(null);
    setRequestMessage(null);
    if (field === "EMAIL") setRequestNewValue(currentUser.email);
    if (field === "PERSONAL_EMAIL") setRequestNewValue(currentUser.email);
    if (field === "NAME") setRequestNewValue(formatPersonName(currentUser.name));
    if (field === "BIRTHDAY") setRequestNewValue(currentUser.birthday);
    if (field === "PHONE") setRequestNewValue(currentUser.personalPhone);
    if (field === "CURRENT_ADDRESS") setRequestNewValue(currentUser.currentAddress);
    if (field === "PERMANENT_ADDRESS") setRequestNewValue(currentUser.currentAddress);
    if (field === "GENDER") setRequestNewValue(employeeRecord ? "Not specified" : "Not specified");
    if (field === "CIVIL_STATUS") setRequestNewValue("Not specified");
    if (field === "NATIONALITY") setRequestNewValue("Filipino");
    if (field === "SSS") setRequestNewValue("—");
    if (field === "PHILHEALTH") setRequestNewValue("—");
    if (field === "PAGIBIG") setRequestNewValue("—");
    if (field === "TIN") setRequestNewValue("—");
    setRequestOpen(true);
  };

  const getCurrentValueForField = (field: RequestField): string => {
    if (field === "EMAIL") return currentUser.email;
    if (field === "PERSONAL_EMAIL") return currentUser.email;
    if (field === "NAME") return formatPersonName(currentUser.name);
    if (field === "BIRTHDAY") return currentUser.birthday;
    if (field === "PHONE") return currentUser.personalPhone || "—";
    if (field === "CURRENT_ADDRESS") return currentUser.currentAddress || "—";
    if (field === "PERMANENT_ADDRESS") return currentUser.currentAddress || "—";
    if (field === "GENDER") return "Not specified";
    if (field === "CIVIL_STATUS") return "Not specified";
    if (field === "NATIONALITY") return "Filipino";
    return "—";
  };

  const getFieldLabel = (field: RequestField): string => {
    if (field === "EMAIL") return "Company Email";
    if (field === "PERSONAL_EMAIL") return "Personal Email";
    if (field === "NAME") return "Name";
    if (field === "BIRTHDAY") return "Birthday";
    if (field === "PHONE") return "Personal Phone";
    if (field === "CURRENT_ADDRESS") return "Current Address";
    if (field === "PERMANENT_ADDRESS") return "Permanent Address";
    if (field === "GENDER") return "Gender";
    if (field === "CIVIL_STATUS") return "Civil Status";
    if (field === "NATIONALITY") return "Nationality";
    if (field === "SSS") return "SSS";
    if (field === "PHILHEALTH") return "PhilHealth";
    if (field === "PAGIBIG") return "Pag-IBIG";
    return "TIN";
  };

  const requestCurrentValue = getCurrentValueForField(requestField);
  const normalizedRequestNewValue =
    requestField === "NAME" ? formatPersonName(requestNewValue.trim()) : requestNewValue.trim();
  const requestSubmitDisabled =
    requestSubmitting ||
    !normalizedRequestNewValue ||
    normalizedRequestNewValue === requestCurrentValue ||
    !requestReason.trim();

  const submitProfileChangeRequest = async () => {
    const beforeValue = getCurrentValueForField(requestField);
    const afterValue = requestField === "NAME" ? formatPersonName(requestNewValue.trim()) : requestNewValue.trim();
    const reason = requestReason.trim();

    if (!afterValue) {
      setRequestMessage({ type: "error", text: "Please enter a new value." });
      return;
    }
    if (afterValue === beforeValue) {
      setRequestMessage({ type: "error", text: "New value must be different from current value." });
      return;
    }
    if (!reason) {
      setRequestMessage({ type: "error", text: "Reason for change is required." });
      return;
    }
    if (
      (requestField === "EMAIL" || requestField === "PERSONAL_EMAIL") &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(afterValue)
    ) {
      setRequestMessage({ type: "error", text: "Please enter a valid email." });
      return;
    }

    setRequestSubmitting(true);
    setRequestMessage(null);

    const req = buildProfileChangeRequest(
      { employeeId: currentUser.employeeId, name: currentUser.name, role: currentUser.role },
      getFieldLabel(requestField),
      beforeValue,
      afterValue
    );
    const requestFieldMap: Record<RequestField, NonNullable<typeof req.personalInfoField>> = {
      EMAIL: "EMAIL",
      PERSONAL_EMAIL: "EMAIL",
      NAME: "FULLNAME",
      BIRTHDAY: "BIRTHDATE",
      PHONE: "CONTACT_NUMBER",
      CURRENT_ADDRESS: "ADDRESS",
      PERMANENT_ADDRESS: "ADDRESS",
      GENDER: "CIVIL_STATUS",
      CIVIL_STATUS: "CIVIL_STATUS",
      NATIONALITY: "CIVIL_STATUS",
      SSS: "SSS",
      PHILHEALTH: "PHILHEALTH",
      PAGIBIG: "PAGIBIG",
      TIN: "TIN",
    };
    req.personalInfoField = requestFieldMap[requestField];
    req.description = `${req.description}\nReason: ${reason}`;
    if (requestAttachment) {
      req.attachmentName = requestAttachment.name;
      req.attachmentDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.readAsDataURL(requestAttachment);
      });
    }

    const stored = loadRequestsFromStorage();
    const list = stored.length > 0 ? [...stored] : [...workflowRequests];
    list.unshift(req);
    saveRequestsToStorage(list);

    if (isSupabaseAuthConfigured()) {
      await supabase.from("workflow_requests").insert({
        id: req.id,
        type: req.type,
        title: `${req.title}: ${beforeValue} -> ${afterValue} | Reason: ${reason}`,
        created_by: currentUser.employeeId,
        status: req.status,
        entity_id: currentUser.employeeId,
        entity_type: "employee",
      });
    }

    if (req.status === "APPROVED") {
      if (requestField === "EMAIL") {
        if (isSupabaseAuthConfigured()) {
          await supabase.auth.updateUser({ email: afterValue });
        }
        updateUser({ email: afterValue });
      }
      if (requestField === "NAME") {
        updateUser({ name: afterValue });
      }
      if (requestField === "BIRTHDAY") {
        updateUser({ birthday: afterValue });
      }
      setPersonalForm((p) => ({
        ...p,
        name: requestField === "NAME" ? afterValue : p.name,
        email: requestField === "EMAIL" ? afterValue : p.email,
        birthday: requestField === "BIRTHDAY" ? afterValue : p.birthday,
      }));
    }

    appendAuditLog({
      actorId: currentUser.employeeId,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: req.status === "APPROVED" ? "PROFILE_CHANGE_AUTO_APPROVED" : "PROFILE_CHANGE_REQUESTED",
      entityType: "WORKFLOW_REQUEST",
      entityId: req.id,
      summary:
        req.status === "APPROVED"
          ? `${currentUser.name} updated ${getFieldLabel(requestField)} (auto-approved by system).`
          : `${currentUser.name} requested ${getFieldLabel(requestField)} change for approval.`,
      before: { value: beforeValue },
      after: { value: afterValue, reason },
    });

    if (req.status === "APPROVED") {
      if (isSupabaseAuthConfigured()) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
        const { data: emp } = await fetchEmployeeForAuthUser(
          session.user.id,
          session.user.email
        );
        if (requestField === "EMAIL") {
            await supabase.auth.updateUser({ email: afterValue });
          }
          if (emp) {
            if (requestField === "NAME") {
              const parts = formatPersonName(afterValue).split(/\s+/).filter(Boolean);
              const first = parts[0] ?? "";
              const last = parts.slice(1).join(" ");
              await supabase.from("employees").update({ first_name: first, last_name: last }).eq("id", emp.id);
              const { data: profile } = await fetchProfileForAuthUser(session.user, emp);
              if (profile) {
                await supabase.from("profiles").update({ first_name: first, last_name: last }).eq("id", profile.id);
              }
            } else if (requestField === "BIRTHDAY") {
              await supabase.from("employees").update({ birthday: afterValue }).eq("id", emp.id);
              const { data: profile } = await fetchProfileForAuthUser(session.user, emp);
              if (profile) {
                await supabase
                  .from("profiles")
                  .update({ birthday: afterValue, birthdate: afterValue })
                  .eq("id", profile.id);
              }
            } else if (requestField === "EMAIL") {
              await supabase.from("employees").update({ email: afterValue }).eq("id", emp.id);
            }
          }
        }
      }

      if (requestField === "NAME") {
        updateUser({ name: formatPersonName(afterValue) });
      } else if (requestField === "BIRTHDAY") {
        updateUser({ birthday: afterValue });
      } else if (requestField === "EMAIL") {
        updateUser({ email: afterValue });
      }
    }

    setRequestSubmitting(false);
    setRequestOpen(false);
    setPersonalMessage({
      type: "success",
      text:
        req.status === "APPROVED"
          ? "Request submitted and auto-approved."
          : "Your request has been submitted successfully and is pending approval.",
    });
  };

  return (
    <div className="min-w-0 w-full max-w-full space-y-5">
      <div className="min-w-0 space-y-3">
        {currentUser.role === "EMPLOYEE" || currentUser.role === "HR_STAFF" ? (
          <div className="flex flex-col gap-6">
            <EmployeeModuleTopbar searchPlaceholder="Search" />
            <EmployeeSectionHeader
              title="Account"
              tabs={[
                { id: "personal", label: "Personal info" },
                { id: "employment", label: "Employment" },
                { id: "security", label: "Account & security" },
                { id: "preferences", label: "Preferences" },
                { id: "documents", label: "Documents" },
                { id: "history", label: "History" },
              ]}
              activeTab={accountTab}
              onTabChange={(id) => setAccountTab(id as typeof accountTab)}
            />
          </div>
        ) : (
          <>
            <DashboardSectionTopBar
              breadcrumb={
                <>
                  <span className="truncate font-semibold">Account</span>
                  <span className="shrink-0 opacity-70">&gt;</span>
                  <span className="truncate font-semibold text-foreground">Account</span>
                </>
              }
              searchPlaceholder="Search account settings..."
            />
          </>
        )}
      </div>

      <Tabs value={accountTab} onValueChange={(value) => setAccountTab(value as typeof accountTab)} className="min-w-0 space-y-3">
        {currentUser.role !== "EMPLOYEE" && currentUser.role !== "HR_STAFF" ? (
          <div className="min-w-0">
            <div className="border-b border-border/70">
              <div className="-mx-1 flex gap-1 overflow-x-auto py-1 [scrollbar-width:thin] sm:gap-6 lg:gap-8 [&::-webkit-scrollbar]:h-1.5">
                {[
                  { value: "personal", label: "Personal info" },
                  { value: "employment", label: "Employment" },
                  { value: "security", label: "Account & security", mobileLabel: "Security" },
                  { value: "preferences", label: "Preferences" },
                  { value: "documents", label: "Documents" },
                  { value: "history", label: "History" },
                ].map(({ value, label, mobileLabel }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAccountTab(value as typeof accountTab)}
                    className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap pb-3 -mb-px px-2 text-sm transition-colors sm:text-base ${
                      accountTab === value
                        ? "text-primary font-medium"
                        : "text-muted-foreground hover:text-primary"
                    }`}
                  >
                    {mobileLabel ? (
                      <>
                        <span className="sm:hidden">{mobileLabel}</span>
                        <span className="hidden sm:inline">{label}</span>
                      </>
                    ) : (
                      <span>{label}</span>
                    )}
                    <span
                      className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left bg-primary transition-transform duration-200 ${
                        accountTab === value ? "scale-x-100" : "scale-x-0"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* Profile header */}
        <Card className="min-w-0">
          <CardContent className="min-w-0 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex flex-col items-start gap-1.5">
                <div className="relative flex size-14 shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-border">
                  <Image
                    src={currentUser.profilePhoto}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="56px"
                    unoptimized={currentUser.profilePhoto.startsWith("data:")}
                  />
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoFileChange}
                  aria-label="Choose profile photo"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-auto px-2 text-[11px]"
                  onClick={handleChangePhotoClick}
                >
                  <Pencil className="size-3 mr-1" />
                  Change photo
                </Button>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-lg font-semibold tracking-tight">
                  {formatPersonName(currentUser.name)}
                </h2>
                <p className="break-words text-sm text-muted-foreground">
                  {currentUser.jobTitle}
                </p>
                <p className="mt-0.5 break-words text-xs text-muted-foreground">
                  {department?.name ?? "—"} · {currentUser.employeeNumber}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
                    Active
                  </Badge>
                  <Badge variant="default" className="text-[11px] px-2 py-0.5">
                    {currentUser.role.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Manager: {manager ? `${manager.firstName} ${manager.lastName}` : "Unassigned"}
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full shrink-0 sm:mt-0 sm:w-auto"
                asChild
              >
                <Link href={`/employees/${currentUser.employeeId}`}>
                  View as employee profile
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <TabsContent value="personal" className="min-w-0 space-y-4">
          <Card className="min-w-0">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <UserCircle className="size-4 shrink-0" />
                Personal info
              </CardTitle>
              <p className="text-xs text-muted-foreground">Managed by HR. Request changes via Requests.</p>
            </CardHeader>
            <CardContent className="min-w-0 space-y-5 px-3 sm:px-6">
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Basic Info</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <p className="text-sm"><span className="text-muted-foreground">Full Name:</span> <span className="font-medium">{formatPersonName(currentUser.name)}</span></p>
                  <p className="text-sm"><span className="text-muted-foreground">Birthday:</span> <span className="font-medium">{formatBirthday(currentUser.birthday) || "—"}</span></p>
                  <p className="text-sm"><span className="text-muted-foreground">Gender:</span> <span className="font-medium">Not specified</span></p>
                  <p className="text-sm"><span className="text-muted-foreground">Civil Status:</span> <span className="font-medium">Not specified</span></p>
                  <p className="text-sm"><span className="text-muted-foreground">Nationality:</span> <span className="font-medium">Filipino</span></p>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact Info</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <p className="text-sm"><span className="text-muted-foreground">Personal Email:</span> <span className="font-medium">{currentUser.email}</span></p>
                  <p className="text-sm"><span className="text-muted-foreground">Work Email:</span> <span className="font-medium">{currentUser.email}</span> <span className="text-xs text-amber-600">(Managed by HR)</span></p>
                  <p className="text-sm"><span className="text-muted-foreground">Personal Phone:</span> <span className="font-medium">{currentUser.personalPhone || "—"}</span></p>
                  <p className="text-sm"><span className="text-muted-foreground">Current Address:</span> <span className="font-medium">{currentUser.currentAddress || "—"}</span></p>
                  <p className="text-sm"><span className="text-muted-foreground">Permanent Address:</span> <span className="font-medium">{currentUser.currentAddress || "—"}</span></p>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Government IDs</h3>
                <p className="text-xs text-muted-foreground">Managed by HR Staff</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <p className="text-sm"><span className="text-muted-foreground">SSS:</span> <span className="font-medium">Not provided</span></p>
                  <p className="text-sm"><span className="text-muted-foreground">PhilHealth:</span> <span className="font-medium">Not provided</span></p>
                  <p className="text-sm"><span className="text-muted-foreground">Pag-IBIG:</span> <span className="font-medium">Not provided</span></p>
                  <p className="text-sm"><span className="text-muted-foreground">TIN:</span> <span className="font-medium">Not provided</span></p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => openChangeRequestModal("SSS")}>Request SSS Update</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => openChangeRequestModal("PHILHEALTH")}>Request PhilHealth Update</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => openChangeRequestModal("PAGIBIG")}>Request Pag-IBIG Update</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => openChangeRequestModal("TIN")}>Request TIN Update</Button>
                </div>
              </section>

              <section className="flex flex-wrap gap-2 border-t border-border pt-4">
                <Button type="button" size="sm" onClick={() => openChangeRequestModal("NAME")}>Request Change</Button>
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link href={`${paths.requests}?tab=my`}>Request History</Link>
                </Button>
              </section>
              {personalMessage && (
                <p className={cn("text-xs", personalMessage.type === "error" ? "text-destructive" : "text-emerald-600")}>
                  {personalMessage.text}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employment" className="min-w-0 space-y-4">
          <Card className="min-w-0">
            <CardHeader className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Briefcase className="size-4 shrink-0" />
                Employment
              </CardTitle>
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Managed by HR. Request changes via Requests.
              </div>
            </CardHeader>
            <CardContent className="min-w-0 space-y-5 px-3 sm:px-6">
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current Employment</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <p className="text-sm"><span className="text-muted-foreground">Employee #:</span> <span className="font-medium">{currentUser.employeeNumber}</span></p>
                  <p className="text-sm"><span className="text-muted-foreground">Status:</span> <span className="font-medium">Active</span></p>
                  <p className="text-sm"><span className="text-muted-foreground">Job Title:</span> <span className="font-medium">{currentUser.jobTitle}</span></p>
                  <p className="text-sm"><span className="text-muted-foreground">Department:</span> <span className="font-medium">{department?.name ?? "—"}</span></p>
                  <p className="text-sm"><span className="text-muted-foreground">Manager:</span> <span className="font-medium">{manager ? `${manager.firstName} ${manager.lastName}` : "—"}</span></p>
                  <p className="text-sm"><span className="text-muted-foreground">Employment Type:</span> <span className="font-medium">{formatEmploymentType(currentUser.employmentType)}</span></p>
                  <p className="text-sm"><span className="text-muted-foreground">Job Level:</span> <span className="font-medium">Mid-Level</span></p>
                  <p className="text-sm"><span className="text-muted-foreground">Start Date:</span> <span className="font-medium">{new Date(currentUser.startDate).toLocaleDateString()}</span></p>
                  <p className="text-sm"><span className="text-muted-foreground">Regularization Date:</span> <span className="font-medium">—</span></p>
                  <p className="text-sm"><span className="text-muted-foreground">Separation Date:</span> <span className="font-medium">—</span></p>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Employment Details</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <p className="text-sm"><span className="text-muted-foreground">Effective Date:</span> <span className="font-medium">{new Date(currentUser.startDate).toLocaleDateString()}</span></p>
                  <p className="text-sm"><span className="text-muted-foreground">End Date:</span> <span className="font-medium">—</span></p>
                  <p className="text-sm sm:col-span-2"><span className="text-muted-foreground">Change Reason:</span> <span className="font-medium">Initial Hire</span></p>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Employment History</h3>
                {employmentHistoryRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No employment history available.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date range</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Change Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employmentHistoryRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{new Date(row.startDate).toLocaleDateString()} - {row.endDate ? new Date(row.endDate).toLocaleDateString() : "Present"}</TableCell>
                          <TableCell>{row.jobTitle}</TableCell>
                          <TableCell>{row.departmentName}</TableCell>
                          <TableCell>{row.endDate ? "Role Update" : "Initial Hire"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </section>

              <div className="border-t border-border pt-3">
                <Button type="button" size="sm" onClick={() => openChangeRequestModal("NAME")}>
                  Request Change
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="min-w-0 space-y-4">
          <Card className="min-w-0">
            <CardHeader className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Shield className="size-4 shrink-0" />
                Account &amp; security
              </CardTitle>
              <p className="text-xs text-muted-foreground">Manage account access and session security.</p>
            </CardHeader>
            <CardContent className="min-w-0 space-y-6 px-3 sm:px-6">
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Security</h3>
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last login</p>
                  <p className="mt-1 font-semibold">
                    {new Date(currentUser.lastLoginAt).toLocaleString("en-US", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              </section>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pw-current">Current password</Label>
                  <Input
                    id="pw-current"
                    type="password"
                    value={passwordForm.current}
                    onChange={(e) =>
                      setPasswordForm((p) => ({ ...p, current: e.target.value }))
                    }
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pw-new">New password</Label>
                  <Input
                    id="pw-new"
                    type="password"
                    value={passwordForm.new}
                    onChange={(e) =>
                      setPasswordForm((p) => ({ ...p, new: e.target.value }))
                    }
                    placeholder="Min 8 characters"
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pw-confirm">Confirm new password</Label>
                  <Input
                    id="pw-confirm"
                    type="password"
                    value={passwordForm.confirm}
                    onChange={(e) =>
                      setPasswordForm((p) => ({ ...p, confirm: e.target.value }))
                    }
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
                {passwordMessage && (
                  <p
                    className={
                      passwordMessage.type === "success"
                        ? "text-sm text-green-600 dark:text-green-400"
                        : "text-sm text-destructive"
                    }
                  >
                    {passwordMessage.text}
                  </p>
                )}
                <Button type="submit" size="sm" className="mt-2 w-full sm:w-auto">
                  Change password
                </Button>
              </form>
              <section className="space-y-3 border-t border-border pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active Sessions</h3>
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                  <p className="font-medium">Current Device</p>
                  <p className="text-xs text-muted-foreground">Session details are available soon.</p>
                </div>
              </section>
              <section className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="min-w-0 text-sm text-muted-foreground">Sign out of your account on this device.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full shrink-0 sm:w-auto"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-2 size-4" />
                  Sign out
                </Button>
              </section>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="min-w-0 space-y-4">
          <Card className="min-w-0">
            <CardHeader className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Bell className="size-4 shrink-0" />
                Preferences
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Personalize your theme and notifications.
              </p>
            </CardHeader>
            <CardContent className="min-w-0 space-y-6 px-3 sm:px-6">
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Appearance</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Button type="button" variant={theme === "light" ? "default" : "outline"} onClick={() => setTheme("light")}>
                    Light
                  </Button>
                  <Button type="button" variant={theme === "dark" ? "default" : "outline"} onClick={() => setTheme("dark")}>
                    Dark
                  </Button>
                  <Button type="button" variant="outline" disabled title="System theme is coming soon">
                    System
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Notifications
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    className="flex w-full min-w-0 flex-col gap-2 rounded-md border border-border px-3 py-2 text-left hover:bg-muted/60 sm:flex-row sm:items-center sm:justify-between"
                    onClick={() =>
                      handleNotificationChange("email", !notifications.email)
                    }
                  >
                    <span className="min-w-0 text-sm">Email notifications</span>
                    <span
                      className={`inline-flex h-6 w-11 shrink-0 items-center self-end rounded-full border border-input transition-colors sm:self-center ${
                        notifications.email ? "bg-primary" : "bg-muted"
                      }`}
                      aria-hidden="true"
                    >
                      <span
                        className={`block size-5 rounded-full bg-background shadow transition-transform ${
                          notifications.email
                            ? "translate-x-6"
                            : "translate-x-0.5"
                        }`}
                      />
                    </span>
                  </button>
                  <button
                    type="button"
                    className="flex w-full min-w-0 flex-col gap-2 rounded-md border border-border px-3 py-2 text-left hover:bg-muted/60 sm:flex-row sm:items-center sm:justify-between"
                    onClick={() =>
                      handleNotificationChange("inApp", !notifications.inApp)
                    }
                  >
                    <span className="min-w-0 text-sm">In-app notifications</span>
                    <span
                      className={`inline-flex h-6 w-11 shrink-0 items-center self-end rounded-full border border-input transition-colors sm:self-center ${
                        notifications.inApp ? "bg-primary" : "bg-muted"
                      }`}
                      aria-hidden="true"
                    >
                      <span
                        className={`block size-5 rounded-full bg-background shadow transition-transform ${
                          notifications.inApp
                            ? "translate-x-6"
                            : "translate-x-0.5"
                        }`}
                      />
                    </span>
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="documents" className="min-w-0 space-y-4">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <FileText className="size-4 shrink-0" />
                Documents
              </CardTitle>
              <p className="text-xs text-muted-foreground">Uploaded documents tied to your employee profile.</p>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              {profileDocuments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents uploaded</p>
              ) : (
                <div className="space-y-2">
                  {profileDocuments.map((doc) => (
                    <div key={doc.id} className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm">
                        <p className="font-medium">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{doc.type} · Last updated {doc.updatedAt}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm">
                          <Eye className="mr-1 size-3.5" />
                          View
                        </Button>
                        <Button type="button" variant="outline" size="sm">
                          <Download className="mr-1 size-3.5" />
                          Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="min-w-0 space-y-4">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <CircleAlert className="size-4 shrink-0" />
                History
              </CardTitle>
              <p className="text-xs text-muted-foreground">Read-only account changes from your own requests.</p>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              {profileHistoryRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No history yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field Changed</TableHead>
                      <TableHead>Old Value</TableHead>
                      <TableHead>New Value</TableHead>
                      <TableHead>Effective Date</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profileHistoryRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.field}</TableCell>
                        <TableCell>{row.oldValue}</TableCell>
                        <TableCell>{row.newValue}</TableCell>
                        <TableCell>{row.effectiveDate}</TableCell>
                        <TableCell>{row.timestamp}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Request Profile Change</DialogTitle>
            <DialogDescription>
              Submit a change request for approval. Provide a reason to help approvers review faster.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              <p><span className="font-medium">Field:</span> {getFieldLabel(requestField)}</p>
              <p className="mt-1"><span className="font-medium">Current Value:</span> {requestCurrentValue || "—"}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="request-new-value">New Value</Label>
              {requestField === "BIRTHDAY" ? (
                <Input
                  id="request-new-value"
                  type="date"
                  value={requestNewValue}
                  onChange={(e) => setRequestNewValue(e.target.value)}
                />
              ) : (
                <Input
                  id="request-new-value"
                  type={requestField === "EMAIL" ? "email" : "text"}
                  value={requestNewValue}
                  onChange={(e) => setRequestNewValue(e.target.value)}
                  placeholder={requestField === "EMAIL" ? "name@company.com" : "Enter updated value"}
                />
              )}
              <p className="text-xs text-muted-foreground">
                Current: <span className="font-medium">{requestCurrentValue || "—"}</span> | New:{" "}
                <span className="font-medium">{normalizedRequestNewValue || "—"}</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="request-reason">Reason for Change</Label>
              <textarea
                id="request-reason"
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="Explain why this change is needed..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="request-attachment">Attach Supporting Document (optional)</Label>
              <Input
                id="request-attachment"
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (!file) {
                    setRequestAttachment(null);
                    return;
                  }
                  const isPdf =
                    file.type === "application/pdf" ||
                    file.name.toLowerCase().endsWith(".pdf");
                  if (!isPdf) {
                    setRequestAttachment(null);
                    setRequestMessage({ type: "error", text: "Only PDF documents are allowed." });
                    e.currentTarget.value = "";
                    return;
                  }
                  setRequestMessage(null);
                  setRequestAttachment(file);
                }}
              />
            </div>

            {requestMessage && (
              <p className={cn("text-xs", requestMessage.type === "error" ? "text-destructive" : "text-emerald-600")}>
                {requestMessage.text}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRequestOpen(false)} disabled={requestSubmitting}>
              Cancel
            </Button>
            <Button type="button" onClick={submitProfileChangeRequest} disabled={requestSubmitDisabled}>
              {requestSubmitting ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
