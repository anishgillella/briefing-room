/**
 * Design Tokens - Premium Dark Theme
 *
 * Shared design system tokens for consistent styling across the application.
 * These values are extracted from the Jobs page design and should be used
 * throughout all pages for visual consistency.
 */

// =============================================================================
// COLOR TOKENS
// =============================================================================

export const tokens = {
  // Backgrounds - Dark theme hierarchy
  bgApp: "#070B14",           // Deepest background for page canvas
  bgSurface: "#0C1322",       // Elevated surface (cards, panels)
  bgSurfaceHover: "#111827",  // Surface hover state
  bgCard: "#0F172A",          // Card background
  bgCardHover: "#1E293B",     // Card hover state
  bgGlass: "rgba(15, 23, 42, 0.8)",  // Glassmorphism background

  // Borders - Subtle white-based borders
  borderSubtle: "rgba(255,255,255,0.06)",  // Barely visible
  borderDefault: "rgba(255,255,255,0.08)", // Default border
  borderHover: "rgba(255,255,255,0.12)",   // Hover state
  borderFocus: "rgba(99,102,241,0.5)",     // Focus state (brand color)

  // Text - Slate-based hierarchy
  textPrimary: "#F8FAFC",     // Main text (slate-50)
  textSecondary: "#94A3B8",   // Secondary text (slate-400)
  textMuted: "#64748B",       // Muted text (slate-500)
  textDisabled: "#475569",    // Disabled text (slate-600)

  // Brand - Indigo palette
  brandPrimary: "#6366F1",    // Primary brand (indigo-500)
  brandSecondary: "#818CF8",  // Secondary brand (indigo-400)
  brandGlow: "rgba(99,102,241,0.15)",      // Subtle glow
  brandGlowStrong: "rgba(99,102,241,0.3)", // Strong glow

  // Status Colors
  statusSuccess: "#10B981",   // Success/positive (emerald-500)
  statusWarning: "#F59E0B",   // Warning/caution (amber-500)
  statusDanger: "#EF4444",    // Danger/error (red-500)
  statusInfo: "#3B82F6",      // Info (blue-500)

  // Gradients
  gradientPrimary: "linear-gradient(135deg, #6366F1, #8B5CF6)",
  gradientSuccess: "linear-gradient(135deg, #10B981, #34D399)",
  gradientWarning: "linear-gradient(135deg, #F59E0B, #FBBF24)",
  gradientDanger: "linear-gradient(135deg, #EF4444, #F87171)",
};

// =============================================================================
// ANIMATION CONFIGS
// =============================================================================

/** Spring animation configuration for natural motion */
export const springConfig = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30
};

/** Custom easing curve for smooth animations */
export const easeOutCustom: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Stagger delay between items in a list */
export const staggerDelay = 0.06;

/** Pulse animation timing */
export const pulseConfig = {
  duration: 2.5,
  repeat: Infinity,
  ease: "easeInOut" as const,
};

// =============================================================================
// VARIANT STYLES
// =============================================================================

/** Status badge color configurations */
export const statusBadgeConfig: Record<string, { bg: string; text: string; dot: string }> = {
  active: {
    bg: "rgba(16,185,129,0.1)",
    text: tokens.statusSuccess,
    dot: tokens.statusSuccess,
  },
  draft: {
    bg: "rgba(100,116,139,0.1)",
    text: tokens.textMuted,
    dot: tokens.textMuted,
  },
  paused: {
    bg: "rgba(245,158,11,0.1)",
    text: tokens.statusWarning,
    dot: tokens.statusWarning,
  },
  closed: {
    bg: "rgba(100,116,139,0.1)",
    text: tokens.textDisabled,
    dot: tokens.textDisabled,
  },
  scheduled: {
    bg: "rgba(59,130,246,0.1)",
    text: tokens.statusInfo,
    dot: tokens.statusInfo,
  },
  in_progress: {
    bg: "rgba(245,158,11,0.1)",
    text: tokens.statusWarning,
    dot: tokens.statusWarning,
  },
  completed: {
    bg: "rgba(16,185,129,0.1)",
    text: tokens.statusSuccess,
    dot: tokens.statusSuccess,
  },
  cancelled: {
    bg: "rgba(239,68,68,0.1)",
    text: tokens.statusDanger,
    dot: tokens.statusDanger,
  },
  rejected: {
    bg: "rgba(239,68,68,0.1)",
    text: tokens.statusDanger,
    dot: tokens.statusDanger,
  },
  pending: {
    bg: "rgba(245,158,11,0.1)",
    text: tokens.statusWarning,
    dot: tokens.statusWarning,
  },
  new: {
    bg: "rgba(59,130,246,0.1)",
    text: tokens.statusInfo,
    dot: tokens.statusInfo,
  },
};

/** StatCard variant styles */
export const statCardVariants = {
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
  info: {
    iconBg: "rgba(59,130,246,0.15)",
    iconColor: tokens.statusInfo,
    glow: "none",
  },
};

/** Tier color configurations */
export const tierConfig: Record<string, { bg: string; text: string; border: string }> = {
  "TOP TIER": {
    bg: "rgba(251,191,36,0.15)",
    text: "#FCD34D",
    border: "rgba(251,191,36,0.3)",
  },
  "STRONG": {
    bg: "rgba(16,185,129,0.15)",
    text: tokens.statusSuccess,
    border: "rgba(16,185,129,0.3)",
  },
  "GOOD": {
    bg: "rgba(59,130,246,0.15)",
    text: tokens.statusInfo,
    border: "rgba(59,130,246,0.3)",
  },
  "EVALUATE": {
    bg: "rgba(100,116,139,0.15)",
    text: tokens.textSecondary,
    border: "rgba(100,116,139,0.3)",
  },
  "POOR": {
    bg: "rgba(239,68,68,0.1)",
    text: tokens.statusDanger,
    border: "rgba(239,68,68,0.2)",
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get score color based on value
 */
export function getScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return tokens.textMuted;
  if (score >= 80) return tokens.statusSuccess;
  if (score >= 60) return tokens.statusWarning;
  return tokens.statusDanger;
}

/**
 * Get tier style configuration
 */
export function getTierStyle(tier: string | null | undefined): { bg: string; text: string; border: string } {
  if (!tier) return tierConfig["EVALUATE"];
  const upperTier = tier.toUpperCase();
  return tierConfig[upperTier] || tierConfig["EVALUATE"];
}

/**
 * Get status badge configuration
 */
export function getStatusBadgeStyle(status: string | null | undefined): { bg: string; text: string; dot: string } {
  if (!status) return statusBadgeConfig.draft;
  return statusBadgeConfig[status.toLowerCase()] || statusBadgeConfig.draft;
}

// =============================================================================
// CSS CLASSES (for Tailwind-based components)
// =============================================================================

/** Common glass panel styles */
export const glassPanel = {
  backgroundColor: tokens.bgGlass,
  border: `1px solid ${tokens.borderDefault}`,
  backdropFilter: "blur(16px)",
};

/** Common card styles */
export const cardStyles = {
  backgroundColor: tokens.bgCard,
  border: `1px solid ${tokens.borderDefault}`,
  borderRadius: "1rem", // rounded-2xl
};

/** Ambient gradient overlay for page backgrounds */
export const ambientGradient = `
  radial-gradient(ellipse at 70% 10%, ${tokens.brandGlow} 0%, transparent 50%),
  radial-gradient(ellipse at 20% 80%, rgba(139,92,246,0.05) 0%, transparent 50%)
`;

/** Grain texture overlay SVG */
export const grainTexture = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`;

export default tokens;
