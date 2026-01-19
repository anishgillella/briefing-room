/**
 * BRIEFING ROOM UI COMPONENTS
 * ===========================
 * A collection of premium, accessible UI components
 * built with Radix UI primitives and styled for dark mode.
 */

// Button
export { Button, MotionButton, IconButton, buttonVariants } from "./button";
export type { ButtonProps, MotionButtonProps, IconButtonProps } from "./button";

// Input
export { Input, Textarea, SearchInput, Label, FormField, inputVariants } from "./input";
export type { InputProps, TextareaProps, SearchInputProps, LabelProps } from "./input";

// Card
export {
  Card,
  MotionCard,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  StatCard,
  FeatureCard,
  cardVariants,
} from "./card";
export type { CardProps, MotionCardProps } from "./card";

// Badge
export { Badge, StatusBadge, TierBadge, CountBadge, badgeVariants } from "./badge";
export type { BadgeProps } from "./badge";

// Avatar
export { Avatar, AvatarImage, AvatarFallback, UserAvatar, AvatarGroup } from "./avatar";
export type { AvatarProps } from "./avatar";

// Tooltip
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, SimpleTooltip } from "./tooltip";

// Separator
export { Separator, LabeledSeparator } from "./separator";

// Skeleton
export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonAvatar,
  SkeletonTableRow,
  SkeletonList,
  ShimmerEffect,
} from "./skeleton";

// Motion / Animations
export {
  // Components
  PageTransition,
  FadeIn,
  FadeInUp,
  FadeInDown,
  ScaleIn,
  Stagger,
  StaggerItem,
  HoverScale,
  HoverLift,
  HoverGlow,
  Presence,
  Spinner,
  Pulse,
  Float,
  MotionDiv,
  // Variants
  fadeIn,
  fadeInUp,
  fadeInDown,
  fadeInLeft,
  fadeInRight,
  scaleIn,
  slideInRight,
  slideInLeft,
  slideInUp,
  slideInDown,
  staggerContainer,
  staggerContainerSlow,
  // Springs
  springGentle,
  springWobbly,
  springStiff,
  springSmooth,
  // Re-exports
  AnimatePresence,
  motion,
} from "./motion";

// Background
export { AnimatedBackground, GradientBackground, MeshGradient } from "./animated-background";
