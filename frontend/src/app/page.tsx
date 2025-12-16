"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to onboarding flow
        router.replace("/onboard");
    }, [router]);

    return (
        <main className="min-h-screen gradient-bg flex items-center justify-center">
            <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <span className="text-2xl">⚛️</span>
                </div>
                <p className="text-white/50">Loading...</p>
            </div>
        </main>
    );
}
