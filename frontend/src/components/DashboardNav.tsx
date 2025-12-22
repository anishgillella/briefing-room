"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, BarChart3, TrendingUp } from "lucide-react";

export default function DashboardNav() {
    const pathname = usePathname();
    const [rankingsHref, setRankingsHref] = useState("/");

    // Get current session ID from sessionStorage (client-side only)
    useEffect(() => {
        const sessionId = sessionStorage.getItem("currentSessionId");
        if (sessionId) {
            setRankingsHref(`/rankings/${sessionId}`);
        }
    }, []);

    // Check if we're on a rankings page
    const isRankingsActive = pathname.startsWith("/rankings") || pathname === "/";

    const navItems = [
        { href: rankingsHref, label: "Rankings", icon: <TrendingUp className="w-4 h-4" />, isActive: isRankingsActive },
        { href: "/dashboard/manager", label: "Manager", icon: <BarChart3 className="w-4 h-4" />, isActive: pathname === "/dashboard/manager" },
        { href: "/dashboard/interviewer", label: "Interviewer", icon: <Users className="w-4 h-4" />, isActive: pathname === "/dashboard/interviewer" },
    ];

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/10">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                {/* Logo / Brand */}
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">B</span>
                    </div>
                    <span className="text-white font-semibold tracking-tight group-hover:text-purple-300 transition-colors">
                        Briefing Room
                    </span>
                </Link>

                {/* Navigation Links */}
                <div className="flex items-center gap-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.label}
                            href={item.href}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${item.isActive
                                ? "bg-white/10 text-white"
                                : "text-white/50 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            {item.icon}
                            <span className="hidden md:inline">{item.label}</span>
                        </Link>
                    ))}
                </div>

                {/* Right side - New Upload button */}
                <Link
                    href="/"
                    className="text-xs text-white/40 hover:text-white/60 flex items-center gap-1"
                >
                    <Home className="w-3 h-3" /> New Upload
                </Link>
            </div>
        </nav>
    );
}

