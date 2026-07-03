"use client";

import { useSearchParams } from "next/navigation";
import ComplaintDetailPage from "@/features/complaints/components/ComplaintDetailPage";
import ComplaintManagerApprovalPage from "@/features/complaints/components/ComplaintManagerApprovalPage";
import ComplaintManagerEscalatedPage from "@/features/complaints/components/ComplaintManagerEscalatedPage";

/**
 * Single App Router segment for `/complaints/[id]`.
 * Manager workflows use `?context=manager-approval` or `?context=manager-escalated`.
 */
export default function ComplaintByIdPage() {
  const context = useSearchParams().get("context");
  if (context === "manager-approval") {
    return <ComplaintManagerApprovalPage />;
  }
  if (context === "manager-escalated") {
    return <ComplaintManagerEscalatedPage />;
  }
  return <ComplaintDetailPage />;
}
