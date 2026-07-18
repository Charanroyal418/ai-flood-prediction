"use client";

// Redirect to /dashboard/predictions — analytics now lives in AI Prediction Engine
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PerformancePage() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard/predictions"); }, []);
  return null;
}
