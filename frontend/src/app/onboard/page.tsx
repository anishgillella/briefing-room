"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy redirect page.
 * The /onboard flow has been replaced with the streamlined job creation at /jobs/new.
 * This page redirects users to the new location.
 */
export default function OnboardRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new job creation page with voice parameter
    router.replace("/jobs/new?voice=true");
  }, [router]);

  return (
    <main className="min-h-screen gradient-bg flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/60">Redirecting to job creation...</p>
      </div>
    </main>
  );
}
