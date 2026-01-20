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

// =============================================================================
// DESIGN TOKENS - Premium Dark Theme
// =============================================================================
const tokens = {
  // Sidebar specific
  sidebarBg: "#0A0F1C",
  sidebarBgSubtle: "#0D1221",
  sidebarBorder: "rgba(255,255,255,0.06)",
  sidebarShadow: "4px 0 24px rgba(0,0,0,0.5)",

  // Text
  textPrimary: "#F1F5F9",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",

  // Brand
  brandPrimary: "#6366F1",
  brandGlow: "rgba(99,102,241,0.15)",
  brandGlowStrong: "rgba(99,102,241,0.25)",

  // Interactive
  hoverBg: "rgba(255,255,255,0.04)",
  activeBg: "linear-gradient(90deg, rgba(99,102,241,0.15), rgba(99,102,241,0.05))",
  activeIconBg: "rgba(99,102,241,0.2)",
};

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
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
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className="fixed top-0 left-0 h-full z-40 flex flex-col"
      style={{
        backgroundColor: tokens.sidebarBg,
        borderRight: `1px solid ${tokens.sidebarBorder}`,
        boxShadow: tokens.sidebarShadow,
      }}
    >
      {/* Subtle gradient overlay for depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(180deg, ${tokens.sidebarBgSubtle} 0%, transparent 30%)`,
        }}
      />

      {/* Brand Header */}
      <div
        className="relative h-16 flex items-center px-4 shrink-0"
        style={{ borderBottom: `1px solid ${tokens.sidebarBorder}` }}
      >
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <motion.div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${tokens.brandPrimary}20, ${tokens.brandPrimary}10)`,
              border: `1px solid ${tokens.brandPrimary}30`,
            }}
            whileHover={{
              scale: 1.05,
              boxShadow: `0 0 20px ${tokens.brandGlow}`,
            }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <Sparkles className="w-5 h-5" style={{ color: tokens.brandPrimary }} />
            {/* Inner glow */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{
                background: `radial-gradient(circle at center, ${tokens.brandGlow}, transparent 70%)`,
              }}
            />
          </motion.div>
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col"
              >
                <span
                  className="text-base font-semibold tracking-tight whitespace-nowrap"
                  style={{ color: tokens.textPrimary }}
                >
                  Briefing Room
                </span>
                <span
                  className="text-[10px] uppercase tracking-widest"
                  style={{ color: tokens.textMuted }}
                >
                  Hiring Platform
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="relative flex-1 py-4 px-3 overflow-y-auto no-scrollbar">
        <ul className="space-y-1">
          {navItems.map((item, index) => {
            const active = isActive(item.href);
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedItems.includes(item.href);
            const isHovered = hoveredItem === item.href;

            const NavContent = (
              <motion.div
                className={cn(
                  "w-full flex items-center gap-3 rounded-xl relative overflow-hidden cursor-pointer",
                  isCollapsed ? "px-3 py-2.5 justify-center" : "px-3 py-2.5"
                )}
                style={{
                  background: active
                    ? tokens.activeBg
                    : isHovered
                    ? tokens.hoverBg
                    : "transparent",
                }}
                onHoverStart={() => setHoveredItem(item.href)}
                onHoverEnd={() => setHoveredItem(null)}
                animate={{
                  x: isHovered && !active ? 2 : 0,
                }}
                transition={{ duration: 0.15, ease: "easeOut" }}
              >
                {/* Active indicator bar */}
                {active && (
                  <motion.div
                    layoutId="activeNavIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-full"
                    style={{ backgroundColor: tokens.brandPrimary }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  />
                )}

                {/* Icon */}
                <motion.span
                  className="shrink-0 relative z-10 flex items-center justify-center"
                  style={{
                    color: active
                      ? tokens.brandPrimary
                      : isHovered
                      ? tokens.textPrimary
                      : tokens.textMuted,
                  }}
                >
                  {active ? (
                    <span
                      className="p-1.5 rounded-lg"
                      style={{ backgroundColor: tokens.activeIconBg }}
                    >
                      {item.icon}
                    </span>
                  ) : (
                    item.icon
                  )}
                </motion.span>

                {/* Label */}
                <AnimatePresence mode="wait">
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15, delay: index * 0.02 }}
                      className={cn(
                        "flex-1 text-left text-sm whitespace-nowrap transition-colors duration-150",
                        active ? "font-semibold" : "font-medium"
                      )}
                      style={{
                        color: active
                          ? tokens.textPrimary
                          : isHovered
                          ? tokens.textPrimary
                          : tokens.textSecondary,
                      }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Badge */}
                {item.badge && !isCollapsed && (
                  <span
                    className="px-2 py-0.5 text-[10px] font-semibold rounded-full"
                    style={{
                      backgroundColor: tokens.brandGlow,
                      color: tokens.brandPrimary,
                    }}
                  >
                    {item.badge}
                  </span>
                )}
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
                          className="p-2 rounded-lg transition-all duration-150"
                          style={{ color: tokens.textMuted }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = tokens.hoverBg;
                            e.currentTarget.style.color = tokens.textPrimary;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                            e.currentTarget.style.color = tokens.textMuted;
                          }}
                        >
                          <motion.span
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="block"
                          >
                            <ChevronDown className="w-4 h-4" />
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
                          transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                          className="mt-1 ml-4 pl-4 space-y-1 overflow-hidden"
                          style={{ borderLeft: `1px solid ${tokens.sidebarBorder}` }}
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
                                  className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 text-sm group"
                                  style={{
                                    backgroundColor: childActive
                                      ? tokens.brandGlow
                                      : "transparent",
                                    color: childActive
                                      ? tokens.brandPrimary
                                      : tokens.textMuted,
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!childActive) {
                                      e.currentTarget.style.backgroundColor =
                                        tokens.hoverBg;
                                      e.currentTarget.style.color = tokens.textPrimary;
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!childActive) {
                                      e.currentTarget.style.backgroundColor =
                                        "transparent";
                                      e.currentTarget.style.color = tokens.textMuted;
                                    }
                                  }}
                                >
                                  <span className="transition-transform group-hover:scale-110">
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

      {/* Footer Section */}
      <div
        className="relative p-3 space-y-2 shrink-0"
        style={{ borderTop: `1px solid ${tokens.sidebarBorder}` }}
      >
        {/* User Info */}
        {recruiter && (
          <motion.div
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150",
              isCollapsed ? "justify-center" : ""
            )}
            style={{ backgroundColor: "rgba(255,255,255,0.02)" }}
            whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-semibold shrink-0"
              style={{
                background: `linear-gradient(135deg, ${tokens.brandPrimary}30, ${tokens.brandPrimary}15)`,
                color: tokens.brandPrimary,
                border: `1px solid ${tokens.brandPrimary}20`,
              }}
            >
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
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: tokens.textPrimary }}
                  >
                    {recruiter.name}
                  </p>
                  <p
                    className="text-xs truncate"
                    style={{ color: tokens.textMuted }}
                  >
                    {recruiter.email}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Sign Out Button */}
        {isCollapsed ? (
          <SimpleTooltip content="Sign out" side="right">
            <motion.button
              onClick={logout}
              className="w-full flex items-center justify-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
              style={{ color: tokens.textMuted }}
              whileHover={{
                backgroundColor: tokens.hoverBg,
                color: tokens.textPrimary,
              }}
              whileTap={{ scale: 0.98 }}
            >
              <LogOut className="w-5 h-5 shrink-0" />
            </motion.button>
          </SimpleTooltip>
        ) : (
          <motion.button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
            style={{ color: tokens.textMuted }}
            whileHover={{
              backgroundColor: tokens.hoverBg,
              color: tokens.textPrimary,
            }}
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
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150",
            isCollapsed ? "justify-center" : ""
          )}
          style={{ color: tokens.textMuted }}
          whileHover={{
            backgroundColor: tokens.hoverBg,
            color: tokens.textSecondary,
          }}
          whileTap={{ scale: 0.99 }}
        >
          <motion.span
            animate={{ rotate: isCollapsed ? 180 : 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
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
