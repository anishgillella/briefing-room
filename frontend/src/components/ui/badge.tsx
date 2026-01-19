"use client";

import { type HTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// =============================================================================
// BADGE VARIANTS
// =============================================================================

const badgeVariants = cva(
  `inline-flex items-center gap-1.5 rounded-full font-medium transition-colors
   whitespace-nowrap select-none`,
  {
    variants: {
      variant: {
        // Default - Subtle gray
        default: "bg-zinc-800 text-zinc-300 border border-zinc-700/50",

        // Primary - Indigo
        primary: "bg-indigo-500/15 text-indigo-300 border border-indigo-500/20",

        // Secondary - Purple
        secondary: "bg-purple-500/15 text-purple-300 border border-purple-500/20",

        // Success - Green
        success: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20",

        // Warning - Amber
        warning: "bg-amber-500/15 text-amber-300 border border-amber-500/20",

        // Error/Danger - Red
        error: "bg-red-500/15 text-red-300 border border-red-500/20",
        danger: "bg-red-500/15 text-red-300 border border-red-500/20",

        // Info - Cyan
        info: "bg-cyan-500/15 text-cyan-300 border border-cyan-500/20",

        // Outline variants
        "outline-default": "bg-transparent text-zinc-400 border border-zinc-700",
        "outline-primary": "bg-transparent text-indigo-400 border border-indigo-500/50",
        "outline-success": "bg-transparent text-emerald-400 border border-emerald-500/50",
        "outline-warning": "bg-transparent text-amber-400 border border-amber-500/50",
        "outline-error": "bg-transparent text-red-400 border border-red-500/50",

        // Solid variants (more prominent)
        "solid-primary": "bg-indigo-500 text-white border-transparent",
        "solid-success": "bg-emerald-500 text-white border-transparent",
        "solid-warning": "bg-amber-500 text-black border-transparent",
        "solid-error": "bg-red-500 text-white border-transparent",
      },

      size: {
        xs: "px-1.5 py-0.5 text-[10px]",
        sm: "px-2 py-0.5 text-xs",
        md: "px-2.5 py-1 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },

    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

// =============================================================================
// BADGE COMPONENT
// =============================================================================

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, dot, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant, size }), className)}
        {...props}
      >
        {dot && (
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              {
                "bg-zinc-400": variant === "default" || variant === "outline-default",
                "bg-indigo-400": variant === "primary" || variant === "outline-primary",
                "bg-purple-400": variant === "secondary",
                "bg-emerald-400": variant === "success" || variant === "outline-success" || variant === "solid-success",
                "bg-amber-400": variant === "warning" || variant === "outline-warning" || variant === "solid-warning",
                "bg-red-400": variant === "error" || variant === "danger" || variant === "outline-error" || variant === "solid-error",
                "bg-cyan-400": variant === "info",
                "bg-white": variant === "solid-primary",
              }
            )}
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";

// =============================================================================
// STATUS BADGE - Pre-configured for common status values
// =============================================================================

type StatusType =
  | "active"
  | "inactive"
  | "pending"
  | "completed"
  | "failed"
  | "scheduled"
  | "cancelled"
  | "draft"
  | "paused"
  | "closed"
  | "new"
  | "in_progress"
  | "review"
  | "approved"
  | "rejected";

const statusConfig: Record<StatusType, { variant: VariantProps<typeof badgeVariants>["variant"]; label: string }> = {
  active: { variant: "success", label: "Active" },
  inactive: { variant: "default", label: "Inactive" },
  pending: { variant: "warning", label: "Pending" },
  completed: { variant: "success", label: "Completed" },
  failed: { variant: "error", label: "Failed" },
  scheduled: { variant: "info", label: "Scheduled" },
  cancelled: { variant: "default", label: "Cancelled" },
  draft: { variant: "default", label: "Draft" },
  paused: { variant: "warning", label: "Paused" },
  closed: { variant: "default", label: "Closed" },
  new: { variant: "primary", label: "New" },
  in_progress: { variant: "info", label: "In Progress" },
  review: { variant: "warning", label: "In Review" },
  approved: { variant: "success", label: "Approved" },
  rejected: { variant: "error", label: "Rejected" },
};

interface StatusBadgeProps extends Omit<BadgeProps, "variant"> {
  status: StatusType | string;
  customLabel?: string;
  variant?: VariantProps<typeof badgeVariants>["variant"];
}

export function StatusBadge({ status, customLabel, variant: providedVariant, ...props }: StatusBadgeProps) {
  // Check if status is a known StatusType
  const config = statusConfig[status as StatusType];
  const variant = providedVariant || config?.variant || "default";
  const label = customLabel || config?.label || status;

  return (
    <Badge variant={variant} dot {...props}>
      {label}
    </Badge>
  );
}

// =============================================================================
// TIER BADGE - For candidate tiers
// =============================================================================

type TierType = "top" | "strong" | "consider" | "not_fit" | "unranked";

const tierConfig: Record<TierType, { variant: VariantProps<typeof badgeVariants>["variant"]; label: string }> = {
  top: { variant: "solid-success", label: "Top Tier" },
  strong: { variant: "success", label: "Strong" },
  consider: { variant: "warning", label: "Consider" },
  not_fit: { variant: "error", label: "Not a Fit" },
  unranked: { variant: "default", label: "Unranked" },
};

interface TierBadgeProps extends Omit<BadgeProps, "variant"> {
  tier: TierType;
  customLabel?: string;
}

export function TierBadge({ tier, customLabel, ...props }: TierBadgeProps) {
  const config = tierConfig[tier];

  return (
    <Badge variant={config.variant} {...props}>
      {customLabel || config.label}
    </Badge>
  );
}

// =============================================================================
// COUNT BADGE - For notification counts
// =============================================================================

interface CountBadgeProps {
  count: number;
  max?: number;
  variant?: VariantProps<typeof badgeVariants>["variant"];
  className?: string;
}

export function CountBadge({ count, max = 99, variant = "primary", className }: CountBadgeProps) {
  const displayCount = count > max ? `${max}+` : count;

  if (count <= 0) return null;

  return (
    <Badge variant={variant} size="xs" className={cn("min-w-[18px] justify-center", className)}>
      {displayCount}
    </Badge>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export { Badge, badgeVariants };
