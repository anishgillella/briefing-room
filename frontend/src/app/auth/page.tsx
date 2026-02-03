"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useAuth } from "@/contexts/AuthContext";
import {
  Mail,
  Lock,
  User,
  Building2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Check,
  Eye,
  EyeOff,
  Shield,
  Zap,
  Target,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Dynamically import Three.js component
const SignalConstellation = dynamic(
  () => import("@/components/three/SignalConstellation"),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-[#070A12]" />,
  }
);

// =============================================================================
// AUTH COLOR TOKENS
// =============================================================================

const colors = {
  pageBg: "#070A12",
  cardBg: "rgba(12, 17, 32, 0.72)",
  cardBorder: "rgba(255, 255, 255, 0.08)",
  cardTopBorder: "rgba(255, 255, 255, 0.15)", // Premium top highlight
  titleText: "#EAF0FF",
  subtitleText: "#C8D1E8", // Increased brightness from ~60% to ~75%
  mutedText: "#8892AD", // Slightly brighter for better readability
  bulletText: "#D0D8ED", // Even brighter for feature bullets
  inputBg: "rgba(255, 255, 255, 0.04)",
  inputBorder: "rgba(255, 255, 255, 0.08)",
  inputBorderHover: "rgba(255, 255, 255, 0.14)",
  inputBorderFocus: "rgba(79, 124, 255, 0.50)", // Stronger focus border
  inputFocusGlow: "0 0 0 8px rgba(79, 124, 255, 0.22)", // Stronger focus halo
  placeholder: "rgba(168, 178, 209, 0.45)",
  primaryBtn: "#4F7CFF",
  primaryBtnHover: "#3D67F2",
  primaryBtnPressed: "#2F54D9",
  primaryBtnGlow: "0 10px 30px rgba(79, 124, 255, 0.25)",
  googleBtn: "rgba(255, 255, 255, 0.05)",
  googleBtnBorder: "rgba(255, 255, 255, 0.10)",
  googleBtnHover: "rgba(255, 255, 255, 0.08)",
  accentCyan: "#38BDF8",
  accentAmber: "#FFB020",
  // Tab specific colors
  tabActiveBg: "rgba(255, 255, 255, 0.10)", // Brighter active tab
  tabActiveGlow: "0 0 20px rgba(79, 124, 255, 0.15)", // Glow under active tab
};

// =============================================================================
// ANIMATION VARIANTS - Faster, snappier (matching landing page)
// =============================================================================

// Spring configurations for smooth interactions
const springs = {
  stiff: { stiffness: 300, damping: 22 },
  soft: { stiffness: 220, damping: 20 },
  snappy: { stiffness: 450, damping: 25 },
  bounce: { stiffness: 350, damping: 18 },
};

// Hover transition duration (150ms)
const hoverDuration = 0.15;

const pageVariants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.4, staggerChildren: 0.08 },
  },
};

const leftPanelVariants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const cardVariants = {
  initial: { opacity: 0, x: 12 },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring" as const,
      stiffness: 320,
      damping: 24,
      delay: 0.1,
    },
  },
};

const formVariants = {
  initial: { opacity: 0, x: 20 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.18, ease: "easeOut" as const },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.15, ease: "easeIn" as const },
  },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: "easeOut" as const },
  },
};

// =============================================================================
// PREMIUM INPUT COMPONENT
// =============================================================================

interface PremiumInputProps {
  id: string;
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  icon: React.ReactNode;
  label: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  isFocused?: boolean;
  rightIcon?: React.ReactNode;
  showPasswordToggle?: boolean;
}

function PremiumInput({
  id,
  type,
  value,
  onChange,
  placeholder,
  icon,
  label,
  required = false,
  minLength,
  autoComplete,
  onFocus,
  onBlur,
  isFocused = false,
  rightIcon,
  showPasswordToggle = false,
}: PremiumInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const actualType = showPasswordToggle && showPassword ? "text" : type;

  return (
    <motion.div className="space-y-2" variants={staggerItem}>
      <label
        htmlFor={id}
        className="block text-sm font-medium"
        style={{ color: colors.subtitleText }}
      >
        {label}
      </label>
      <div className="relative">
        <div
          className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200"
          style={{ color: isFocused ? colors.primaryBtn : colors.mutedText }}
        >
          {icon}
        </div>
        <input
          id={id}
          type={actualType}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          className="w-full h-11 pl-12 pr-12 rounded-xl text-sm transition-all duration-150 outline-none"
          style={{
            background: colors.inputBg,
            border: `1px solid ${isFocused ? colors.inputBorderFocus : colors.inputBorder}`,
            color: colors.titleText,
            boxShadow: isFocused ? colors.inputFocusGlow : "none",
          }}
        />
        {showPasswordToggle && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors duration-200 hover:opacity-80"
            style={{ color: colors.mutedText }}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        )}
        {rightIcon && !showPasswordToggle && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            {rightIcon}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// =============================================================================
// PASSWORD STRENGTH METER
// =============================================================================

function PasswordStrength({ password }: { password: string }) {
  const strength = useMemo(() => {
    if (!password) return { level: 0, label: "", color: "" };
    let level = 0;
    if (password.length >= 8) level++;
    if (/[A-Z]/.test(password)) level++;
    if (/[0-9]/.test(password)) level++;
    if (/[^A-Za-z0-9]/.test(password)) level++;

    const labels = ["Weak", "Weak", "Good", "Strong"];
    const colorsArr = ["#ef4444", "#f59e0b", "#22c55e", "#22c55e"];

    return {
      level,
      label: labels[Math.min(level, 3)],
      color: colorsArr[Math.min(level, 3)],
    };
  }, [password]);

  if (!password) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="flex items-center gap-2 mt-2"
    >
      <div className="flex-1 h-1 rounded-full overflow-hidden flex gap-0.5" style={{ background: colors.inputBg }}>
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="flex-1 h-full rounded-full"
            initial={{ scaleX: 0 }}
            animate={{
              scaleX: strength.level >= i ? 1 : 0,
              backgroundColor: strength.level >= i ? strength.color : "transparent",
            }}
            transition={{ delay: i * 0.1 }}
            style={{ originX: 0 }}
          />
        ))}
      </div>
      <span className="text-xs min-w-[50px]" style={{ color: strength.color }}>
        {strength.label}
      </span>
    </motion.div>
  );
}

// =============================================================================
// TAB SWITCHER
// =============================================================================

function TabSwitcher({
  activeTab,
  onTabChange,
}: {
  activeTab: "login" | "signup";
  onTabChange: (tab: "login" | "signup") => void;
}) {
  return (
    <div
      className="relative flex p-1 rounded-xl mb-6"
      style={{
        background: colors.inputBg,
        border: `1px solid ${colors.googleBtnBorder}`,
      }}
    >
      {/* Active tab pill - brighter with glow */}
      <motion.div
        className="absolute top-1 bottom-1 rounded-lg"
        style={{
          background: colors.tabActiveBg,
          border: `1px solid rgba(79, 124, 255, 0.35)`,
          boxShadow: colors.tabActiveGlow,
        }}
        layoutId="activeTab"
        initial={false}
        animate={{
          left: activeTab === "login" ? "4px" : "50%",
          width: "calc(50% - 4px)",
        }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      />
      <button
        type="button"
        onClick={() => onTabChange("login")}
        className="flex-1 py-2.5 text-sm font-semibold rounded-lg relative z-10 transition-all duration-200"
        style={{
          color: activeTab === "login" ? colors.titleText : colors.mutedText,
          textShadow: activeTab === "login" ? "0 0 20px rgba(234, 240, 255, 0.3)" : "none",
        }}
      >
        Login
      </button>
      <button
        type="button"
        onClick={() => onTabChange("signup")}
        className="flex-1 py-2.5 text-sm font-semibold rounded-lg relative z-10 transition-all duration-200"
        style={{
          color: activeTab === "signup" ? colors.titleText : colors.mutedText,
          textShadow: activeTab === "signup" ? "0 0 20px rgba(234, 240, 255, 0.3)" : "none",
        }}
      >
        Sign up
      </button>
      {/* Animated underline with glow */}
      <motion.div
        className="absolute -bottom-0.5 h-0.5 rounded-full"
        style={{
          background: `linear-gradient(90deg, ${colors.primaryBtn}, ${colors.accentCyan})`,
          boxShadow: `0 0 12px ${colors.accentCyan}`,
        }}
        layoutId="tabUnderline"
        initial={false}
        animate={{
          left: activeTab === "login" ? "12.5%" : "62.5%",
          width: "25%",
        }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      />
    </div>
  );
}

// =============================================================================
// LOGIN FORM
// =============================================================================

function LoginForm({
  onSubmit,
  isSubmitting,
  error,
  onInputFocus,
}: {
  onSubmit: (email: string, password: string) => Promise<void>;
  isSubmitting: boolean;
  error: string;
  onInputFocus: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(email, password);
  };

  const handleFocus = (field: string) => {
    setFocusedField(field);
    onInputFocus();
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="space-y-5"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="p-4 rounded-xl flex items-center gap-3"
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
            }}
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <PremiumInput
        id="login-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        icon={<Mail className="w-4 h-4" />}
        label="Work email"
        required
        autoComplete="email"
        onFocus={() => handleFocus("email")}
        onBlur={() => setFocusedField(null)}
        isFocused={focusedField === "email"}
        rightIcon={
          email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <Check className="w-4 h-4 text-emerald-400" />
            </motion.div>
          ) : null
        }
      />

      <div>
        <PremiumInput
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          icon={<Lock className="w-4 h-4" />}
          label="Password"
          required
          autoComplete="current-password"
          onFocus={() => handleFocus("password")}
          onBlur={() => setFocusedField(null)}
          isFocused={focusedField === "password"}
          showPasswordToggle
        />
        <div className="flex justify-end mt-2">
          <Link
            href="/forgot-password"
            className="text-xs transition-colors hover:underline"
            style={{ color: colors.mutedText }}
          >
            Forgot password?
          </Link>
        </div>
      </div>

      {/* Submit Button - Enhanced hover */}
      <motion.button
        type="submit"
        disabled={isSubmitting}
        className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 relative overflow-hidden group"
        style={{
          background: colors.primaryBtn,
          boxShadow: colors.primaryBtnGlow,
        }}
        whileHover={{
          scale: 1.03,
          y: -2,
          background: colors.primaryBtnHover,
          boxShadow: `0 0 35px ${colors.primaryBtn}50, 0 12px 40px ${colors.primaryBtn}30`,
        }}
        whileTap={{ scale: 0.97, background: colors.primaryBtnPressed }}
        transition={springs.bounce}
        variants={staggerItem}
      >
        {/* Shimmer effect - faster */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
          initial={{ x: "-100%" }}
          whileHover={{ x: "100%" }}
          transition={{ duration: 0.35 }}
        />
        <span className="relative z-10">
          {isSubmitting ? "Signing in..." : "Continue"}
        </span>
        {!isSubmitting && (
          <motion.span
            className="relative z-10"
            initial={{ x: 0 }}
            whileHover={{ x: 4 }}
            transition={springs.snappy}
          >
            <ArrowRight className="w-4 h-4" />
          </motion.span>
        )}
      </motion.button>

      {/* Divider */}
      <div className="relative my-6">
        <div
          className="absolute inset-0 flex items-center"
          style={{ borderTop: `1px solid ${colors.inputBorder}` }}
        >
          <div className="w-full" />
        </div>
        <div className="relative flex justify-center">
          <span
            className="px-4 text-xs"
            style={{ background: colors.cardBg, color: colors.mutedText }}
          >
            or
          </span>
        </div>
      </div>

      {/* Google Button - Enhanced hover */}
      <motion.button
        type="button"
        className="w-full h-11 rounded-xl text-sm font-medium flex items-center justify-center gap-3 relative overflow-hidden"
        style={{
          background: colors.googleBtn,
          border: `1px solid ${colors.googleBtnBorder}`,
          color: colors.subtitleText,
        }}
        whileHover={{
          background: colors.googleBtnHover,
          borderColor: colors.inputBorderHover,
          y: -2,
          boxShadow: "0 8px 25px rgba(0, 0, 0, 0.2)",
        }}
        whileTap={{ scale: 0.98 }}
        transition={springs.stiff}
        variants={staggerItem}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Continue with Google
      </motion.button>

      {/* Footer text */}
      <p className="text-center text-xs mt-6" style={{ color: colors.mutedText }}>
        By continuing, you agree to{" "}
        <Link href="/terms" className="underline hover:opacity-80">
          Terms
        </Link>{" "}
        &{" "}
        <Link href="/privacy" className="underline hover:opacity-80">
          Privacy
        </Link>
        .
      </p>
    </motion.form>
  );
}

// =============================================================================
// SIGNUP FORM
// =============================================================================

function SignupForm({
  onSubmit,
  isSubmitting,
  error,
  onInputFocus,
}: {
  onSubmit: (name: string, email: string, password: string, workspace: string) => Promise<void>;
  isSubmitting: boolean;
  error: string;
  onInputFocus: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(name, email, password, workspace);
  };

  const handleFocus = (field: string) => {
    setFocusedField(field);
    onInputFocus();
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="space-y-4"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="p-4 rounded-xl flex items-center gap-3"
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
            }}
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <PremiumInput
        id="signup-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="John Doe"
        icon={<User className="w-4 h-4" />}
        label="Full name"
        required
        minLength={2}
        autoComplete="name"
        onFocus={() => handleFocus("name")}
        onBlur={() => setFocusedField(null)}
        isFocused={focusedField === "name"}
      />

      <PremiumInput
        id="signup-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        icon={<Mail className="w-4 h-4" />}
        label="Work email"
        required
        autoComplete="email"
        onFocus={() => handleFocus("email")}
        onBlur={() => setFocusedField(null)}
        isFocused={focusedField === "email"}
        rightIcon={
          email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <Check className="w-4 h-4 text-emerald-400" />
            </motion.div>
          ) : null
        }
      />

      <div>
        <PremiumInput
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          icon={<Lock className="w-4 h-4" />}
          label="Password"
          required
          minLength={8}
          autoComplete="new-password"
          onFocus={() => handleFocus("password")}
          onBlur={() => setFocusedField(null)}
          isFocused={focusedField === "password"}
          showPasswordToggle
        />
        <AnimatePresence>
          {password && <PasswordStrength password={password} />}
        </AnimatePresence>
      </div>

      <PremiumInput
        id="signup-workspace"
        type="text"
        value={workspace}
        onChange={(e) => setWorkspace(e.target.value)}
        placeholder="Acme Inc"
        icon={<Building2 className="w-4 h-4" />}
        label="Workspace name"
        required
        autoComplete="organization"
        onFocus={() => handleFocus("workspace")}
        onBlur={() => setFocusedField(null)}
        isFocused={focusedField === "workspace"}
      />

      {/* Submit Button - Enhanced hover */}
      <motion.button
        type="submit"
        disabled={isSubmitting}
        className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 relative overflow-hidden group mt-6"
        style={{
          background: colors.primaryBtn,
          boxShadow: colors.primaryBtnGlow,
        }}
        whileHover={{
          scale: 1.03,
          y: -2,
          background: colors.primaryBtnHover,
          boxShadow: `0 0 35px ${colors.primaryBtn}50, 0 12px 40px ${colors.primaryBtn}30`,
        }}
        whileTap={{ scale: 0.97, background: colors.primaryBtnPressed }}
        transition={springs.bounce}
        variants={staggerItem}
      >
        {/* Shimmer effect - faster */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
          initial={{ x: "-100%" }}
          whileHover={{ x: "100%" }}
          transition={{ duration: 0.35 }}
        />
        <span className="relative z-10">
          {isSubmitting ? "Creating workspace..." : "Create workspace"}
        </span>
        {!isSubmitting && (
          <motion.span
            className="relative z-10"
            initial={{ x: 0 }}
            whileHover={{ x: 4 }}
            transition={springs.snappy}
          >
            <ArrowRight className="w-4 h-4" />
          </motion.span>
        )}
      </motion.button>

      {/* Divider */}
      <div className="relative my-5">
        <div
          className="absolute inset-0 flex items-center"
          style={{ borderTop: `1px solid ${colors.inputBorder}` }}
        >
          <div className="w-full" />
        </div>
        <div className="relative flex justify-center">
          <span
            className="px-4 text-xs"
            style={{ background: colors.cardBg, color: colors.mutedText }}
          >
            or
          </span>
        </div>
      </div>

      {/* Google Button - Enhanced hover */}
      <motion.button
        type="button"
        className="w-full h-11 rounded-xl text-sm font-medium flex items-center justify-center gap-3 relative overflow-hidden"
        style={{
          background: colors.googleBtn,
          border: `1px solid ${colors.googleBtnBorder}`,
          color: colors.subtitleText,
        }}
        whileHover={{
          background: colors.googleBtnHover,
          borderColor: colors.inputBorderHover,
          y: -2,
          boxShadow: "0 8px 25px rgba(0, 0, 0, 0.2)",
        }}
        whileTap={{ scale: 0.98 }}
        transition={springs.stiff}
        variants={staggerItem}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Sign up with Google
      </motion.button>

      {/* Footer text */}
      <p className="text-center text-xs mt-4" style={{ color: colors.mutedText }}>
        By creating an account, you agree to{" "}
        <Link href="/terms" className="underline hover:opacity-80">
          Terms
        </Link>{" "}
        &{" "}
        <Link href="/privacy" className="underline hover:opacity-80">
          Privacy
        </Link>
        .
      </p>
    </motion.form>
  );
}

// =============================================================================
// LEFT BRAND PANEL
// =============================================================================

function BrandPanel() {
  const features = [
    { icon: Zap, text: "AI-powered candidate screening" },
    { icon: Target, text: "Real-time interview copilots" },
    { icon: FileText, text: "Pipeline analytics and insights" },
  ];

  return (
    <motion.div
      className="hidden lg:flex flex-col justify-end h-full p-12 relative"
      variants={leftPanelVariants}
      initial="initial"
      animate="animate"
    >
      {/* Gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            linear-gradient(135deg, rgba(79, 124, 255, 0.16) 0%, transparent 50%),
            linear-gradient(225deg, rgba(56, 189, 248, 0.10) 0%, transparent 50%)
          `,
        }}
      />

      {/* Content positioned at bottom-left */}
      <div className="relative z-10 max-w-md">
        {/* Platform Badge */}
        <motion.div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
          style={{
            border: `1px solid ${colors.accentCyan}`,
            background: "rgba(56, 189, 248, 0.1)",
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: colors.accentCyan }}
          />
          <span className="text-xs font-medium" style={{ color: colors.accentCyan }}>
            AI RECRUITING PLATFORM
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          className="text-4xl xl:text-5xl font-bold leading-tight mb-4"
          style={{
            color: colors.titleText,
            fontFamily: "'Space Grotesk', sans-serif",
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          One Platform.{" "}
          <span className="relative">
            Every Hire
            <span
              className="absolute -bottom-1 left-0 right-0 h-1 rounded-full"
              style={{
                background: colors.accentCyan,
                boxShadow: `0 0 20px ${colors.accentCyan}`,
              }}
            />
          </span>
          .
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          className="text-lg mb-8"
          style={{ color: colors.subtitleText }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          From sourcing to signed offer — AI copilots at every step.
        </motion.p>

        {/* Feature bullets - increased contrast */}
        <motion.div
          className="space-y-3.5 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          {features.map((feature, i) => (
            <motion.div
              key={i}
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 + i * 0.1 }}
            >
              <feature.icon className="w-4 h-4" style={{ color: colors.accentCyan }} />
              <span className="text-sm font-medium" style={{ color: colors.bulletText }}>
                {feature.text}
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* Trust line */}
        <motion.div
          className="flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <Shield className="w-4 h-4" style={{ color: colors.mutedText }} />
          <span className="text-xs" style={{ color: colors.mutedText }}>
            Candidate data is encrypted. Your workspace controls access.
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// MAIN AUTH PAGE
// =============================================================================

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, signup, isLoading: authLoading, isAuthenticated } = useAuth();

  const initialTab = searchParams.get("tab") === "signup" ? "signup" : "login";
  const [activeTab, setActiveTab] = useState<"login" | "signup">(initialTab);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, authLoading, router]);

  // Update URL when tab changes
  const handleTabChange = useCallback(
    (tab: "login" | "signup") => {
      setActiveTab(tab);
      setError("");
      const newUrl = tab === "signup" ? "/auth?tab=signup" : "/auth";
      window.history.replaceState(null, "", newUrl);
    },
    []
  );

  const handleLogin = async (email: string, password: string) => {
    setError("");
    setIsSubmitting(true);
    try {
      await login({ email, password });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignup = async (
    name: string,
    email: string,
    password: string,
    workspace: string
  ) => {
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsSubmitting(true);
    try {
      await signup({ name, email, password });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputFocus = useCallback(() => {
    setInputFocused(true);
    setTimeout(() => setInputFocused(false), 500);
  }, []);

  if (authLoading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: colors.pageBg }}
      >
        <motion.div
          className="w-12 h-12 rounded-full border-2"
          style={{
            borderColor: colors.inputBorder,
            borderTopColor: colors.primaryBtn,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </main>
    );
  }

  return (
    <main
      className="min-h-screen flex"
      style={{ background: colors.pageBg }}
    >
      {/* Animated gradient line at top */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-0.5 z-50"
        style={{
          background: `linear-gradient(90deg, ${colors.primaryBtn}, ${colors.accentCyan}, ${colors.primaryBtn})`,
          backgroundSize: "200% 100%",
        }}
        animate={{
          backgroundPosition: ["0% 0%", "100% 0%", "0% 0%"],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      />

      {/* Left Panel - Brand + 3D Background */}
      <div className="hidden lg:block lg:w-[60%] relative">
        <SignalConstellation nodeCount={50} onInputFocus={inputFocused} />
        <BrandPanel />
      </div>

      {/* Gradient bridge overlay - connects left and right panels */}
      <div
        className="hidden lg:block fixed inset-0 pointer-events-none z-10"
        style={{
          background: `
            linear-gradient(90deg, transparent 55%, rgba(79, 124, 255, 0.03) 65%, rgba(79, 124, 255, 0.05) 100%),
            radial-gradient(ellipse 40% 50% at 60% 50%, rgba(56, 189, 248, 0.04), transparent)
          `,
        }}
      />

      {/* Right Panel - Auth Card */}
      <motion.div
        className="w-full lg:w-[40%] flex items-center justify-center p-6 lg:p-12 relative z-20"
        variants={pageVariants}
        initial="initial"
        animate="animate"
      >
        <motion.div
          className="w-full max-w-[440px]"
          variants={cardVariants}
          style={{ marginTop: "-20px" }} // Move card slightly upward
        >
          {/* Card with premium top border highlight */}
          <div
            className="rounded-[20px] p-8 lg:p-10 relative overflow-hidden"
            style={{
              background: colors.cardBg,
              border: `1px solid ${colors.cardBorder}`,
              backdropFilter: "blur(24px)",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.35)",
            }}
          >
            {/* Premium top border highlight */}
            <div
              className="absolute top-0 left-4 right-4 h-px"
              style={{
                background: `linear-gradient(90deg, transparent, ${colors.cardTopBorder}, transparent)`,
              }}
            />
            {/* Logo + Header */}
            <div className="text-center mb-6">
              <Link href="/" className="inline-flex items-center gap-2 mb-6">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: colors.primaryBtn }}
                >
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span
                  className="text-xl font-semibold"
                  style={{ color: colors.titleText }}
                >
                  Briefing Room
                </span>
              </Link>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <h2
                    className="text-2xl font-bold mb-1"
                    style={{ color: colors.titleText }}
                  >
                    {activeTab === "login" ? "Welcome back" : "Create your workspace"}
                  </h2>
                  <p className="text-sm" style={{ color: colors.subtitleText }}>
                    {activeTab === "login"
                      ? "Turn conversations into structured evidence."
                      : "Start capturing interview signals, live."}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Tabs */}
            <TabSwitcher activeTab={activeTab} onTabChange={handleTabChange} />

            {/* Form */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                variants={formVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                {activeTab === "login" ? (
                  <LoginForm
                    onSubmit={handleLogin}
                    isSubmitting={isSubmitting}
                    error={error}
                    onInputFocus={handleInputFocus}
                  />
                ) : (
                  <SignupForm
                    onSubmit={handleSignup}
                    isSubmitting={isSubmitting}
                    error={error}
                    onInputFocus={handleInputFocus}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>

      {/* Mobile: Show condensed brand info */}
      <div className="lg:hidden fixed top-0 left-0 right-0 pt-4 px-6 z-40">
        <div
          className="py-3 rounded-xl text-center"
          style={{ background: "rgba(12, 17, 32, 0.9)", backdropFilter: "blur(12px)" }}
        >
          <p className="text-xs" style={{ color: colors.subtitleText }}>
            One Platform. Every Hire.
          </p>
        </div>
      </div>

      {/* Noise texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-30 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </main>
  );
}
