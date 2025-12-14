"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, BarChart3, User, ArrowLeft } from "lucide-react";

interface NavItem {
    href: string;
    label: string;
    icon: React.ReactNode;
}

const navItems: NavItem[] = [
    { href: "/", label: "Home", icon: <Home className="w-4 h-4" /> },
    { href: "/dashboard/manager", label: "Manager Dashboard", icon: <BarChart3 className="w-4 h-4" /> },
    { href: "/dashboard/interviewer", label: "Interviewer Analytics", icon: <Users className="w-4 h-4" /> },
];

export default function DashboardNav() {
    const pathname = usePathname();

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/10">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                {/* Logo / Brand */}
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">P</span>
                    </div>
                    <span className="text-white font-semibold tracking-tight group-hover:text-purple-300 transition-colors">
                        Pluto
                    </span>
                </Link>

                {/* Navigation Links */}
                <div className="flex items-center gap-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                                        ? "bg-white/10 text-white"
                                        : "text-white/50 hover:text-white hover:bg-white/5"
                                    }`}
                            >
                                {item.icon}
                                <span className="hidden md:inline">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>

                {/* Right side - could add user menu later */}
                <div className="w-24" /> {/* Spacer for balance */}
            </div>
        </nav>
    );
}
