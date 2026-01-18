"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

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
  }, [pathname]);

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
    <aside
      className={`fixed top-0 left-0 h-full bg-[#0a0a0f] border-r border-white/5 z-40 transition-all duration-300 flex flex-col ${
        isCollapsed ? "w-[72px]" : "w-[260px]"
      }`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-white/5">
        <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-white/10 shrink-0">
            <span className="text-base">⚛️</span>
          </div>
          {!isCollapsed && (
            <span className="text-base font-medium text-white tracking-wide">
              Briefing Room
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto custom-scrollbar">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedItems.includes(item.href);

            return (
              <li key={item.href}>
                {hasChildren ? (
                  <>
                    <button
                      onClick={() => {
                        if (isCollapsed) {
                          setIsCollapsed(false);
                          setExpandedItems([item.href]);
                        } else {
                          toggleExpanded(item.href);
                        }
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
                        active
                          ? "bg-white/10 text-white"
                          : "text-white/50 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <span
                        className={`shrink-0 ${
                          active ? "text-indigo-400" : "text-white/50 group-hover:text-white/80"
                        }`}
                      >
                        {item.icon}
                      </span>
                      {!isCollapsed && (
                        <>
                          <span className="flex-1 text-left text-sm font-medium">
                            {item.label}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </>
                      )}
                    </button>
                    {/* Children */}
                    {!isCollapsed && isExpanded && item.children && (
                      <ul className="mt-1 ml-4 pl-4 border-l border-white/10 space-y-1">
                        {item.children.map((child) => {
                          const childActive = pathname === child.href;
                          return (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${
                                  childActive
                                    ? "bg-indigo-500/10 text-indigo-300"
                                    : "text-white/40 hover:text-white hover:bg-white/5"
                                }`}
                              >
                                <span className={childActive ? "text-indigo-400" : ""}>
                                  {child.icon}
                                </span>
                                <span>{child.label}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
                      active
                        ? "bg-white/10 text-white"
                        : "text-white/50 hover:text-white hover:bg-white/5"
                    }`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <span
                      className={`shrink-0 ${
                        active ? "text-indigo-400" : "text-white/50 group-hover:text-white/80"
                      }`}
                    >
                      {item.icon}
                    </span>
                    {!isCollapsed && (
                      <span className="text-sm font-medium">{item.label}</span>
                    )}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Section & Toggle */}
      <div className="border-t border-white/5 p-3 space-y-2">
        {/* User Info */}
        {recruiter && (
          <div
            className={`flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 ${
              isCollapsed ? "justify-center" : ""
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium shrink-0">
              {recruiter.name?.charAt(0).toUpperCase() || "U"}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {recruiter.name}
                </p>
                <p className="text-xs text-white/40 truncate">{recruiter.email}</p>
              </div>
            )}
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={logout}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-all ${
            isCollapsed ? "justify-center" : ""
          }`}
          title={isCollapsed ? "Sign out" : undefined}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span className="text-sm">Sign out</span>}
        </button>

        {/* Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-white/30 hover:text-white hover:bg-white/5 transition-all ${
            isCollapsed ? "justify-center" : ""
          }`}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5 shrink-0" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5 shrink-0" />
              <span className="text-sm">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
