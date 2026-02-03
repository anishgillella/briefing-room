"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import {
  tokens,
  springConfig,
  easeOutCustom,
  ambientGradient,
  grainTexture,
  getTierColor,
  getTierBg,
} from "@/lib/design-tokens";
import {
  Users,
  Search,
  Filter,
  ChevronRight,
  MapPin,
  Building2,
  Briefcase,
  X,
  Star,
  GitBranch,
  Command,
  TrendingUp,
  Award,
  UserCheck,
  type LucideIcon,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";

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
  variant = "default",
  delay = 0,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  variant?: "default" | "success" | "warning" | "danger";
  delay?: number;
}) {
  const variantStyles = {
    default: {
      iconBg: tokens.brandGlow,
      iconColor: tokens.brandPrimary,
    },
    success: {
      iconBg: "rgba(16,185,129,0.15)",
      iconColor: tokens.statusSuccess,
    },
    warning: {
      iconBg: "rgba(245,158,11,0.15)",
      iconColor: tokens.statusWarning,
    },
    danger: {
      iconBg: "rgba(239,68,68,0.1)",
      iconColor: tokens.statusDanger,
    },
  };

  const styles = variantStyles[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: easeOutCustom }}
      whileHover={{ y: -4, transition: springConfig }}
      className="group relative cursor-default"
    >
      <div
        className="relative p-5 rounded-2xl transition-all duration-300"
        style={{
          backgroundColor: tokens.bgSurface,
          border: `1px solid ${tokens.borderDefault}`,
        }}
      >
        <div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${styles.iconColor}10, transparent 70%)`,
          }}
        />

        <div className="relative flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium mb-2" style={{ color: tokens.textMuted }}>
              {label}
            </p>
            <p
              className="text-3xl font-semibold tracking-tight tabular-nums"
              style={{
                color: tokens.textPrimary,
                fontFamily: "var(--font-mono), monospace",
              }}
            >
              {value}
            </p>
          </div>

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
// TIER BADGE
// =============================================================================
function TierBadge({ tier }: { tier: string | null | undefined }) {
  if (!tier) return null;

  const tierDisplay = tier.toUpperCase();
  const color = getTierColor(tier);
  const bg = getTierBg(tier);

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: bg, color }}
    >
      <Star className="w-2.5 h-2.5" />
      {tierDisplay}
    </span>
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
  filterTabs,
  selectedTab,
  setSelectedTab,
}: {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeFilterCount: number;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  filterTabs: { id: string; label: string; count?: number }[];
  selectedTab: string;
  setSelectedTab: (tab: string) => void;
}) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);

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
                boxShadow: isSearchFocused ? `0 0 0 4px ${tokens.brandGlow}` : "none",
              }}
            />
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

          <div
            className="hidden sm:block w-px h-8"
            style={{ backgroundColor: tokens.borderSubtle }}
          />

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {filterTabs.map((tab) => {
              const isActive = selectedTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id)}
                  className="relative px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap"
                  style={{
                    color: isActive ? tokens.textPrimary : tokens.textMuted,
                    backgroundColor: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                  }}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-full"
                      style={{
                        backgroundColor: isActive ? tokens.brandGlow : "rgba(255,255,255,0.06)",
                        color: isActive ? tokens.brandPrimary : tokens.textMuted,
                      }}
                    >
                      {tab.count}
                    </span>
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="activeTalentTab"
                      className="absolute inset-0 rounded-lg -z-10"
                      style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div
            className="hidden sm:block w-px h-8"
            style={{ backgroundColor: tokens.borderSubtle }}
          />

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200"
            style={{
              backgroundColor: showFilters || activeFilterCount > 0
                ? tokens.brandGlow
                : "rgba(255,255,255,0.04)",
              color: showFilters || activeFilterCount > 0
                ? tokens.brandPrimary
                : tokens.textMuted,
              border: `1px solid ${showFilters || activeFilterCount > 0 ? tokens.brandPrimary + "40" : tokens.borderSubtle}`,
            }}
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Filters</span>
            {activeFilterCount > 0 && (
              <span
                className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full"
                style={{
                  backgroundColor: tokens.brandPrimary,
                  color: "white",
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
// PERSON CARD - Premium Design
// =============================================================================
function PersonCard({
  person,
  index,
  onDelete,
}: {
  person: PersonSummary;
  index: number;
  onDelete: (id: string) => void;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.04,
        ease: easeOutCustom,
      }}
      whileHover={shouldReduceMotion ? {} : { y: -4 }}
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
            {/* Header Row */}
            <div className="flex items-start gap-4 mb-4">
              <UserAvatar name={person.name} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3
                    className="font-semibold truncate group-hover:text-indigo-400 transition-colors"
                    style={{ color: tokens.textPrimary }}
                  >
                    {person.name}
                  </h3>
                  <TierBadge tier={person.tier} />
                </div>
                {person.headline && (
                  <p
                    className="text-sm truncate"
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

            {/* Meta Row */}
            <div className="flex items-center gap-4 mb-3">
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
                  className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: tokens.brandGlow,
                    color: tokens.brandPrimary,
                  }}
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
                    className="px-2 py-1 rounded-lg text-xs"
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
                    className="px-2 py-1 text-[10px]"
                    style={{ color: tokens.textDisabled }}
                  >
                    +{person.skills.length - 4} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Delete Button - Absolute positioned outside the link but inside the relative container */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(person.id);
        }}
        className="absolute top-4 right-4 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-500/10 hover:text-red-400"
        style={{ color: tokens.textMuted, zIndex: 10 }}
        title="Delete Person"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

// =============================================================================
// FILTER PANEL - Premium Design
// =============================================================================
function FilterPanel({
  filterOptions,
  selectedSkills,
  setSelectedSkills,
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
  clearFilters,
  hasActiveFilters,
}: {
  filterOptions: FilterOptions;
  selectedSkills: string[];
  setSelectedSkills: (skills: string[]) => void;
  selectedLocation: string;
  setSelectedLocation: (location: string) => void;
  selectedCompany: string;
  setSelectedCompany: (company: string) => void;
  selectedJob: string;
  setSelectedJob: (job: string) => void;
  selectedTier: string;
  setSelectedTier: (tier: string) => void;
  selectedStatus: string;
  setSelectedStatus: (status: string) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
}) {
  const toggleSkill = (skill: string) => {
    setSelectedSkills(
      selectedSkills.includes(skill)
        ? selectedSkills.filter((s) => s !== skill)
        : [...selectedSkills, skill]
    );
  };

  const selectStyle = {
    backgroundColor: "rgba(255,255,255,0.04)",
    border: `1px solid ${tokens.borderSubtle}`,
    color: tokens.textPrimary,
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: easeOutCustom }}
      className="mb-6 overflow-hidden"
    >
      <div
        className="p-5 rounded-2xl space-y-5"
        style={{
          backgroundColor: tokens.bgSurface,
          border: `1px solid ${tokens.borderDefault}`,
        }}
      >
        {/* Active Filters */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm" style={{ color: tokens.textMuted }}>
              Active filters:
            </span>
            {selectedSkills.map((skill) => (
              <motion.button
                key={skill}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => toggleSkill(skill)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
                style={{
                  backgroundColor: tokens.brandGlow,
                  border: `1px solid ${tokens.brandPrimary}40`,
                  color: tokens.brandPrimary,
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
                onClick={() => setSelectedLocation("")}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                style={{
                  backgroundColor: tokens.statusSuccessBg,
                  border: `1px solid ${tokens.statusSuccess}40`,
                  color: tokens.statusSuccess,
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
                onClick={() => setSelectedCompany("")}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                style={{
                  backgroundColor: "rgba(139,92,246,0.15)",
                  border: "1px solid rgba(139,92,246,0.4)",
                  color: "#A78BFA",
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
                onClick={() => setSelectedJob("")}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                style={{
                  backgroundColor: tokens.statusWarningBg,
                  border: `1px solid ${tokens.statusWarning}40`,
                  color: tokens.statusWarning,
                }}
              >
                <Briefcase className="w-3 h-3" />
                {filterOptions.jobs.find((j) => j.id === selectedJob)?.title || "Job"}
                <X className="w-3 h-3" />
              </motion.button>
            )}
            {selectedTier && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setSelectedTier("")}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                style={{
                  backgroundColor: getTierBg(selectedTier),
                  border: `1px solid ${getTierColor(selectedTier)}40`,
                  color: getTierColor(selectedTier),
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
                onClick={() => setSelectedStatus("")}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                style={{
                  backgroundColor: tokens.statusInfoBg,
                  border: `1px solid ${tokens.statusInfo}40`,
                  color: tokens.statusInfo,
                }}
              >
                <GitBranch className="w-3 h-3" />
                {selectedStatus.replace(/_/g, " ")}
                <X className="w-3 h-3" />
              </motion.button>
            )}
            <button
              onClick={clearFilters}
              className="text-xs underline ml-2 transition-colors hover:text-white"
              style={{ color: tokens.textMuted }}
            >
              Clear all
            </button>
          </div>
        )}

        {/* Filter Dropdowns */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: tokens.textMuted }}>
              Location
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              style={selectStyle}
            >
              <option value="">All Locations</option>
              {filterOptions.locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: tokens.textMuted }}>
              Company
            </label>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              style={selectStyle}
            >
              <option value="">All Companies</option>
              {filterOptions.companies.map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
            </select>
          </div>

          {filterOptions.jobs && filterOptions.jobs.length > 0 && (
            <div>
              <label className="text-xs font-medium mb-2 block" style={{ color: tokens.textMuted }}>
                Job Position
              </label>
              <select
                value={selectedJob}
                onChange={(e) => setSelectedJob(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                style={selectStyle}
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

          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: tokens.textMuted }}>
              Candidate Tier
            </label>
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              style={selectStyle}
            >
              <option value="">All Tiers</option>
              {filterOptions.tiers.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: tokens.textMuted }}>
              Pipeline Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              style={selectStyle}
            >
              <option value="">All Statuses</option>
              {filterOptions.pipeline_statuses.map((status) => (
                <option key={status} value={status}>
                  {status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Skills Filter */}
        <div>
          <label className="text-xs font-medium mb-2 block" style={{ color: tokens.textMuted }}>
            Skills
          </label>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            {filterOptions.skills.slice(0, 30).map((skill) => (
              <motion.button
                key={skill}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => toggleSkill(skill)}
                className="px-3 py-1.5 rounded-lg text-xs transition-all"
                style={{
                  backgroundColor: selectedSkills.includes(skill)
                    ? tokens.brandGlow
                    : "rgba(255,255,255,0.03)",
                  border: `1px solid ${selectedSkills.includes(skill) ? tokens.brandPrimary + "50" : tokens.borderSubtle}`,
                  color: selectedSkills.includes(skill) ? tokens.brandPrimary : tokens.textSecondary,
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
// EMPTY STATE
// =============================================================================
function EmptyState({ hasActiveFilters }: { hasActiveFilters: boolean }) {
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
      </div>

      <h3
        className="text-2xl font-semibold mb-3"
        style={{ color: tokens.textPrimary }}
      >
        {hasActiveFilters ? "No people found" : "Talent pool is empty"}
      </h3>
      <p
        className="text-base max-w-md mx-auto"
        style={{ color: tokens.textSecondary }}
      >
        {hasActiveFilters
          ? "Try adjusting your filters or search query"
          : "Upload candidates to jobs to populate the talent pool"}
      </p>
    </motion.div>
  );
}

// =============================================================================
// LOADING STATE
// =============================================================================
function LoadingState() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.05 }}
          className="rounded-2xl p-5"
          style={{
            backgroundColor: tokens.bgCard,
            border: `1px solid ${tokens.borderDefault}`,
          }}
        >
          <div className="flex items-start gap-4 mb-4">
            <div
              className="w-12 h-12 rounded-full animate-pulse"
              style={{ backgroundColor: tokens.bgSurfaceHover }}
            />
            <div className="flex-1 space-y-2">
              <div
                className="h-4 rounded animate-pulse w-3/4"
                style={{ backgroundColor: tokens.bgSurfaceHover }}
              />
              <div
                className="h-3 rounded animate-pulse w-1/2"
                style={{ backgroundColor: tokens.bgSurfaceHover }}
              />
            </div>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3].map((j) => (
              <div
                key={j}
                className="h-6 rounded-lg animate-pulse w-16"
                style={{ backgroundColor: tokens.bgSurfaceHover }}
              />
            ))}
          </div>
        </motion.div>
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
  const [selectedTab, setSelectedTab] = useState("all");

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

      if (searchQuery) {
        params.append("query", searchQuery);
      }
      if (selectedSkills.length > 0) {
        params.append("skills", selectedSkills.join(","));
      }
      if (selectedLocation) {
        params.append("location", selectedLocation);
      }
      if (selectedCompany) {
        params.append("company", selectedCompany);
      }
      if (selectedJob) {
        params.append("job_id", selectedJob);
      }
      if (selectedTier) {
        params.append("tier", selectedTier);
      }
      if (selectedStatus) {
        params.append("pipeline_status", selectedStatus);
      }

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

  const deletePerson = async (personId: string) => {
    if (!confirm("Are you sure you want to delete this person? This will delete their profile and all job applications. This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/talent-pool/${personId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        // Optimistic update
        setPersons((prev) => prev.filter((p) => p.id !== personId));
        setTotal((prev) => prev - 1);
        setFilterOptions((prev) => prev ? { ...prev, total_persons: prev.total_persons - 1 } : null);
      } else {
        alert("Failed to delete person");
      }
    } catch (error) {
      console.error("Failed to delete person:", error);
      alert("Error deleting person");
    }
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

  const hasActiveFilters = !!(
    selectedSkills.length > 0 ||
    selectedLocation ||
    selectedCompany ||
    selectedJob ||
    selectedTier ||
    selectedStatus ||
    searchQuery
  );

  const activeFilterCount =
    selectedSkills.length +
    (selectedLocation ? 1 : 0) +
    (selectedCompany ? 1 : 0) +
    (selectedJob ? 1 : 0) +
    (selectedTier ? 1 : 0) +
    (selectedStatus ? 1 : 0);

  // Stats
  const topTierCount = persons.filter((p) => p.tier === "TOP TIER" || p.tier === "S").length;
  const withApplications = persons.filter((p) => p.application_count > 0).length;

  const filterTabs = [
    { id: "all", label: "All", count: total },
    { id: "top_tier", label: "Top Tier" },
    { id: "with_apps", label: "With Applications" },
    { id: "recent", label: "Recent" },
  ];

  return (
    <AppLayout>
      <div className="min-h-screen relative" style={{ backgroundColor: tokens.bgApp }}>
        {/* Ambient gradient */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: ambientGradient }}
        />

        {/* Grain texture */}
        <div
          className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30"
          style={{ backgroundImage: grainTexture }}
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
                {filterOptions?.total_persons || total} people across all jobs
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
              icon={Award}
              value={topTierCount}
              label="Top Tier"
              variant="success"
              delay={0.15}
            />
            <StatCard
              icon={TrendingUp}
              value={persons.length}
              label="Recent"
              delay={0.2}
            />
            <StatCard
              icon={UserCheck}
              value={withApplications}
              label="With Applications"
              variant="warning"
              delay={0.25}
            />
          </div>

          {/* Command Bar */}
          <CommandBar
            searchQuery={searchQuery}
            setSearchQuery={(q) => {
              setSearchQuery(q);
              setPage(1);
            }}
            activeFilterCount={activeFilterCount}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            filterTabs={filterTabs}
            selectedTab={selectedTab}
            setSelectedTab={setSelectedTab}
          />

          {/* Filter Panel */}
          <AnimatePresence>
            {showFilters && filterOptions && (
              <FilterPanel
                filterOptions={filterOptions}
                selectedSkills={selectedSkills}
                setSelectedSkills={(skills) => {
                  setSelectedSkills(skills);
                  setPage(1);
                }}
                selectedLocation={selectedLocation}
                setSelectedLocation={(loc) => {
                  setSelectedLocation(loc);
                  setPage(1);
                }}
                selectedCompany={selectedCompany}
                setSelectedCompany={(company) => {
                  setSelectedCompany(company);
                  setPage(1);
                }}
                selectedJob={selectedJob}
                setSelectedJob={(job) => {
                  setSelectedJob(job);
                  setPage(1);
                }}
                selectedTier={selectedTier}
                setSelectedTier={(tier) => {
                  setSelectedTier(tier);
                  setPage(1);
                }}
                selectedStatus={selectedStatus}
                setSelectedStatus={(status) => {
                  setSelectedStatus(status);
                  setPage(1);
                }}
                clearFilters={clearFilters}
                hasActiveFilters={hasActiveFilters}
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
                <LoadingState />
              </motion.div>
            ) : persons.length === 0 ? (
              <EmptyState hasActiveFilters={hasActiveFilters} />
            ) : (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {persons.map((person, index) => (
                    <PersonCard key={person.id} person={person} index={index} onDelete={deletePerson} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
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
