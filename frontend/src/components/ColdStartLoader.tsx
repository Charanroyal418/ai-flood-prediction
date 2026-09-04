"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import api from "@/lib/api";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function ColdStartLoader() {
  const [show, setShow] = useState(false);
  const [isWaking, setIsWaking] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const retryCountRef = useRef(0);
  const mountedRef = useRef(true);

  const checkHealth = useCallback(async () => {
    if (typeof window !== "undefined" && sessionStorage.getItem("backend_awake") === "true") {
      setIsWaking(false);
      setShow(false);
      return;
    }

    setIsUnavailable(false);
    const showTimer = setTimeout(() => {
      if (mountedRef.current && !sessionStorage.getItem("backend_awake")) {
        setIsWaking(true);
        setShow(true);
      }
    }, 1200);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await api.get("/api/v1/health", {
        timeout: 8000,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      clearTimeout(showTimer);

      const status = res?.data?.status || res?.status;
      if (status === "online" || status === "ok" || res?.status === 200) {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("backend_awake", "true");
        }
        setIsWaking(false);
        setIsUnavailable(false);
        setTimeout(() => {
          if (mountedRef.current) setShow(false);
        }, 300);
        return;
      }
      throw new Error("Invalid status");
    } catch {
      clearTimeout(timeoutId);
      clearTimeout(showTimer);

      if (retryCountRef.current < 3) {
        retryCountRef.current += 1;
        setTimeout(() => {
          if (mountedRef.current) checkHealth();
        }, 1500);
      } else {
        if (mountedRef.current) {
          setIsWaking(false);
          setIsUnavailable(true);
          setShow(true);
        }
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    checkHealth();
    return () => {
      mountedRef.current = false;
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
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-900 dark:text-gray-100">Backend unavailable</p>
              <p className="text-[11px] text-gray-500">Service is not responding. Please retry.</p>
            </div>
            <button
              onClick={() => {
                retryCountRef.current = 0;
                checkHealth();
              }}
              className="px-2.5 py-1 text-xs font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-200 rounded-lg transition-colors flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </>
        ) : isWaking ? (
          <>
            <svg
              className="animate-spin h-4 w-4 text-signal-500 shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <div className="flex-1">
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                Waking up backend…
              </span>
              <span className="block text-[10px] text-gray-500">
                Attempt {retryCountRef.current + 1} of 3 (8s timeout)
              </span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
