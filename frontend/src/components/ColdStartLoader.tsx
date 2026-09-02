"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

export default function ColdStartLoader() {
  const [show, setShow] = useState(false);
  const [isWaking, setIsWaking] = useState(false);

  useEffect(() => {
    // If we've already confirmed the backend is awake this session, skip.
    if (sessionStorage.getItem("backend_awake")) return;

    let timeoutId: NodeJS.Timeout;
    let maxWaitId: NodeJS.Timeout;

    const checkHealth = async () => {
      // If the backend doesn't respond within 1.5s, assume it's waking up
      timeoutId = setTimeout(() => {
        setIsWaking(true);
        setShow(true);
      }, 1500);

      maxWaitId = setTimeout(() => {
        setIsWaking(false);
        setTimeout(() => setShow(false), 500);
      }, 8000);

      try {
        await api.get("/health", { timeout: 8000 });
        // Success!
        sessionStorage.setItem("backend_awake", "true");
      } catch (err) {
        console.error("Health check failed", err);
      } finally {
        clearTimeout(timeoutId);
        clearTimeout(maxWaitId);
        setIsWaking(false);
        // Fade out
        setTimeout(() => setShow(false), 500);
      }
    };

    checkHealth();
  }, []);

  if (!show) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
        isWaking ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
    >
      <div className="bg-white dark:bg-[#0A1420] border border-gray-200 dark:border-gray-800 rounded-full px-4 py-2 shadow-lg flex items-center space-x-3">
        <svg
          className="animate-spin h-4 w-4 text-signal-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Connecting...
        </span>
      </div>
    </div>
  );
}
