"use client";

import InterviewerDashboard from "@/components/InterviewerDashboard";
import AppLayout from "@/components/AppLayout";

export default function InterviewerDashboardPage() {
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <InterviewerDashboard />
      </div>
    </AppLayout>
  );
}
