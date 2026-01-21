// =============================================================================
// DESIGN TOKENS - Premium Dark Theme
// =============================================================================
// Shared design system tokens used across all premium-styled pages.
// Extracted from the Jobs page redesign for consistency.

export const tokens = {
  // Backgrounds
  bgApp: "#070B14",
  bgSurface: "#0C1322",
  bgSurfaceHover: "#111827",
  bgCard: "#0F172A",
  bgCardHover: "#1E293B",
  bgGlass: "rgba(15, 23, 42, 0.8)",

  // Borders
  borderSubtle: "rgba(255,255,255,0.06)",
  borderDefault: "rgba(255,255,255,0.08)",
  borderHover: "rgba(255,255,255,0.12)",
  borderFocus: "rgba(99,102,241,0.5)",

  // Text
  textPrimary: "#F8FAFC",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",
  textDisabled: "#475569",

  // Brand
  brandPrimary: "#6366F1",
  brandSecondary: "#818CF8",
  brandGlow: "rgba(99,102,241,0.15)",
  brandGlowStrong: "rgba(99,102,241,0.3)",

  // Status
  statusSuccess: "#10B981",
  statusWarning: "#F59E0B",
  statusDanger: "#EF4444",
  statusInfo: "#3B82F6",

  // Gradients
  gradientPrimary: "linear-gradient(135deg, #6366F1, #8B5CF6)",
  gradientSuccess: "linear-gradient(135deg, #10B981, #34D399)",
  gradientWarning: "linear-gradient(135deg, #F59E0B, #FBBF24)",
  gradientDanger: "linear-gradient(135deg, #EF4444, #F87171)",

  // Tier colors
  tierTopTier: "#10B981",     // Emerald
  tierStrong: "#3B82F6",      // Blue
  tierGood: "#8B5CF6",        // Purple
  tierEvaluate: "#F59E0B",    // Amber
  tierPoor: "#EF4444",        // Red
};

// Animation configs
export const springConfig = { type: "spring" as const, stiffness: 300, damping: 30 };
export const easeOutCustom: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Tier badge configuration
export const tierConfig: Record<string, { color: string; bg: string; label: string }> = {
  "TOP TIER": {
    color: tokens.tierTopTier,
    bg: "rgba(16,185,129,0.15)",
    label: "Top Tier",
  },
  "STRONG": {
    color: tokens.tierStrong,
    bg: "rgba(59,130,246,0.15)",
    label: "Strong",
  },
  "GOOD": {
    color: tokens.tierGood,
    bg: "rgba(139,92,246,0.15)",
    label: "Good",
  },
  "EVALUATE": {
    color: tokens.tierEvaluate,
    bg: "rgba(245,158,11,0.15)",
    label: "Evaluate",
  },
  "POOR": {
    color: tokens.tierPoor,
    bg: "rgba(239,68,68,0.15)",
    label: "Poor",
  },
};

// Status badge configuration
export const statusConfig: Record<string, { color: string; bg: string }> = {
  new: {
    color: tokens.brandSecondary,
    bg: "rgba(129,140,248,0.15)",
  },
  round_1: {
    color: tokens.brandPrimary,
    bg: tokens.brandGlow,
  },
  round_2: {
    color: tokens.brandPrimary,
    bg: tokens.brandGlow,
  },
  round_3: {
    color: tokens.brandPrimary,
    bg: tokens.brandGlow,
  },
  decision_pending: {
    color: tokens.statusWarning,
    bg: "rgba(245,158,11,0.15)",
  },
  accepted: {
    color: tokens.statusSuccess,
    bg: "rgba(16,185,129,0.15)",
  },
  rejected: {
    color: tokens.statusDanger,
    bg: "rgba(239,68,68,0.15)",
  },
  pending: {
    color: tokens.textMuted,
    bg: "rgba(100,116,139,0.15)",
  },
  in_progress: {
    color: tokens.statusInfo,
    bg: "rgba(59,130,246,0.15)",
  },
  completed: {
    color: tokens.statusSuccess,
    bg: "rgba(16,185,129,0.15)",
  },
};

// Helper function to get tier config with fallback
export function getTierConfig(tier: string | null | undefined) {
  if (!tier) return tierConfig["EVALUATE"];
  const upperTier = tier.toUpperCase();
  return tierConfig[upperTier] || tierConfig["EVALUATE"];
}

// Helper function to get status config with fallback
export function getStatusConfig(status: string | null | undefined) {
  if (!status) return statusConfig["pending"];
  return statusConfig[status.toLowerCase()] || statusConfig["pending"];
}
