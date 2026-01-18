"use client";

import ManagerDashboard from "@/components/ManagerDashboard";
import AppLayout from "@/components/AppLayout";

export default function ManagerDashboardPage() {
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <ManagerDashboard />
      </div>
    </AppLayout>
  );
}
