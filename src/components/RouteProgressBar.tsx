"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const MAX_PROGRESS_BEFORE_COMPLETE = 92;

function isModifiedEvent(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function isSameDocumentHashNavigation(anchor: HTMLAnchorElement) {
  if (typeof window === "undefined") return false;
  const current = new URL(window.location.href);
  const next = new URL(anchor.href, window.location.href);
  return (
    current.origin === next.origin &&
    current.pathname === next.pathname &&
    current.search === next.search &&
    current.hash !== next.hash
  );
}

export default function RouteProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const trickleTimerRef = useRef<number | null>(null);
  const idleResetTimerRef = useRef<number | null>(null);
  const completeTimerRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const lastRouteRef = useRef("");

  const clearTimers = useCallback(() => {
    if (trickleTimerRef.current) window.clearInterval(trickleTimerRef.current);
    if (idleResetTimerRef.current) window.clearTimeout(idleResetTimerRef.current);
    if (completeTimerRef.current) window.clearTimeout(completeTimerRef.current);
    trickleTimerRef.current = null;
    idleResetTimerRef.current = null;
    completeTimerRef.current = null;
  }, []);

  const stopProgress = useCallback(() => {
    clearTimers();
    startedRef.current = false;
    setProgress(100);
    completeTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 120);
  }, [clearTimers]);

  const startProgress = useCallback(() => {
    clearTimers();
    startedRef.current = true;
    setVisible(true);
    setProgress(14);

    trickleTimerRef.current = window.setInterval(() => {
      setProgress((current) => {
        if (current >= MAX_PROGRESS_BEFORE_COMPLETE) return current;
        const increment = current < 35 ? 8 : current < 70 ? 4 : 1.75;
        return Math.min(current + increment, MAX_PROGRESS_BEFORE_COMPLETE);
      });
    }, 140);

    idleResetTimerRef.current = window.setTimeout(() => {
      if (!startedRef.current) return;
      setVisible(false);
      setProgress(0);
      clearTimers();
      startedRef.current = false;
    }, 2400);
  }, [clearTimers]);

  useEffect(() => {
    const routeKey = `${pathname}?${searchParams.toString()}`;
    if (!lastRouteRef.current) {
      lastRouteRef.current = routeKey;
      return;
    }
    if (lastRouteRef.current !== routeKey) {
      lastRouteRef.current = routeKey;
      const frame = window.requestAnimationFrame(() => {
        stopProgress();
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [pathname, searchParams, stopProgress]);

  useEffect(() => {
    lastRouteRef.current = `${pathname}?${searchParams.toString()}`;

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || isModifiedEvent(event)) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (anchor) {
        if (
          anchor.target === "_blank" ||
          anchor.hasAttribute("download") ||
          anchor.getAttribute("rel") === "external" ||
          isSameDocumentHashNavigation(anchor)
        ) {
          return;
        }
        const href = anchor.getAttribute("href") ?? "";
        if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) return;
        startProgress();
        return;
      }

      const submitButton = target.closest("button[type='submit'], input[type='submit']");
      if (submitButton) {
        startProgress();
      }
    };

    const handleSubmit = () => {
      startProgress();
    };

    const handlePopState = () => {
      startProgress();
    };

    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, true);
      window.removeEventListener("popstate", handlePopState);
      clearTimers();
    };
  }, [pathname, searchParams, startProgress, clearTimers]);

  return (
    <div
      aria-hidden="true"
      className={`route-progress-shell ${visible ? "is-visible" : ""}`}
    >
      <div
        className="route-progress-bar"
        style={{ transform: `scaleX(${Math.max(progress, 0) / 100})` }}
      />
      <div className="route-progress-glow" style={{ left: `${progress}%` }} />
    </div>
  );
}
