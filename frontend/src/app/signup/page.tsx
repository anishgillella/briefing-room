"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/auth?tab=signup");
  }, [router]);

  return (
    <main className="min-h-screen bg-[#070A12] flex items-center justify-center">
      <div
        className="w-12 h-12 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin"
      />
    </main>
  );
}
