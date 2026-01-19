"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { Spinner } from "./motion";

// =============================================================================
// BUTTON VARIANTS
// =============================================================================

const buttonVariants = cva(
  // Base styles
  `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium
   transition-all duration-200 ease-out
   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950
   disabled:pointer-events-none disabled:opacity-50
   active:scale-[0.98]`,
  {
    variants: {
      variant: {
        // Primary - Main CTA
        primary: `
          bg-gradient-to-b from-indigo-500 to-indigo-600
          text-white
          shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_0_1px_rgba(99,102,241,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]
          hover:from-indigo-400 hover:to-indigo-500
          hover:shadow-[0_4px_20px_-4px_rgba(99,102,241,0.5),0_0_0_1px_rgba(99,102,241,0.6),inset_0_1px_0_rgba(255,255,255,0.15)]
          hover:-translate-y-0.5
        `,

        // Secondary - Secondary actions
        secondary: `
          bg-zinc-800/80
          text-zinc-100
          border border-zinc-700/50
          shadow-[0_1px_2px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)]
          hover:bg-zinc-700/80
          hover:border-zinc-600/50
          hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]
        `,

        // Outline - Bordered button
        outline: `
          bg-transparent
          text-zinc-300
          border border-zinc-700/80
          hover:bg-zinc-800/50
          hover:text-zinc-100
          hover:border-zinc-600
        `,

        // Ghost - Minimal button
        ghost: `
          bg-transparent
          text-zinc-400
          hover:bg-zinc-800/60
          hover:text-zinc-100
        `,

        // Danger - Destructive actions
        danger: `
          bg-gradient-to-b from-red-500 to-red-600
          text-white
          shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_0_1px_rgba(239,68,68,0.5)]
          hover:from-red-400 hover:to-red-500
          hover:shadow-[0_4px_20px_-4px_rgba(239,68,68,0.5),0_0_0_1px_rgba(239,68,68,0.6)]
        `,

        // Success - Positive actions
        success: `
          bg-gradient-to-b from-emerald-500 to-emerald-600
          text-white
          shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_0_1px_rgba(34,197,94,0.5)]
          hover:from-emerald-400 hover:to-emerald-500
          hover:shadow-[0_4px_20px_-4px_rgba(34,197,94,0.5),0_0_0_1px_rgba(34,197,94,0.6)]
        `,

        // Glass - Glassmorphism style
        glass: `
          bg-white/5
          text-zinc-100
          border border-white/10
          backdrop-blur-xl
          hover:bg-white/10
          hover:border-white/20
        `,

        // Link - Text-only button
        link: `
          bg-transparent
          text-indigo-400
          underline-offset-4
          hover:text-indigo-300
          hover:underline
          p-0 h-auto
        `,

        // White - For dark backgrounds
        white: `
          bg-white
          text-zinc-900
          shadow-[0_1px_2px_rgba(0,0,0,0.1)]
          hover:bg-zinc-100
          hover:shadow-[0_4px_12px_-4px_rgba(255,255,255,0.3)]
        `,
      },

      size: {
        xs: "h-7 px-2.5 text-xs rounded-lg",
        sm: "h-8 px-3 text-sm rounded-lg",
        md: "h-10 px-4 text-sm",
        lg: "h-11 px-6 text-base",
        xl: "h-12 px-8 text-base",
        icon: "h-10 w-10 p-0",
        "icon-sm": "h-8 w-8 p-0 rounded-lg",
        "icon-lg": "h-12 w-12 p-0",
      },

      fullWidth: {
        true: "w-full",
      },
    },

    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

// =============================================================================
// BUTTON COMPONENT
// =============================================================================

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      asChild = false,
      loading = false,
      disabled,
      leftIcon,
      rightIcon,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = disabled || loading;

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        disabled={isDisabled}
        {...props}
      >
        {loading ? (
          <>
            <Spinner size="sm" />
            <span className="opacity-70">{children}</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </Comp>
    );
  }
);

Button.displayName = "Button";

// =============================================================================
// MOTION BUTTON - With Framer Motion animations
// =============================================================================

export interface MotionButtonProps
  extends Omit<HTMLMotionProps<"button">, "children">,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
}

const MotionButton = forwardRef<HTMLButtonElement, MotionButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      loading = false,
      disabled,
      leftIcon,
      rightIcon,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <motion.button
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        disabled={isDisabled}
        whileHover={{ scale: isDisabled ? 1 : 1.02 }}
        whileTap={{ scale: isDisabled ? 1 : 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        {...props}
      >
        {loading ? (
          <>
            <Spinner size="sm" />
            <span className="opacity-70">{children}</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </motion.button>
    );
  }
);

MotionButton.displayName = "MotionButton";

// =============================================================================
// ICON BUTTON
// =============================================================================

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  icon: React.ReactNode;
  label: string;
  loading?: boolean;
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = "ghost", icon, label, loading, disabled, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant={variant}
        size="icon"
        className={className}
        disabled={disabled}
        loading={loading}
        aria-label={label}
        title={label}
        {...props}
      >
        {icon}
      </Button>
    );
  }
);

IconButton.displayName = "IconButton";

// =============================================================================
// EXPORTS
// =============================================================================

export { Button, MotionButton, IconButton, buttonVariants };
