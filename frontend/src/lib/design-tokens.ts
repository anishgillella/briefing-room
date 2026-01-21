// =============================================================================
// DESIGN TOKENS - Premium Dark Theme
// =============================================================================
// Shared design system extracted from the Jobs page for consistency across
// all pages in the application.
// =============================================================================

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

  // Status Backgrounds
  statusSuccessBg: "rgba(16,185,129,0.1)",
  statusSuccessBgStrong: "rgba(16,185,129,0.15)",
  statusWarningBg: "rgba(245,158,11,0.1)",
  statusWarningBgStrong: "rgba(245,158,11,0.15)",
  statusDangerBg: "rgba(239,68,68,0.1)",
  statusDangerBgStrong: "rgba(239,68,68,0.15)",
  statusInfoBg: "rgba(59,130,246,0.1)",
  statusInfoBgStrong: "rgba(59,130,246,0.15)",

  // Gradients
  gradientPrimary: "linear-gradient(135deg, #6366F1, #8B5CF6)",
  gradientSuccess: "linear-gradient(135deg, #10B981, #34D399)",
  gradientWarning: "linear-gradient(135deg, #F59E0B, #FBBF24)",
  gradientDanger: "linear-gradient(135deg, #EF4444, #F87171)",
  gradientInfo: "linear-gradient(135deg, #3B82F6, #60A5FA)",

  // Tier colors (for talent pool)
  tierS: "#F59E0B", // Gold
  tierA: "#8B5CF6", // Purple
  tierB: "#3B82F6", // Blue
  tierC: "#6B7280", // Gray
  tierSBg: "rgba(245,158,11,0.15)",
  tierABg: "rgba(139,92,246,0.15)",
  tierBBg: "rgba(59,130,246,0.15)",
  tierCBg: "rgba(107,114,128,0.15)",
};

// Animation configs
export const springConfig = { type: "spring" as const, stiffness: 300, damping: 30 };
export const springConfigSoft = { type: "spring" as const, stiffness: 200, damping: 25 };
export const easeOutCustom: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Common animation variants
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

// Ambient background component styles
export const ambientGradient = `
  radial-gradient(ellipse at 70% 10%, ${tokens.brandGlow} 0%, transparent 50%),
  radial-gradient(ellipse at 20% 80%, rgba(139,92,246,0.05) 0%, transparent 50%)
`;

export const grainTexture = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`;

// Helper function to get tier color
export function getTierColor(tier: string | null | undefined): string {
  switch (tier?.toUpperCase()) {
    case "S":
      return tokens.tierS;
    case "A":
      return tokens.tierA;
    case "B":
      return tokens.tierB;
    case "C":
    default:
      return tokens.tierC;
  }
}

// Helper function to get tier background
export function getTierBg(tier: string | null | undefined): string {
  switch (tier?.toUpperCase()) {
    case "S":
      return tokens.tierSBg;
    case "A":
      return tokens.tierABg;
    case "B":
      return tokens.tierBBg;
    case "C":
    default:
      return tokens.tierCBg;
  }
}

// Helper function to get status color
export function getStatusColor(status: string): { bg: string; text: string; dot: string } {
  switch (status?.toLowerCase()) {
    case "active":
    case "completed":
    case "accepted":
      return {
        bg: tokens.statusSuccessBg,
        text: tokens.statusSuccess,
        dot: tokens.statusSuccess,
      };
    case "scheduled":
    case "in_progress":
      return {
        bg: tokens.statusInfoBg,
        text: tokens.statusInfo,
        dot: tokens.statusInfo,
      };
    case "paused":
    case "pending":
      return {
        bg: tokens.statusWarningBg,
        text: tokens.statusWarning,
        dot: tokens.statusWarning,
      };
    case "cancelled":
    case "rejected":
    case "failed":
      return {
        bg: tokens.statusDangerBg,
        text: tokens.statusDanger,
        dot: tokens.statusDanger,
      };
    default:
      return {
        bg: "rgba(100,116,139,0.1)",
        text: tokens.textMuted,
        dot: tokens.textMuted,
      };
  }
}
