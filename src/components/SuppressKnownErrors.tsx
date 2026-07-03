"use client";

import { useEffect } from "react";

/**
 * Suppresses known benign console errors that come from the browser or Next.js
 * (e.g. AbortError: "Lock broken by another request with the 'steal' option"
 * during HMR or concurrent requests in dev). Does not affect real app errors.
 */
export function SuppressKnownErrors() {
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event?.reason;
      if (reason instanceof Error && reason.name === "AbortError") {
        const msg = reason.message ?? "";
        if (
          msg.includes("Lock broken") ||
          msg.includes("steal") ||
          msg.includes("aborted")
        ) {
          event.preventDefault();
          event.stopPropagation();
        }
      }
    };

    window.addEventListener("unhandledrejection", handleRejection);
    return () => window.removeEventListener("unhandledrejection", handleRejection);
  }, []);

  return null;
}
