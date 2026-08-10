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

    const checkHealth = async () => {
      // If the backend doesn't respond within 1.5s, assume it's waking up
      timeoutId = setTimeout(() => {
        setIsWaking(true);
        setShow(true);
      }, 1500);

      try {
        await api.get("/health");
        // Success!
        sessionStorage.setItem("backend_awake", "true");
      } catch (err) {
        console.error("Health check failed", err);
      } finally {
        clearTimeout(timeoutId);
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
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-500 ${
        isWaking ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="bg-white dark:bg-[#0A1420] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-2xl flex items-center space-x-4 max-w-sm">
        <div className="relative flex h-10 w-10">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-10 w-10 bg-blue-500 items-center justify-center">
            <svg
              className="animate-spin h-5 w-5 text-white"
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
          </span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Waking up backend...
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Render free-tier instances may take 1-3 minutes to start. Please hold on.
          </p>
        </div>
      </div>
    </div>
  );
}
