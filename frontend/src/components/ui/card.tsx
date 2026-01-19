"use client";

import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// =============================================================================
// CARD VARIANTS
// =============================================================================

const cardVariants = cva(
  "rounded-2xl transition-all duration-300 ease-out",
  {
    variants: {
      variant: {
        // Default elevated card
        default: `
          bg-zinc-900/80
          border border-zinc-800/50
          shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_4px_24px_-4px_rgba(0,0,0,0.5)]
        `,

        // Glass effect card
        glass: `
          bg-white/[0.03]
          backdrop-blur-2xl
          border border-white/[0.06]
          shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_4px_24px_-4px_rgba(0,0,0,0.3)]
        `,

        // Subtle card - less prominent
        subtle: `
          bg-zinc-900/40
          border border-zinc-800/30
        `,

        // Outlined card
        outline: `
          bg-transparent
          border border-zinc-800
        `,

        // Interactive card with hover effects
        interactive: `
          bg-zinc-900/80
          border border-zinc-800/50
          shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_4px_24px_-4px_rgba(0,0,0,0.5)]
          cursor-pointer
          hover:bg-zinc-800/80
          hover:border-zinc-700/50
          hover:shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_8px_32px_-4px_rgba(0,0,0,0.6)]
          hover:-translate-y-1
          active:translate-y-0
          active:shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_4px_16px_-4px_rgba(0,0,0,0.5)]
        `,

        // Highlight card - with accent border
        highlight: `
          bg-zinc-900/80
          border border-indigo-500/30
          shadow-[0_0_0_1px_rgba(99,102,241,0.1),0_4px_24px_-4px_rgba(0,0,0,0.5)]
        `,

        // Glow card - with glow effect
        glow: `
          bg-zinc-900/80
          border border-zinc-800/50
          shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_4px_24px_-4px_rgba(0,0,0,0.5),0_0_40px_-20px_rgba(99,102,241,0.3)]
        `,
      },

      padding: {
        none: "p-0",
        sm: "p-4",
        md: "p-6",
        lg: "p-8",
        xl: "p-10",
      },
    },

    defaultVariants: {
      variant: "default",
      padding: "md",
    },
  }
);

// =============================================================================
// CARD COMPONENT
// =============================================================================

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding }), className)}
      {...props}
    />
  )
);

Card.displayName = "Card";

// =============================================================================
// MOTION CARD - With Framer Motion animations
// =============================================================================

export interface MotionCardProps
  extends Omit<HTMLMotionProps<"div">, "children">,
    VariantProps<typeof cardVariants> {
  children?: ReactNode;
  hoverScale?: number;
  hoverY?: number;
}

const MotionCard = forwardRef<HTMLDivElement, MotionCardProps>(
  (
    {
      className,
      variant,
      padding,
      children,
      hoverScale = 1.01,
      hoverY = -4,
      ...props
    },
    ref
  ) => (
    <motion.div
      ref={ref}
      className={cn(cardVariants({ variant, padding }), "cursor-pointer", className)}
      whileHover={{
        scale: hoverScale,
        y: hoverY,
      }}
      whileTap={{ scale: 0.99, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      {...props}
    >
      {children}
    </motion.div>
  )
);

MotionCard.displayName = "MotionCard";

// =============================================================================
// CARD HEADER
// =============================================================================

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5", className)}
      {...props}
    />
  )
);

CardHeader.displayName = "CardHeader";

// =============================================================================
// CARD TITLE
// =============================================================================

const CardTitle = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-lg font-semibold text-zinc-100 leading-tight", className)}
      {...props}
    />
  )
);

CardTitle.displayName = "CardTitle";

// =============================================================================
// CARD DESCRIPTION
// =============================================================================

const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-zinc-400", className)}
      {...props}
    />
  )
);

CardDescription.displayName = "CardDescription";

// =============================================================================
// CARD CONTENT
// =============================================================================

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("", className)} {...props} />
  )
);

CardContent.displayName = "CardContent";

// =============================================================================
// CARD FOOTER
// =============================================================================

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center pt-4", className)}
      {...props}
    />
  )
);

CardFooter.displayName = "CardFooter";

// =============================================================================
// STAT CARD - Pre-built card for statistics
// =============================================================================

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatCard({ label, value, icon, trend, className }: StatCardProps) {
  return (
    <Card className={cn("", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-zinc-400">{label}</p>
          <p className="text-3xl font-light text-zinc-100 tracking-tight">{value}</p>
          {trend && (
            <p
              className={cn(
                "text-sm font-medium",
                trend.isPositive ? "text-emerald-400" : "text-red-400"
              )}
            >
              {trend.isPositive ? "+" : "-"}{Math.abs(trend.value)}%
            </p>
          )}
        </div>
        {icon && (
          <div className="p-3 rounded-xl bg-zinc-800/50">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

// =============================================================================
// FEATURE CARD - Pre-built card for features/items
// =============================================================================

interface FeatureCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function FeatureCard({
  title,
  description,
  icon,
  action,
  className,
  onClick,
}: FeatureCardProps) {
  const CardComponent = onClick ? MotionCard : Card;

  return (
    <CardComponent
      variant={onClick ? "interactive" : "default"}
      className={className}
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        {icon && (
          <div className="shrink-0 p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-zinc-100">{title}</h4>
          {description && (
            <p className="mt-1 text-sm text-zinc-400 line-clamp-2">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </CardComponent>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  Card,
  MotionCard,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  cardVariants,
};
