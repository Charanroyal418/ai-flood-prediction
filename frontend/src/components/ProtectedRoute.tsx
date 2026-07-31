"use client";

/**
 * ProtectedRoute — Role-aware route protection
 * ==============================================
 * Wraps dashboard routes that require authentication.
 * Redirects to /login if not authenticated.
 * Optionally restricts to specific roles.
 */
import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth, UserRole } from "@/context/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
  /** If provided, user must have one of these roles */
  roles?: UserRole[];
  /** Where to redirect on auth failure (default: /login) */
  redirectTo?: string;
}

export default function ProtectedRoute({
  children,
  roles,
  redirectTo = "/login",
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace(redirectTo);
      return;
    }

    if (roles && user && !roles.includes(user.role as UserRole)) {
      // User is authenticated but lacks required role
      router.replace("/dashboard?error=insufficient_permissions");
    }
  }, [isAuthenticated, isLoading, user, roles, redirectTo, router]);

  // Show nothing while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Authenticating...</p>
        </div>
      </div>
    );
  }

  // Redirect is in progress, render nothing
  if (!isAuthenticated) return null;

  return <>{children}</>;
}
