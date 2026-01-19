"use client";

import { forwardRef } from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cn } from "@/lib/utils";

const Separator = forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      "shrink-0 bg-zinc-800",
      orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
      className
    )}
    {...props}
  />
));

Separator.displayName = SeparatorPrimitive.Root.displayName;

// =============================================================================
// LABELED SEPARATOR
// =============================================================================

interface LabeledSeparatorProps {
  label: string;
  className?: string;
}

export function LabeledSeparator({ label, className }: LabeledSeparatorProps) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="flex-1 h-[1px] bg-zinc-800" />
      <span className="text-xs text-zinc-500 uppercase tracking-wider font-medium">{label}</span>
      <div className="flex-1 h-[1px] bg-zinc-800" />
    </div>
  );
}

export { Separator };
