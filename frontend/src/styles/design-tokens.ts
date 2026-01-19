/**
 * BRIEFING ROOM DESIGN SYSTEM
 * ===========================
 * Inspired by Apple's Dark Mode - Luminous, not gloomy
 *
 * Key principles:
 * 1. Depth through subtle elevation, not harsh borders
 * 2. Color as accent, not decoration
 * 3. White space is a feature, not wasted space
 * 4. Motion should feel natural and purposeful
 */

// =============================================================================
// COLOR PALETTE
// =============================================================================
// Moving from pure black (#000) to rich, warm darks with subtle color undertones

export const colors = {
  // Background layers - from deepest to surface
  background: {
    base: "#09090b",        // Zinc-950 - rich black, not pure black
    elevated: "#18181b",    // Zinc-900 - card surfaces
    hover: "#27272a",       // Zinc-800 - interactive states
    active: "#3f3f46",      // Zinc-700 - pressed states
  },

  // Foreground / Text
  foreground: {
    primary: "#fafafa",     // Zinc-50 - primary text
    secondary: "#a1a1aa",   // Zinc-400 - secondary text
    muted: "#71717a",       // Zinc-500 - disabled/placeholder
    inverse: "#09090b",     // For light backgrounds
  },

  // Border colors - subtle, not harsh
  border: {
    default: "#27272a",     // Zinc-800
    subtle: "#18181b",      // Zinc-900
    focus: "#6366f1",       // Indigo-500
  },

  // Primary brand color - Indigo with vibrance
  primary: {
    50: "#eef2ff",
    100: "#e0e7ff",
    200: "#c7d2fe",
    300: "#a5b4fc",
    400: "#818cf8",
    500: "#6366f1",         // Main brand color
    600: "#4f46e5",
    700: "#4338ca",
    800: "#3730a3",
    900: "#312e81",
    950: "#1e1b4b",
  },

  // Accent - Electric cyan for highlights
  accent: {
    50: "#ecfeff",
    100: "#cffafe",
    200: "#a5f3fc",
    300: "#67e8f9",
    400: "#22d3ee",
    500: "#06b6d4",         // Main accent
    600: "#0891b2",
    700: "#0e7490",
    800: "#155e75",
    900: "#164e63",
  },

  // Semantic colors
  success: {
    light: "#4ade80",
    default: "#22c55e",
    dark: "#16a34a",
  },
  warning: {
    light: "#fbbf24",
    default: "#f59e0b",
    dark: "#d97706",
  },
  error: {
    light: "#f87171",
    default: "#ef4444",
    dark: "#dc2626",
  },

  // Glow effects - for that premium luminous feel
  glow: {
    primary: "rgba(99, 102, 241, 0.5)",
    accent: "rgba(6, 182, 212, 0.5)",
    success: "rgba(34, 197, 94, 0.5)",
    white: "rgba(255, 255, 255, 0.1)",
  },
} as const;

// =============================================================================
// TYPOGRAPHY
// =============================================================================

export const typography = {
  fontFamily: {
    sans: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", Consolas, monospace',
  },

  fontSize: {
    xs: ["0.75rem", { lineHeight: "1rem" }],
    sm: ["0.875rem", { lineHeight: "1.25rem" }],
    base: ["1rem", { lineHeight: "1.5rem" }],
    lg: ["1.125rem", { lineHeight: "1.75rem" }],
    xl: ["1.25rem", { lineHeight: "1.75rem" }],
    "2xl": ["1.5rem", { lineHeight: "2rem" }],
    "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
    "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
    "5xl": ["3rem", { lineHeight: "1.16" }],
    "6xl": ["3.75rem", { lineHeight: "1.1" }],
  },

  fontWeight: {
    light: "300",
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },

  letterSpacing: {
    tighter: "-0.05em",
    tight: "-0.025em",
    normal: "0",
    wide: "0.025em",
    wider: "0.05em",
    widest: "0.1em",
  },
} as const;

// =============================================================================
// SPACING
// =============================================================================

export const spacing = {
  px: "1px",
  0: "0",
  0.5: "0.125rem",
  1: "0.25rem",
  1.5: "0.375rem",
  2: "0.5rem",
  2.5: "0.625rem",
  3: "0.75rem",
  3.5: "0.875rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  7: "1.75rem",
  8: "2rem",
  9: "2.25rem",
  10: "2.5rem",
  12: "3rem",
  14: "3.5rem",
  16: "4rem",
  20: "5rem",
  24: "6rem",
  28: "7rem",
  32: "8rem",
  36: "9rem",
  40: "10rem",
  44: "11rem",
  48: "12rem",
  52: "13rem",
  56: "14rem",
  60: "15rem",
  64: "16rem",
  72: "18rem",
  80: "20rem",
  96: "24rem",
} as const;

// =============================================================================
// BORDER RADIUS
// =============================================================================

export const borderRadius = {
  none: "0",
  sm: "0.25rem",
  default: "0.5rem",
  md: "0.625rem",
  lg: "0.75rem",
  xl: "1rem",
  "2xl": "1.25rem",
  "3xl": "1.5rem",
  full: "9999px",
} as const;

// =============================================================================
// SHADOWS - Layered for depth
// =============================================================================

export const shadows = {
  none: "none",
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  default: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
  inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",

  // Premium glow shadows
  glow: {
    sm: "0 0 10px -3px var(--glow-color, rgba(99, 102, 241, 0.5))",
    md: "0 0 20px -5px var(--glow-color, rgba(99, 102, 241, 0.5))",
    lg: "0 0 30px -5px var(--glow-color, rgba(99, 102, 241, 0.5))",
    xl: "0 0 50px -10px var(--glow-color, rgba(99, 102, 241, 0.5))",
  },

  // Card elevation
  card: "0 0 0 1px rgba(255, 255, 255, 0.05), 0 4px 24px -4px rgba(0, 0, 0, 0.5)",
  cardHover: "0 0 0 1px rgba(255, 255, 255, 0.1), 0 8px 32px -4px rgba(0, 0, 0, 0.6)",
} as const;

// =============================================================================
// ANIMATION
// =============================================================================

export const animation = {
  // Timing functions - natural, not robotic
  easing: {
    default: "cubic-bezier(0.4, 0, 0.2, 1)",
    in: "cubic-bezier(0.4, 0, 1, 1)",
    out: "cubic-bezier(0, 0, 0.2, 1)",
    inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
  },

  // Duration
  duration: {
    fastest: "50ms",
    faster: "100ms",
    fast: "150ms",
    normal: "200ms",
    slow: "300ms",
    slower: "400ms",
    slowest: "500ms",
  },

  // Framer Motion spring configs
  spring: {
    gentle: { type: "spring", stiffness: 120, damping: 14 },
    wobbly: { type: "spring", stiffness: 180, damping: 12 },
    stiff: { type: "spring", stiffness: 300, damping: 30 },
    smooth: { type: "spring", stiffness: 100, damping: 20, mass: 0.5 },
  },
} as const;

// =============================================================================
// Z-INDEX
// =============================================================================

export const zIndex = {
  behind: -1,
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modalBackdrop: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
  toast: 80,
  max: 9999,
} as const;

// =============================================================================
// BREAKPOINTS
// =============================================================================

export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const;
