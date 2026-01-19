"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Mail, Lock, User, ArrowRight, AlertCircle, Sparkles, Check, Zap, BarChart3, Brain } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PremiumAuthBackground } from "@/components/ui/animated-background";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Spinner } from "@/components/ui/motion";

// Stagger animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 12,
    },
  },
};

// Floating feature badges
const features = [
  { icon: Zap, label: "Instant Setup", color: "from-teal-400 to-teal-500" },
  { icon: Brain, label: "AI Insights", color: "from-orange-400 to-orange-500" },
  { icon: BarChart3, label: "Analytics", color: "from-teal-500 to-cyan-500" },
];

// Benefits list
const benefits = [
  "AI-powered candidate analysis",
  "In-meeting copilot assistance",
  "End-to-end pipeline tracking",
];

export default function SignupPage() {
  const router = useRouter();
  const { signup, isLoading: authLoading } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsSubmitting(true);

    try {
      await signup({ name, email, password });
      router.push("/jobs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Password strength indicator
  const getPasswordStrength = () => {
    if (!password) return { strength: 0, label: "", color: "" };
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    const levels = [
      { label: "Weak", color: "bg-red-500" },
      { label: "Fair", color: "bg-amber-500" },
      { label: "Good", color: "bg-emerald-500" },
      { label: "Strong", color: "bg-emerald-400" },
    ];

    return { strength, ...levels[Math.min(strength - 1, 3)] };
  };

  const passwordStrength = getPasswordStrength();

  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Spinner size="lg" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-6 py-12 overflow-hidden relative">
      {/* Premium Animated Background */}
      <PremiumAuthBackground />

      {/* Floating Feature Badges - Desktop only */}
      <div className="hidden lg:block">
        {features.map((feature, index) => (
          <motion.div
            key={feature.label}
            className="absolute"
            style={{
              top: `${15 + index * 28}%`,
              left: index % 2 === 0 ? '5%' : 'auto',
              right: index % 2 === 1 ? '5%' : 'auto',
            }}
            initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + index * 0.2, duration: 0.6 }}
          >
            <motion.div
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-slate-200/60 shadow-lg shadow-slate-200/50"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3 + index, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${feature.color} flex items-center justify-center`}>
                <feature.icon className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-slate-700">{feature.label}</span>
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Content */}
      <motion.div
        className="relative z-10 w-full max-w-md"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Logo & Header */}
        <motion.div variants={itemVariants} className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-3 mb-6 group"
          >
            <motion.div
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-xl shadow-teal-500/30 relative overflow-hidden"
              whileHover={{ scale: 1.05, rotate: -5 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              {/* Shine effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              />
              <Sparkles className="w-7 h-7 text-white relative z-10" />
            </motion.div>
            <span className="text-2xl font-semibold tracking-tight text-slate-800 group-hover:text-slate-900 transition-colors">
              Briefing Room
            </span>
          </Link>

          <motion.h1
            className="text-4xl md:text-5xl font-bold mb-3"
            variants={itemVariants}
          >
            <span className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600 bg-clip-text text-transparent">
              Get started free
            </span>
          </motion.h1>
          <motion.p
            className="text-slate-500 text-lg"
            variants={itemVariants}
          >
            Start hiring smarter with AI-powered interviews
          </motion.p>

          {/* Benefits list */}
          <motion.div variants={itemVariants} className="flex flex-wrap justify-center gap-3 mt-4">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit}
                className="flex items-center gap-1.5 text-sm text-slate-600"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + index * 0.1 }}
              >
                <div className="w-4 h-4 rounded-full bg-teal-100 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-teal-600" />
                </div>
                <span>{benefit}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Signup Form Card */}
        <motion.div
          variants={itemVariants}
          className="relative"
        >
          {/* Card glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-teal-500/20 via-transparent to-orange-500/20 rounded-3xl blur-xl opacity-60" />

          <div className="relative bg-white/90 backdrop-blur-xl rounded-2xl border border-slate-200/60 shadow-2xl shadow-slate-200/50 p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Error Alert */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -10, height: 0 }}
                    className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3"
                  >
                    <div className="shrink-0 p-1.5 rounded-lg bg-red-100">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    </div>
                    <p className="text-sm text-red-700">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Name Field */}
              <motion.div
                className="space-y-2"
                animate={{ scale: focusedField === "name" ? 1.02 : 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <Label htmlFor="name">Full name</Label>
                <div className="relative">
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onFocus={() => setFocusedField("name")}
                    onBlur={() => setFocusedField(null)}
                    required
                    minLength={2}
                    placeholder="John Doe"
                    leftIcon={<User className="w-5 h-5" />}
                    variant="default"
                  />
                  {focusedField === "name" && (
                    <motion.div
                      className="absolute -inset-0.5 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl opacity-20 -z-10"
                      layoutId="fieldFocus"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </div>
              </motion.div>

              {/* Email Field */}
              <motion.div
                className="space-y-2"
                animate={{ scale: focusedField === "email" ? 1.02 : 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <Label htmlFor="email">Work email</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    required
                    placeholder="you@company.com"
                    leftIcon={<Mail className="w-5 h-5" />}
                    variant="default"
                  />
                  {focusedField === "email" && (
                    <motion.div
                      className="absolute -inset-0.5 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl opacity-20 -z-10"
                      layoutId="fieldFocus"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </div>
              </motion.div>

              {/* Password Field */}
              <motion.div
                className="space-y-2"
                animate={{ scale: focusedField === "password" ? 1.02 : 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                    leftIcon={<Lock className="w-5 h-5" />}
                    variant="default"
                  />
                  {focusedField === "password" && (
                    <motion.div
                      className="absolute -inset-0.5 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl opacity-20 -z-10"
                      layoutId="fieldFocus"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </div>
                {/* Password Strength Indicator */}
                <AnimatePresence>
                  {password && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2 mt-2"
                    >
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden flex gap-0.5">
                        {[1, 2, 3, 4].map((level) => (
                          <motion.div
                            key={level}
                            className={`flex-1 h-full rounded-full transition-colors ${
                              passwordStrength.strength >= level
                                ? passwordStrength.color
                                : "bg-slate-100"
                            }`}
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: passwordStrength.strength >= level ? 1 : 0 }}
                            transition={{ delay: level * 0.1 }}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-slate-500 min-w-[50px]">
                        {passwordStrength.label}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Confirm Password Field */}
              <motion.div
                className="space-y-2"
                animate={{ scale: focusedField === "confirmPassword" ? 1.02 : 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onFocus={() => setFocusedField("confirmPassword")}
                    onBlur={() => setFocusedField(null)}
                    required
                    placeholder="Confirm your password"
                    leftIcon={<Lock className="w-5 h-5" />}
                    variant="default"
                    rightIcon={
                      confirmPassword && password === confirmPassword ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 400, damping: 10 }}
                        >
                          <Check className="w-4 h-4 text-emerald-500" />
                        </motion.div>
                      ) : null
                    }
                  />
                  {focusedField === "confirmPassword" && (
                    <motion.div
                      className="absolute -inset-0.5 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl opacity-20 -z-10"
                      layoutId="fieldFocus"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </div>
              </motion.div>

              {/* Submit Button */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={isSubmitting}
                  rightIcon={!isSubmitting && <ArrowRight className="w-4 h-4" />}
                  className="mt-4 relative overflow-hidden group"
                >
                  <span className="relative z-10">
                    {isSubmitting ? "Creating account..." : "Create account"}
                  </span>
                  {/* Button shine effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    initial={{ x: "-100%" }}
                    whileHover={{ x: "100%" }}
                    transition={{ duration: 0.6 }}
                  />
                </Button>
              </motion.div>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-4 bg-white text-slate-500">
                  Already have an account?
                </span>
              </div>
            </div>

            {/* Login Link */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                variant="outline"
                size="lg"
                fullWidth
                onClick={() => router.push("/login")}
                className="group"
              >
                <span>Sign in instead</span>
                <motion.span
                  className="ml-2 opacity-0 group-hover:opacity-100"
                  initial={{ x: -10 }}
                  whileHover={{ x: 0 }}
                >
                  <ArrowRight className="w-4 h-4" />
                </motion.span>
              </Button>
            </motion.div>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.p
          variants={itemVariants}
          className="text-center mt-6 text-xs text-slate-500"
        >
          By creating an account, you agree to our{" "}
          <Link href="/terms" className="text-slate-600 hover:text-teal-600 transition-colors underline-offset-2 hover:underline">
            Terms of Service
          </Link>
          {" "}and{" "}
          <Link href="/privacy" className="text-slate-600 hover:text-teal-600 transition-colors underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
        </motion.p>
      </motion.div>
    </main>
  );
}
