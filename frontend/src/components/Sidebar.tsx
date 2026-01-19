"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  ChevronLeft,
  ChevronRight,
  LogOut,
  BarChart3,
  UserCheck,
  Calendar,
  ChevronDown,
  Video,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { SimpleTooltip } from "@/components/ui/tooltip";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  children?: { label: string; href: string; icon: React.ReactNode }[];
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard className="w-5 h-5" />,
    children: [
      {
        label: "Manager",
        href: "/dashboard/manager",
        icon: <BarChart3 className="w-4 h-4" />,
      },
      {
        label: "Interviewer",
        href: "/dashboard/interviewer",
        icon: <UserCheck className="w-4 h-4" />,
      },
      {
        label: "Availability",
        href: "/dashboard/availability",
        icon: <Calendar className="w-4 h-4" />,
      },
    ],
  },
  {
    label: "Jobs",
    href: "/jobs",
    icon: <Briefcase className="w-5 h-5" />,
  },
  {
    label: "Candidates",
    href: "/talent-pool",
    icon: <Users className="w-5 h-5" />,
  },
  {
    label: "Interviews",
    href: "/interviews",
    icon: <Video className="w-5 h-5" />,
  },
];

interface SidebarProps {
  defaultCollapsed?: boolean;
}

export default function Sidebar({ defaultCollapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const { recruiter, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Persist collapsed state
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored !== null) {
      setIsCollapsed(stored === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(isCollapsed));
  }, [isCollapsed]);

  // Auto-expand parent if child is active
  useEffect(() => {
    navItems.forEach((item) => {
      if (item.children) {
        const isChildActive = item.children.some((child) =>
          pathname.startsWith(child.href)
        );
        if (isChildActive && !expandedItems.includes(item.href)) {
          setExpandedItems((prev) => [...prev, item.href]);
        }
      }
    });
  }, [pathname, expandedItems]);

  const toggleExpanded = (href: string) => {
    setExpandedItems((prev) =>
      prev.includes(href)
        ? prev.filter((item) => item !== href)
        : [...prev, href]
    );
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 72 : 260 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed top-0 left-0 h-full bg-white/80 backdrop-blur-xl border-r border-slate-200 z-40 flex flex-col shadow-sm"
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-slate-100">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 group"
        >
          <motion.div
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Sparkles className="w-5 h-5 text-white" />
          </motion.div>
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="text-base font-semibold text-slate-900 tracking-tight whitespace-nowrap"
              >
                Briefing Room
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto no-scrollbar">
        <ul className="space-y-1">
          {navItems.map((item, index) => {
            const active = isActive(item.href);
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedItems.includes(item.href);
            const isHovered = hoveredItem === item.href;

            const NavContent = (
              <motion.div
                initial={false}
                animate={{
                  backgroundColor: active
                    ? "rgba(99, 102, 241, 0.1)"
                    : isHovered
                    ? "rgba(0, 0, 0, 0.03)"
                    : "transparent",
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors relative overflow-hidden",
                  active ? "text-slate-900" : "text-slate-500"
                )}
                onHoverStart={() => setHoveredItem(item.href)}
                onHoverEnd={() => setHoveredItem(null)}
              >
                {/* Active indicator */}
                {active && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-full bg-indigo-500"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}

                {/* Icon */}
                <motion.span
                  className={cn(
                    "shrink-0 relative z-10",
                    active ? "text-indigo-600" : "text-slate-400"
                  )}
                  animate={{ scale: isHovered && !active ? 1.1 : 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  {item.icon}
                </motion.span>

                {/* Label */}
                <AnimatePresence mode="wait">
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15, delay: index * 0.02 }}
                      className="flex-1 text-left text-sm font-medium whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>

              </motion.div>
            );

            return (
              <motion.li
                key={item.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                {hasChildren ? (
                  <>
                    {isCollapsed ? (
                      <SimpleTooltip content={item.label} side="right">
                        <Link
                          href={item.href}
                          onClick={(e) => {
                            e.preventDefault();
                            setIsCollapsed(false);
                            setExpandedItems([item.href]);
                          }}
                          className="w-full block"
                        >
                          {NavContent}
                        </Link>
                      </SimpleTooltip>
                    ) : (
                      <div className="flex items-center">
                        <Link href={item.href} className="flex-1 block">
                          {NavContent}
                        </Link>
                        <button
                          onClick={() => toggleExpanded(item.href)}
                          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          <motion.span
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          </motion.span>
                        </button>
                      </div>
                    )}

                    {/* Children */}
                    <AnimatePresence>
                      {!isCollapsed && isExpanded && item.children && (
                        <motion.ul
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="mt-1 ml-4 pl-4 border-l border-slate-200 space-y-1 overflow-hidden"
                        >
                          {item.children.map((child, childIndex) => {
                            const childActive = pathname === child.href;
                            return (
                              <motion.li
                                key={child.href}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: childIndex * 0.05 }}
                              >
                                <Link
                                  href={child.href}
                                  className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm group",
                                    childActive
                                      ? "bg-indigo-50 text-indigo-700"
                                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "transition-transform group-hover:scale-110",
                                      childActive ? "text-indigo-600" : ""
                                    )}
                                  >
                                    {child.icon}
                                  </span>
                                  <span>{child.label}</span>
                                </Link>
                              </motion.li>
                            );
                          })}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </>
                ) : isCollapsed ? (
                  <SimpleTooltip content={item.label} side="right">
                    <Link href={item.href} className="block">
                      {NavContent}
                    </Link>
                  </SimpleTooltip>
                ) : (
                  <Link href={item.href} className="block">
                    {NavContent}
                  </Link>
                )}
              </motion.li>
            );
          })}
        </ul>
      </nav>

      {/* User Section & Toggle */}
      <div className="border-t border-slate-100 p-3 space-y-2">
        {/* User Info */}
        {recruiter && (
          <motion.div
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100",
              isCollapsed ? "justify-center" : ""
            )}
            whileHover={{ backgroundColor: "rgba(241, 245, 249, 1)" }}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold shrink-0 shadow-lg shadow-indigo-500/30">
              {recruiter.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <AnimatePresence mode="wait">
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex-1 min-w-0"
                >
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {recruiter.name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {recruiter.email}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Logout Button */}
        {isCollapsed ? (
          <SimpleTooltip content="Sign out" side="right">
            <motion.button
              onClick={logout}
              className="w-full flex items-center justify-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <LogOut className="w-5 h-5 shrink-0" />
            </motion.button>
          </SimpleTooltip>
        ) : (
          <motion.button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="text-sm">Sign out</span>
          </motion.button>
        )}

        {/* Collapse Toggle */}
        <motion.button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all",
            isCollapsed ? "justify-center" : ""
          )}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <motion.span
            animate={{ rotate: isCollapsed ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronLeft className="w-5 h-5 shrink-0" />
          </motion.span>
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm"
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </motion.aside>
  );
}
