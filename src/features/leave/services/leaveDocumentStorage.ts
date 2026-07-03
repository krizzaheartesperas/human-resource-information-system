"use client";

import { supabase } from "@/lib/supabase/client";

const DEFAULT_BUCKET = "leave-documents";
const LEAVE_DOCS_BUCKET = (process.env.NEXT_PUBLIC_SUPABASE_LEAVE_DOCS_BUCKET ?? DEFAULT_BUCKET).trim();

type UploadLeaveDocumentArgs = {
  file: File;
  employeeId: string;
  employeeNumber?: string;
  requestId: string;
};

type UploadLeaveDocumentResult =
  | { path: string; publicUrl: string | null; error: null }
  | { path: null; publicUrl: null; error: Error };

function sanitizeFileName(name: string): string {
  const trimmed = name.trim();
  const collapsed = trimmed.replace(/\s+/g, "_");
  return collapsed.replace(/[^a-zA-Z0-9._-]/g, "");
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

async function resolveStorageOwnerEmployeeId(employeeId: string, employeeNumber?: string): Promise<string> {
  const rawEmployeeId = employeeId.trim();
  if (isUuid(rawEmployeeId)) return rawEmployeeId;

  const normalizedEmployeeNumber = (employeeNumber ?? "").trim();
  if (normalizedEmployeeNumber) {
    const { data } = await supabase
      .from("employees")
      .select("id")
      .or(
        `employee_number.eq.${normalizedEmployeeNumber},employee_code.eq.${normalizedEmployeeNumber}`
      )
      .limit(1)
      .maybeSingle();
    const mappedId = String(data?.id ?? "").trim();
    if (mappedId) return mappedId;
  }

  const { data: authData } = await supabase.auth.getUser();
  const authUserId = String(authData.user?.id ?? "").trim();
  if (authUserId) {
    const { data } = await supabase
      .from("employees")
      .select("id")
      .or(`auth_user_id.eq.${authUserId},user_id.eq.${authUserId}`)
      .limit(1)
      .maybeSingle();
    const mappedId = String(data?.id ?? "").trim();
    if (mappedId) return mappedId;
  }

  return rawEmployeeId;
}

export async function uploadLeaveDocumentToSupabase({
  file,
  employeeId,
  employeeNumber,
  requestId,
}: UploadLeaveDocumentArgs): Promise<UploadLeaveDocumentResult> {
  if (!LEAVE_DOCS_BUCKET) {
    return { path: null, publicUrl: null, error: new Error("Supabase leave docs bucket is not configured.") };
  }

  const safeName = sanitizeFileName(file.name || "document.pdf") || "document.pdf";
  const ext = safeName.includes(".") ? safeName.split(".").pop()?.toLowerCase() : "";
  if (ext !== "pdf") {
    return { path: null, publicUrl: null, error: new Error("Only PDF documents are allowed.") };
  }

  const storageOwnerEmployeeId = await resolveStorageOwnerEmployeeId(employeeId, employeeNumber);
  const path = `leave-requests/${storageOwnerEmployeeId}/${requestId}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from(LEAVE_DOCS_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: "application/pdf",
    });

  if (uploadError) {
    return { path: null, publicUrl: null, error: uploadError };
  }

  const { data } = supabase.storage.from(LEAVE_DOCS_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data?.publicUrl ?? null, error: null };
}

export function getLeaveDocsBucketName(): string {
  return LEAVE_DOCS_BUCKET;
}

