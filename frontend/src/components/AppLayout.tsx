"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "./Sidebar";

// =============================================================================
// DESIGN TOKENS - Premium Dark Theme
// =============================================================================
const tokens = {
  bgApp: "#070B14",
  brandPrimary: "#6366F1",
};

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Check localStorage for sidebar state
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored !== null) {
      setSidebarCollapsed(stored === "true");
    }

    // Listen for changes to sidebar state
    const handleStorage = () => {
      const updated = localStorage.getItem("sidebar-collapsed");
      if (updated !== null) {
        setSidebarCollapsed(updated === "true");
      }
    };

    window.addEventListener("storage", handleStorage);

    // Also poll for changes (for same-tab updates)
    const interval = setInterval(() => {
      const updated = localStorage.getItem("sidebar-collapsed");
      if (updated !== null && (updated === "true") !== sidebarCollapsed) {
        setSidebarCollapsed(updated === "true");
      }
    }, 100);

    return () => {
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
    };
  }, [sidebarCollapsed]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: tokens.bgApp }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-10 h-10 border-2 rounded-full animate-spin"
            style={{
              borderColor: `${tokens.brandPrimary}20`,
              borderTopColor: tokens.brandPrimary,
            }}
          />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </main>
    );
  }

  // Don't render for unauthenticated users (they'll be redirected)
  if (!isAuthenticated) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: tokens.bgApp }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-10 h-10 border-2 rounded-full animate-spin"
            style={{
              borderColor: `${tokens.brandPrimary}20`,
              borderTopColor: tokens.brandPrimary,
            }}
          />
          <p className="text-sm text-slate-500">Redirecting...</p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: tokens.bgApp }}>
      {/* Edge vignette - pulls focus toward content */}
      <div
        className="fixed inset-0 pointer-events-none z-30"
        style={{
          background: `
            linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 15%),
            linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 15%),
            linear-gradient(to right, rgba(0,0,0,0.3) 0%, transparent 10%),
            linear-gradient(to left, rgba(0,0,0,0.2) 0%, transparent 10%)
          `,
        }}
      />

      <Sidebar defaultCollapsed={sidebarCollapsed} />
      <main
        className={`min-h-screen transition-all duration-300 ${
          sidebarCollapsed ? "pl-[72px]" : "pl-[260px]"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
