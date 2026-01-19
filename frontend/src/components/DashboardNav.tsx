"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, Users, BarChart3, TrendingUp, Sparkles } from "lucide-react";

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
    {
      href: rankingsHref,
      label: "Rankings",
      icon: <TrendingUp className="w-4 h-4" />,
      isActive: isRankingsActive,
    },
    {
      href: "/dashboard/manager",
      label: "Manager",
      icon: <BarChart3 className="w-4 h-4" />,
      isActive: pathname === "/dashboard/manager",
    },
    {
      href: "/dashboard/interviewer",
      label: "Interviewer",
      icon: <Users className="w-4 h-4" />,
      isActive: pathname === "/dashboard/interviewer",
    },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo / Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <motion.div
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30"
            whileHover={{ scale: 1.05, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
          >
            <Sparkles className="w-5 h-5 text-white" />
          </motion.div>
          <span className="text-slate-900 font-semibold tracking-tight group-hover:text-indigo-700 transition-colors">
            Briefing Room
          </span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                item.isActive
                  ? "text-indigo-700 bg-indigo-50"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              {item.icon}
              <span className="hidden md:inline">{item.label}</span>
              {item.isActive && (
                <motion.div
                  className="absolute inset-0 rounded-xl bg-indigo-50 -z-10"
                  layoutId="activeNavTab"
                  transition={{ type: "spring" as const, stiffness: 400, damping: 30 }}
                />
              )}
            </Link>
          ))}
        </div>

        {/* Right side - New Upload button */}
        <Link
          href="/"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all"
        >
          <Home className="w-3.5 h-3.5" />
          <span>New Upload</span>
        </Link>
      </div>
    </nav>
  );
}
