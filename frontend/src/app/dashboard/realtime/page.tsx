"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function RealtimePage() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard"); }, []);
  return null;
}
