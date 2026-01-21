"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import {
  Users,
  Search,
  ChevronRight,
  MapPin,
  Building2,
  Briefcase,
  X,
  Star,
  GitBranch,
  Command,
  TrendingUp,
  Clock,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { tokens, springConfig, easeOutCustom, getTierConfig, getStatusConfig } from "@/lib/design-tokens";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PersonSummary {
  id: string;
  name: string;
  email: string | null;
  headline: string | null;
  current_title: string | null;
  current_company: string | null;
  location: string | null;
  skills: string[];
  linkedin_url: string | null;
  application_count: number;
  tier?: string | null;
}

interface JobOption {
  id: string;
  title: string;
  candidate_count: number;
}

interface FilterOptions {
  skills: string[];
  locations: string[];
  companies: string[];
  jobs: JobOption[];
  tiers: string[];
  pipeline_statuses: string[];
  total_persons: number;
}

// =============================================================================
// STAT CARD - Premium Design
// =============================================================================
function StatCard({
  icon: Icon,
  value,
  label,
  trend,
  variant = "default",
  delay = 0,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  trend?: { value: number; isPositive: boolean };
  variant?: "default" | "success" | "warning" | "danger";
  delay?: number;
}) {
  const variantStyles = {
    default: {
      iconBg: tokens.brandGlow,
      iconColor: tokens.brandPrimary,
      glow: "none",
    },
    success: {
      iconBg: "rgba(16,185,129,0.15)",
      iconColor: tokens.statusSuccess,
      glow: "none",
    },
    warning: {
      iconBg: "rgba(245,158,11,0.15)",
      iconColor: tokens.statusWarning,
      glow: "none",
    },
    danger: {
      iconBg: "rgba(239,68,68,0.1)",
      iconColor: tokens.statusDanger,
      glow: "inset 0 0 0 1px rgba(239,68,68,0.2), 0 0 20px rgba(239,68,68,0.1)",
    },
  };

  const styles = variantStyles[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: easeOutCustom }}
      whileHover={{
        y: -4,
        transition: springConfig,
      }}
      className="group relative cursor-default"
    >
      <div
        className="relative p-5 rounded-2xl transition-all duration-300"
        style={{
          backgroundColor: tokens.bgSurface,
          border: `1px solid ${tokens.borderDefault}`,
          boxShadow: styles.glow,
        }}
      >
        {/* Hover glow */}
        <div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${styles.iconColor}10, transparent 70%)`,
          }}
        />

        <div className="relative flex items-start justify-between">
          <div className="flex-1">
            <p
              className="text-sm font-medium mb-2"
              style={{ color: tokens.textMuted }}
            >
              {label}
            </p>
            <div className="flex items-baseline gap-3">
              <p
                className="text-3xl font-semibold tracking-tight tabular-nums"
                style={{
                  color: tokens.textPrimary,
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                {value}
              </p>
              {trend && (
                <span
                  className="flex items-center gap-1 text-xs font-medium"
                  style={{
                    color: trend.isPositive
                      ? tokens.statusSuccess
                      : tokens.statusDanger,
                  }}
                >
                  <TrendingUp
                    className={`w-3 h-3 ${!trend.isPositive ? "rotate-180" : ""}`}
                  />
                  {trend.value}%
                </span>
              )}
            </div>
          </div>

          {/* Icon */}
          <div
            className="p-3 rounded-xl transition-transform duration-300 group-hover:scale-110"
            style={{ backgroundColor: styles.iconBg }}
          >
            <Icon className="w-5 h-5" style={{ color: styles.iconColor }} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// COMMAND BAR
// =============================================================================
function CommandBar({
  searchQuery,
  setSearchQuery,
  activeFilterCount,
  showFilters,
  setShowFilters,
}: {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeFilterCount: number;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
}) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("talent-search")?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3, ease: easeOutCustom }}
      className="relative mb-6"
    >
      <div
        className="relative p-4 rounded-2xl backdrop-blur-xl"
        style={{
          backgroundColor: tokens.bgGlass,
          border: `1px solid ${tokens.borderDefault}`,
          boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        }}
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200"
              style={{ color: isSearchFocused ? tokens.textSecondary : tokens.textMuted }}
            />
            <input
              id="talent-search"
              type="text"
              placeholder="Search people..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className="w-full pl-10 pr-20 py-2.5 rounded-xl text-sm transition-all duration-200 outline-none"
              style={{
                backgroundColor: isSearchFocused
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(255,255,255,0.04)",
                border: `1px solid ${isSearchFocused ? tokens.borderFocus : tokens.borderSubtle}`,
                color: tokens.textPrimary,
                boxShadow: isSearchFocused
                  ? `0 0 0 4px ${tokens.brandGlow}`
                  : "none",
              }}
            />
            {/* Keyboard hint */}
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none"
              style={{ color: tokens.textDisabled }}
            >
              <kbd
                className="px-1.5 py-0.5 text-[10px] font-medium rounded"
                style={{
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: `1px solid ${tokens.borderSubtle}`,
                }}
              >
                <Command className="w-2.5 h-2.5 inline" />
              </kbd>
              <kbd
                className="px-1.5 py-0.5 text-[10px] font-medium rounded"
                style={{
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: `1px solid ${tokens.borderSubtle}`,
                }}
              >
                K
              </kbd>
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-16 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/10 transition-colors"
                style={{ color: tokens.textMuted }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Divider */}
          <div
            className="hidden sm:block w-px h-8"
            style={{ backgroundColor: tokens.borderSubtle }}
          />

          {/* Filters Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
            style={{
              backgroundColor: showFilters || activeFilterCount > 0
                ? "rgba(255,255,255,0.08)"
                : "transparent",
              color: showFilters || activeFilterCount > 0
                ? tokens.textPrimary
                : tokens.textMuted,
              border: `1px solid ${showFilters ? tokens.borderHover : tokens.borderSubtle}`,
            }}
          >
            <GitBranch className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span
                className="px-2 py-0.5 text-xs font-semibold rounded-full"
                style={{
                  backgroundColor: tokens.brandGlow,
                  color: tokens.brandPrimary,
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// FILTER PANEL
// =============================================================================
function FilterPanel({
  filterOptions,
  selectedSkills,
  toggleSkill,
  selectedLocation,
  setSelectedLocation,
  selectedCompany,
  setSelectedCompany,
  selectedJob,
  setSelectedJob,
  selectedTier,
  setSelectedTier,
  selectedStatus,
  setSelectedStatus,
  hasActiveFilters,
  clearFilters,
  setPage,
}: {
  filterOptions: FilterOptions;
  selectedSkills: string[];
  toggleSkill: (skill: string) => void;
  selectedLocation: string;
  setSelectedLocation: (loc: string) => void;
  selectedCompany: string;
  setSelectedCompany: (company: string) => void;
  selectedJob: string;
  setSelectedJob: (job: string) => void;
  selectedTier: string;
  setSelectedTier: (tier: string) => void;
  selectedStatus: string;
  setSelectedStatus: (status: string) => void;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  setPage: (page: number) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: easeOutCustom }}
      className="mb-6 overflow-hidden"
    >
      <div
        className="p-6 rounded-2xl space-y-6"
        style={{
          backgroundColor: tokens.bgSurface,
          border: `1px solid ${tokens.borderDefault}`,
        }}
      >
        {/* Active Filters */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm" style={{ color: tokens.textMuted }}>
              Active:
            </span>
            {selectedSkills.map((skill) => (
              <motion.button
                key={skill}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => toggleSkill(skill)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                style={{
                  backgroundColor: tokens.brandGlow,
                  color: tokens.brandPrimary,
                  border: `1px solid ${tokens.brandPrimary}30`,
                }}
              >
                {skill}
                <X className="w-3 h-3" />
              </motion.button>
            ))}
            {selectedLocation && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => { setSelectedLocation(""); setPage(1); }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                style={{
                  backgroundColor: "rgba(16,185,129,0.15)",
                  color: tokens.statusSuccess,
                  border: `1px solid ${tokens.statusSuccess}30`,
                }}
              >
                <MapPin className="w-3 h-3" />
                {selectedLocation}
                <X className="w-3 h-3" />
              </motion.button>
            )}
            {selectedCompany && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => { setSelectedCompany(""); setPage(1); }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                style={{
                  backgroundColor: "rgba(139,92,246,0.15)",
                  color: "#A78BFA",
                  border: "1px solid rgba(139,92,246,0.3)",
                }}
              >
                <Building2 className="w-3 h-3" />
                {selectedCompany}
                <X className="w-3 h-3" />
              </motion.button>
            )}
            {selectedJob && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => { setSelectedJob(""); setPage(1); }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                style={{
                  backgroundColor: "rgba(245,158,11,0.15)",
                  color: tokens.statusWarning,
                  border: `1px solid ${tokens.statusWarning}30`,
                }}
              >
                <Briefcase className="w-3 h-3" />
                {filterOptions.jobs.find(j => j.id === selectedJob)?.title || "Job"}
                <X className="w-3 h-3" />
              </motion.button>
            )}
            {selectedTier && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => { setSelectedTier(""); setPage(1); }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                style={{
                  backgroundColor: getTierConfig(selectedTier).bg,
                  color: getTierConfig(selectedTier).color,
                  border: `1px solid ${getTierConfig(selectedTier).color}30`,
                }}
              >
                <Star className="w-3 h-3" />
                {selectedTier}
                <X className="w-3 h-3" />
              </motion.button>
            )}
            {selectedStatus && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => { setSelectedStatus(""); setPage(1); }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                style={{
                  backgroundColor: getStatusConfig(selectedStatus).bg,
                  color: getStatusConfig(selectedStatus).color,
                  border: `1px solid ${getStatusConfig(selectedStatus).color}30`,
                }}
              >
                <GitBranch className="w-3 h-3" />
                {selectedStatus.replace(/_/g, " ")}
                <X className="w-3 h-3" />
              </motion.button>
            )}
            <button
              onClick={clearFilters}
              className="text-xs underline ml-2 transition-colors"
              style={{ color: tokens.textMuted }}
            >
              Clear all
            </button>
          </div>
        )}

        {/* Filter Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Location */}
          <div>
            <label
              className="text-xs font-medium mb-2 block"
              style={{ color: tokens.textMuted }}
            >
              Location
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => { setSelectedLocation(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 rounded-xl text-sm transition-all outline-none"
              style={{
                backgroundColor: "rgba(255,255,255,0.04)",
                border: `1px solid ${tokens.borderDefault}`,
                color: tokens.textPrimary,
              }}
            >
              <option value="">All Locations</option>
              {filterOptions.locations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* Company */}
          <div>
            <label
              className="text-xs font-medium mb-2 block"
              style={{ color: tokens.textMuted }}
            >
              Company
            </label>
            <select
              value={selectedCompany}
              onChange={(e) => { setSelectedCompany(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 rounded-xl text-sm transition-all outline-none"
              style={{
                backgroundColor: "rgba(255,255,255,0.04)",
                border: `1px solid ${tokens.borderDefault}`,
                color: tokens.textPrimary,
              }}
            >
              <option value="">All Companies</option>
              {filterOptions.companies.map((company) => (
                <option key={company} value={company}>{company}</option>
              ))}
            </select>
          </div>

          {/* Job */}
          {filterOptions.jobs.length > 0 && (
            <div>
              <label
                className="text-xs font-medium mb-2 block"
                style={{ color: tokens.textMuted }}
              >
                Job Position
              </label>
              <select
                value={selectedJob}
                onChange={(e) => { setSelectedJob(e.target.value); setPage(1); }}
                className="w-full px-3 py-2.5 rounded-xl text-sm transition-all outline-none"
                style={{
                  backgroundColor: "rgba(255,255,255,0.04)",
                  border: `1px solid ${tokens.borderDefault}`,
                  color: tokens.textPrimary,
                }}
              >
                <option value="">All Jobs</option>
                {filterOptions.jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title} ({job.candidate_count})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tier */}
          <div>
            <label
              className="text-xs font-medium mb-2 block"
              style={{ color: tokens.textMuted }}
            >
              Candidate Tier
            </label>
            <select
              value={selectedTier}
              onChange={(e) => { setSelectedTier(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 rounded-xl text-sm transition-all outline-none"
              style={{
                backgroundColor: "rgba(255,255,255,0.04)",
                border: `1px solid ${tokens.borderDefault}`,
                color: tokens.textPrimary,
              }}
            >
              <option value="">All Tiers</option>
              {filterOptions.tiers.map((tier) => (
                <option key={tier} value={tier}>{tier}</option>
              ))}
            </select>
          </div>

          {/* Pipeline Status */}
          <div>
            <label
              className="text-xs font-medium mb-2 block"
              style={{ color: tokens.textMuted }}
            >
              Pipeline Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 rounded-xl text-sm transition-all outline-none"
              style={{
                backgroundColor: "rgba(255,255,255,0.04)",
                border: `1px solid ${tokens.borderDefault}`,
                color: tokens.textPrimary,
              }}
            >
              <option value="">All Statuses</option>
              {filterOptions.pipeline_statuses.map((status) => (
                <option key={status} value={status}>
                  {status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Skills */}
        <div>
          <label
            className="text-xs font-medium mb-3 block"
            style={{ color: tokens.textMuted }}
          >
            Skills
          </label>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2">
            {filterOptions.skills.slice(0, 30).map((skill) => (
              <motion.button
                key={skill}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => toggleSkill(skill)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  backgroundColor: selectedSkills.includes(skill)
                    ? tokens.brandGlow
                    : "rgba(255,255,255,0.03)",
                  color: selectedSkills.includes(skill)
                    ? tokens.brandPrimary
                    : tokens.textMuted,
                  border: `1px solid ${selectedSkills.includes(skill)
                    ? `${tokens.brandPrimary}50`
                    : tokens.borderSubtle}`,
                }}
              >
                {skill}
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// PERSON CARD - Premium Design
// =============================================================================
function PersonCard({
  person,
  index,
}: {
  person: PersonSummary;
  index: number;
}) {
  const tierStyle = getTierConfig(person.tier);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.04,
        ease: easeOutCustom,
      }}
      whileHover={{ y: -4 }}
      className="group"
    >
      <Link href={`/talent-pool/${person.id}`}>
        <div
          className="relative rounded-2xl transition-all duration-300 overflow-hidden cursor-pointer h-full"
          style={{
            backgroundColor: tokens.bgCard,
            border: `1px solid ${tokens.borderDefault}`,
          }}
        >
          {/* Hover gradient overlay */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              background: `linear-gradient(135deg, ${tokens.brandGlow} 0%, transparent 60%)`,
            }}
          />

          <div className="relative p-5">
            {/* Header: Avatar + Name + Tier */}
            <div className="flex items-start gap-4 mb-4">
              <UserAvatar name={person.name} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3
                    className="font-semibold truncate transition-colors group-hover:text-indigo-400"
                    style={{ color: tokens.textPrimary }}
                  >
                    {person.name}
                  </h3>
                  {person.tier && (
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase shrink-0"
                      style={{
                        backgroundColor: tierStyle.bg,
                        color: tierStyle.color,
                      }}
                    >
                      {tierStyle.label}
                    </span>
                  )}
                </div>
                {person.headline && (
                  <p
                    className="text-sm truncate mt-0.5"
                    style={{ color: tokens.textSecondary }}
                  >
                    {person.headline}
                  </p>
                )}
                {(person.current_title || person.current_company) && (
                  <p
                    className="text-xs truncate mt-1"
                    style={{ color: tokens.textMuted }}
                  >
                    {person.current_title}
                    {person.current_title && person.current_company && " at "}
                    {person.current_company}
                  </p>
                )}
              </div>
              <ChevronRight
                className="w-4 h-4 flex-shrink-0 transition-transform duration-200 group-hover:translate-x-1"
                style={{ color: tokens.textMuted }}
              />
            </div>

            {/* Meta: Location + Applications */}
            <div className="flex items-center gap-4 mb-4">
              {person.location && (
                <span
                  className="flex items-center gap-1.5 text-xs"
                  style={{ color: tokens.textMuted }}
                >
                  <MapPin className="w-3 h-3" />
                  {person.location}
                </span>
              )}
              {person.application_count > 0 && (
                <span
                  className="flex items-center gap-1.5 text-xs"
                  style={{ color: tokens.textMuted }}
                >
                  <Briefcase className="w-3 h-3" />
                  {person.application_count} application{person.application_count !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Skills */}
            {person.skills && person.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {person.skills.slice(0, 4).map((skill) => (
                  <span
                    key={skill}
                    className="px-2 py-0.5 rounded-md text-[10px] font-medium"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.04)",
                      color: tokens.textSecondary,
                      border: `1px solid ${tokens.borderSubtle}`,
                    }}
                  >
                    {skill}
                  </span>
                ))}
                {person.skills.length > 4 && (
                  <span
                    className="px-2 py-0.5 text-[10px]"
                    style={{ color: tokens.textDisabled }}
                  >
                    +{person.skills.length - 4}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// =============================================================================
// EMPTY STATE
// =============================================================================
function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: easeOutCustom }}
      className="text-center py-20"
    >
      <div
        className="relative inline-flex p-6 rounded-3xl mb-8"
        style={{
          background: `linear-gradient(135deg, ${tokens.brandGlow} 0%, transparent 100%)`,
          border: `1px solid ${tokens.borderDefault}`,
        }}
      >
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <Users className="w-16 h-16" style={{ color: tokens.brandPrimary }} />
        </motion.div>
        <motion.div
          className="absolute -top-2 -right-2"
          animate={{ rotate: [0, 15, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Sparkles className="w-6 h-6" style={{ color: tokens.brandSecondary }} />
        </motion.div>
      </div>

      <h3
        className="text-2xl font-semibold mb-3"
        style={{ color: tokens.textPrimary }}
      >
        {hasFilters ? "No people found" : "Your talent pool is empty"}
      </h3>
      <p
        className="text-base mb-8 max-w-md mx-auto"
        style={{ color: tokens.textSecondary }}
      >
        {hasFilters
          ? "Try adjusting your filters or search query to find more candidates."
          : "Upload candidates to your jobs to start building your talent pool."}
      </p>
    </motion.div>
  );
}

// =============================================================================
// LOADING SKELETON
// =============================================================================
function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="rounded-2xl p-5 animate-pulse"
          style={{
            backgroundColor: tokens.bgCard,
            border: `1px solid ${tokens.borderDefault}`,
          }}
        >
          <div className="flex items-start gap-4 mb-4">
            <div
              className="w-12 h-12 rounded-full"
              style={{ backgroundColor: tokens.bgSurface }}
            />
            <div className="flex-1 space-y-2">
              <div
                className="h-4 rounded w-2/3"
                style={{ backgroundColor: tokens.bgSurface }}
              />
              <div
                className="h-3 rounded w-1/2"
                style={{ backgroundColor: tokens.bgSurface }}
              />
            </div>
          </div>
          <div className="flex gap-2 mb-4">
            <div
              className="h-3 rounded w-24"
              style={{ backgroundColor: tokens.bgSurface }}
            />
            <div
              className="h-3 rounded w-20"
              style={{ backgroundColor: tokens.bgSurface }}
            />
          </div>
          <div className="flex gap-2">
            {[1, 2, 3].map((j) => (
              <div
                key={j}
                className="h-5 rounded w-16"
                style={{ backgroundColor: tokens.bgSurface }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================
export default function TalentPoolPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();

  const [persons, setPersons] = useState<PersonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedJob, setSelectedJob] = useState<string>("");
  const [selectedTier, setSelectedTier] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchFilterOptions();
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchPersons();
    }
  }, [isAuthenticated, token, page, searchQuery, selectedSkills, selectedLocation, selectedCompany, selectedJob, selectedTier, selectedStatus]);

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };

  const fetchFilterOptions = async () => {
    try {
      const response = await fetch(`${API_URL}/api/talent-pool/filters`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setFilterOptions(data);
      }
    } catch (error) {
      console.error("Failed to fetch filter options:", error);
    }
  };

  const fetchPersons = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("page_size", "20");

      if (searchQuery) params.append("query", searchQuery);
      if (selectedSkills.length > 0) params.append("skills", selectedSkills.join(","));
      if (selectedLocation) params.append("location", selectedLocation);
      if (selectedCompany) params.append("company", selectedCompany);
      if (selectedJob) params.append("job_id", selectedJob);
      if (selectedTier) params.append("tier", selectedTier);
      if (selectedStatus) params.append("pipeline_status", selectedStatus);

      const response = await fetch(`${API_URL}/api/talent-pool?${params.toString()}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setPersons(data.persons);
        setTotalPages(data.total_pages);
        setTotal(data.total);
      } else if (response.status === 401) {
        router.push("/login");
      }
    } catch (error) {
      console.error("Failed to fetch persons:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
    setPage(1);
  };

  const clearFilters = () => {
    setSelectedSkills([]);
    setSelectedLocation("");
    setSelectedCompany("");
    setSelectedJob("");
    setSelectedTier("");
    setSelectedStatus("");
    setSearchQuery("");
    setPage(1);
  };

  const hasActiveFilters = Boolean(selectedSkills.length > 0 || selectedLocation || selectedCompany || selectedJob || selectedTier || selectedStatus || searchQuery);
  const activeFilterCount = selectedSkills.length +
    (selectedLocation ? 1 : 0) +
    (selectedCompany ? 1 : 0) +
    (selectedJob ? 1 : 0) +
    (selectedTier ? 1 : 0) +
    (selectedStatus ? 1 : 0);

  // Stats
  const topTierCount = 0; // Would need backend support
  const recentCount = 0; // Would need backend support
  const withAppsCount = persons.filter(p => p.application_count > 0).length;

  return (
    <AppLayout>
      {/* Page Canvas */}
      <div
        className="min-h-screen relative"
        style={{ backgroundColor: tokens.bgApp }}
      >
        {/* Ambient gradient */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse at 70% 10%, ${tokens.brandGlow} 0%, transparent 50%),
              radial-gradient(ellipse at 20% 80%, rgba(139,92,246,0.05) 0%, transparent 50%)
            `,
          }}
        />

        {/* Grain texture */}
        <div
          className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative px-8 py-8 max-w-[1400px] mx-auto"
        >
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOutCustom }}
            className="flex items-start justify-between mb-8"
          >
            <div>
              <h1
                className="text-3xl font-bold tracking-tight mb-2"
                style={{ color: tokens.textPrimary }}
              >
                Talent Pool
              </h1>
              <p className="text-sm" style={{ color: tokens.textSecondary }}>
                {filterOptions?.total_persons || total} people across all your job postings
              </p>
            </div>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={Users}
              value={filterOptions?.total_persons || total}
              label="Total People"
              delay={0.1}
            />
            <StatCard
              icon={Star}
              value={topTierCount}
              label="Top Tier"
              variant="success"
              delay={0.15}
            />
            <StatCard
              icon={Clock}
              value={recentCount}
              label="Added This Week"
              delay={0.2}
            />
            <StatCard
              icon={Briefcase}
              value={withAppsCount}
              label="With Applications"
              delay={0.25}
            />
          </div>

          {/* Command Bar */}
          <CommandBar
            searchQuery={searchQuery}
            setSearchQuery={(q) => { setSearchQuery(q); setPage(1); }}
            activeFilterCount={activeFilterCount}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
          />

          {/* Filter Panel */}
          <AnimatePresence>
            {showFilters && filterOptions && (
              <FilterPanel
                filterOptions={filterOptions}
                selectedSkills={selectedSkills}
                toggleSkill={toggleSkill}
                selectedLocation={selectedLocation}
                setSelectedLocation={setSelectedLocation}
                selectedCompany={selectedCompany}
                setSelectedCompany={setSelectedCompany}
                selectedJob={selectedJob}
                setSelectedJob={setSelectedJob}
                selectedTier={selectedTier}
                setSelectedTier={setSelectedTier}
                selectedStatus={selectedStatus}
                setSelectedStatus={setSelectedStatus}
                hasActiveFilters={hasActiveFilters}
                clearFilters={clearFilters}
                setPage={setPage}
              />
            )}
          </AnimatePresence>

          {/* Results */}
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <LoadingSkeleton />
              </motion.div>
            ) : persons.length === 0 ? (
              <EmptyState hasFilters={hasActiveFilters} />
            ) : (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* Person Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {persons.map((person, index) => (
                    <PersonCard
                      key={person.id}
                      person={person}
                      index={index}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center justify-center gap-4 mt-8"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <span
                      className="text-sm px-4"
                      style={{ color: tokens.textMuted }}
                    >
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AppLayout>
  );
}
