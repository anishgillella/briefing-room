"use client";

import { forwardRef } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

// =============================================================================
// TOOLTIP PROVIDER
// =============================================================================

const TooltipProvider = TooltipPrimitive.Provider;

// =============================================================================
// TOOLTIP ROOT
// =============================================================================

const Tooltip = TooltipPrimitive.Root;

// =============================================================================
// TOOLTIP TRIGGER
// =============================================================================

const TooltipTrigger = TooltipPrimitive.Trigger;

// =============================================================================
// TOOLTIP CONTENT
// =============================================================================

const TooltipContent = forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      `z-50 overflow-hidden rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200
       shadow-md border border-zinc-700/50
       animate-in fade-in-0 zoom-in-95
       data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
       data-[side=bottom]:slide-in-from-top-2
       data-[side=left]:slide-in-from-right-2
       data-[side=right]:slide-in-from-left-2
       data-[side=top]:slide-in-from-bottom-2`,
      className
    )}
    {...props}
  />
));

TooltipContent.displayName = TooltipPrimitive.Content.displayName;

// =============================================================================
// SIMPLE TOOLTIP - Pre-built component
// =============================================================================

interface SimpleTooltipProps {
  content: string;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  delayDuration?: number;
}

export function SimpleTooltip({
  content,
  children,
  side = "top",
  align = "center",
  delayDuration = 200,
}: SimpleTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={delayDuration}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} align={align}>
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
