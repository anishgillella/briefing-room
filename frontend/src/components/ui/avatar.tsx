"use client";

import { forwardRef, type ImgHTMLAttributes } from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// =============================================================================
// AVATAR VARIANTS
// =============================================================================

const avatarVariants = cva(
  "relative flex shrink-0 overflow-hidden rounded-full",
  {
    variants: {
      size: {
        xs: "h-6 w-6 text-xs",
        sm: "h-8 w-8 text-sm",
        md: "h-10 w-10 text-sm",
        lg: "h-12 w-12 text-base",
        xl: "h-16 w-16 text-lg",
        "2xl": "h-20 w-20 text-xl",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

// =============================================================================
// AVATAR ROOT
// =============================================================================

export interface AvatarProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatarVariants> {}

const Avatar = forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ className, size, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(avatarVariants({ size }), className)}
    {...props}
  />
));

Avatar.displayName = AvatarPrimitive.Root.displayName;

// =============================================================================
// AVATAR IMAGE
// =============================================================================

const AvatarImage = forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full object-cover", className)}
    {...props}
  />
));

AvatarImage.displayName = AvatarPrimitive.Image.displayName;

// =============================================================================
// AVATAR FALLBACK
// =============================================================================

const AvatarFallback = forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 font-medium text-white",
      className
    )}
    {...props}
  />
));

AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

// =============================================================================
// USER AVATAR - Pre-built component with name
// =============================================================================

interface UserAvatarProps extends VariantProps<typeof avatarVariants> {
  name: string;
  src?: string | null;
  className?: string;
}

export function UserAvatar({ name, src, size, className }: UserAvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Avatar size={size} className={className}>
      {src && <AvatarImage src={src} alt={name} />}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}

// =============================================================================
// AVATAR GROUP
// =============================================================================

interface AvatarGroupProps {
  avatars: Array<{ name: string; src?: string | null }>;
  max?: number;
  size?: VariantProps<typeof avatarVariants>["size"];
  className?: string;
}

export function AvatarGroup({ avatars, max = 4, size = "sm", className }: AvatarGroupProps) {
  const visibleAvatars = avatars.slice(0, max);
  const remainingCount = avatars.length - max;

  return (
    <div className={cn("flex -space-x-2", className)}>
      {visibleAvatars.map((avatar, i) => (
        <UserAvatar
          key={i}
          name={avatar.name}
          src={avatar.src}
          size={size}
          className="ring-2 ring-zinc-900"
        />
      ))}
      {remainingCount > 0 && (
        <div
          className={cn(
            avatarVariants({ size }),
            "flex items-center justify-center bg-zinc-800 text-zinc-400 font-medium ring-2 ring-zinc-900"
          )}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export { Avatar, AvatarImage, AvatarFallback };
