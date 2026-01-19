"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Mail, Lock, AlertCircle, ArrowRight, Sparkles, Zap, Shield, Users } from "lucide-react";
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
      staggerChildren: 0.1,
      delayChildren: 0.2,
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
  { icon: Zap, label: "AI-Powered", color: "from-teal-400 to-teal-500" },
  { icon: Shield, label: "Enterprise Ready", color: "from-orange-400 to-orange-500" },
  { icon: Users, label: "Team Collaboration", color: "from-teal-500 to-cyan-500" },
];

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login({ email, password });
      router.push("/jobs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Spinner size="lg" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-6 overflow-hidden relative">
      {/* Premium Animated Background */}
      <PremiumAuthBackground />

      {/* Floating Feature Badges - Desktop only */}
      <div className="hidden lg:block">
        {features.map((feature, index) => (
          <motion.div
            key={feature.label}
            className="absolute"
            style={{
              top: `${20 + index * 25}%`,
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
        <motion.div variants={itemVariants} className="text-center mb-10">
          <Link
            href="/"
            className="inline-flex items-center gap-3 mb-8 group"
          >
            <motion.div
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-xl shadow-teal-500/30 relative overflow-hidden"
              whileHover={{ scale: 1.05, rotate: 5 }}
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
            className="text-4xl md:text-5xl font-bold mb-4"
            variants={itemVariants}
          >
            <span className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600 bg-clip-text text-transparent">
              Welcome back
            </span>
          </motion.h1>
          <motion.p
            className="text-slate-500 text-lg"
            variants={itemVariants}
          >
            Sign in to continue to your account
          </motion.p>
        </motion.div>

        {/* Login Form Card */}
        <motion.div
          variants={itemVariants}
          className="relative"
        >
          {/* Card glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-teal-500/20 via-transparent to-orange-500/20 rounded-3xl blur-xl opacity-60" />

          <div className="relative bg-white/90 backdrop-blur-xl rounded-2xl border border-slate-200/60 shadow-2xl shadow-slate-200/50 p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
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

              {/* Email Field */}
              <motion.div
                className="space-y-2"
                animate={{ scale: focusedField === "email" ? 1.02 : 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <Label htmlFor="email">Email address</Label>
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
                    inputSize="lg"
                    className="transition-shadow duration-200"
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-slate-500 hover:text-teal-600 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    required
                    placeholder="Enter your password"
                    leftIcon={<Lock className="w-5 h-5" />}
                    variant="default"
                    inputSize="lg"
                    className="transition-shadow duration-200"
                  />
                  {focusedField === "password" && (
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
                  className="mt-2 relative overflow-hidden group"
                >
                  <span className="relative z-10">
                    {isSubmitting ? "Signing in..." : "Sign in"}
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
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-4 bg-white text-slate-500">
                  New to Briefing Room?
                </span>
              </div>
            </div>

            {/* Sign Up Link */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                variant="outline"
                size="lg"
                fullWidth
                onClick={() => router.push("/signup")}
                className="group"
              >
                <span>Create an account</span>
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
          className="text-center mt-8 text-xs text-slate-500"
        >
          By signing in, you agree to our{" "}
          <Link href="/terms" className="text-slate-600 hover:text-teal-600 transition-colors underline-offset-2 hover:underline">
            Terms of Service
          </Link>
          {" "}and{" "}
          <Link href="/privacy" className="text-slate-600 hover:text-teal-600 transition-colors underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
        </motion.p>

        {/* Trust indicators */}
        <motion.div
          variants={itemVariants}
          className="flex items-center justify-center gap-6 mt-6"
        >
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Shield className="w-3.5 h-3.5" />
            <span>256-bit SSL</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Lock className="w-3.5 h-3.5" />
            <span>SOC 2 Compliant</span>
          </div>
        </motion.div>
      </motion.div>
    </main>
  );
}
