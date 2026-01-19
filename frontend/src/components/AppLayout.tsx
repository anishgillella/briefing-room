"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "./Sidebar";

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
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
      </main>
    );
  }

  // Don't render for unauthenticated users (they'll be redirected)
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
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
