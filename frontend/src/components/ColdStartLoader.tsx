"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import api from "@/lib/api";
import { AlertCircle, RefreshCw, X } from "lucide-react";

/**
 * ColdStartLoader
 * ───────────────
 * Shows a non-blocking toast while the backend wakes up (Render free tier).
 * - Does NOT fire on localhost (developer mode)
 * - "Backend unavailable" toast auto-dismisses after 8 s so it never blocks the UI
 * - Full cleanup on unmount to prevent memory leaks / state-update-on-unmounted-component warnings
 */
export default function ColdStartLoader() {
  const [show, setShow] = useState(false);
  const [isWaking, setIsWaking] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const retryCountRef = useRef(0);
  const mountedRef = useRef(true);
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  // Helper: push + track a timeout so we can clear them all on unmount
  const addTimer = (fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  };

  const clearAllTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const checkHealth = useCallback(async () => {
    // Skip the whole check on localhost – backend may simply not be running
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      if (host === "localhost" || host === "127.0.0.1") return;
    }

    // Skip if we already confirmed the backend is alive this session
    if (
      typeof window !== "undefined" &&
      sessionStorage.getItem("backend_awake") === "true"
    ) {
      setIsWaking(false);
      setShow(false);
      return;
    }

    setIsUnavailable(false);

    // Only show the spinner after 1.5 s (avoids flash on fast networks)
    const showTimer = addTimer(() => {
      if (mountedRef.current && !sessionStorage.getItem("backend_awake")) {
        setIsWaking(true);
        setShow(true);
      }
    }, 1500);

    const controller = new AbortController();
    const abortTimer = addTimer(() => controller.abort(), 15000);

    try {
      const res = await api.get("/api/v1/health", {
        timeout: 15000,
        signal: controller.signal,
      });

      clearTimeout(abortTimer);
      clearTimeout(showTimer);

      const status = res?.data?.status || res?.status;
      if (status === "online" || status === "ok" || res?.status === 200) {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("backend_awake", "true");
        }
        if (mountedRef.current) {
          setIsWaking(false);
          setIsUnavailable(false);
          addTimer(() => {
            if (mountedRef.current) setShow(false);
          }, 300);
        }
        return;
      }
      throw new Error("Unexpected health status");
    } catch {
      clearTimeout(abortTimer);
      clearTimeout(showTimer);

      if (!mountedRef.current) return;

      if (retryCountRef.current < 4) {
        retryCountRef.current += 1;
        addTimer(() => {
          if (mountedRef.current) checkHealth();
        }, 2500);
      } else {
        // Show unavailable toast, but auto-dismiss after 8 s
        setIsWaking(false);
        setIsUnavailable(true);
        setShow(true);
        addTimer(() => {
          if (mountedRef.current) setShow(false);
        }, 8000);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    checkHealth();
    return () => {
      mountedRef.current = false;
      clearAllTimers();
    };
  }, [checkHealth]);

  if (!show) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
        show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
    >
      <div className="bg-white dark:bg-[#0A1420] border border-gray-200 dark:border-gray-800 rounded-2xl px-5 py-3 shadow-xl flex items-center space-x-3 max-w-sm">
        {isUnavailable ? (
          <>
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-900 dark:text-gray-100">Connecting to live telemetry…</p>
              <p className="text-[11px] text-gray-500">Telemetry engine establishing connection smoothly.</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  retryCountRef.current = 0;
                  setIsUnavailable(false);
                  checkHealth();
                }}
                className="px-2.5 py-1 text-xs font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-200 rounded-lg transition-colors flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
              <button
                onClick={() => setShow(false)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-lg transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        ) : isWaking ? (
          <>
            <svg
              className="animate-spin h-4 w-4 text-indigo-500 shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <div className="flex-1">
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                Connecting to live telemetry…
              </span>
              <span className="block text-[10px] text-gray-500">
                Backend warming up — establishing live connection.
              </span>
            </div>
            <button
              onClick={() => setShow(false)}
              className="p-1 text-gray-400 hover:text-gray-700 rounded-lg transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
