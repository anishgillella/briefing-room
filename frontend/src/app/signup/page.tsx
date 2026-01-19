"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Mail, Lock, User, ArrowRight, AlertCircle, Sparkles, Check } from "lucide-react";
import { motion } from "framer-motion";
import { MeshGradient } from "@/components/ui/animated-background";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { FadeInUp, Spinner } from "@/components/ui/motion";

export default function SignupPage() {
  const router = useRouter();
  const { signup, isLoading: authLoading } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      <main className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <Spinner size="lg" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#09090b] text-white flex items-center justify-center px-6 py-12 overflow-hidden">
      {/* Animated Background */}
      <MeshGradient />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo & Header */}
        <FadeInUp delay={0}>
          <div className="text-center mb-10">
            <Link
              href="/"
              className="inline-flex items-center gap-3 mb-8 group"
            >
              <motion.div
                className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center border border-white/10 shadow-lg shadow-purple-500/10"
                whileHover={{ scale: 1.05, rotate: -5 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Sparkles className="w-6 h-6 text-purple-400" />
              </motion.div>
              <span className="text-xl font-medium tracking-tight text-white/90 group-hover:text-white transition-colors">
                Briefing Room
              </span>
            </Link>

            <motion.h1
              className="text-4xl font-bold mb-3 bg-gradient-to-r from-white via-white to-zinc-400 bg-clip-text text-transparent"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              Create your account
            </motion.h1>
            <motion.p
              className="text-zinc-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              Start hiring smarter with AI-powered interviews
            </motion.p>
          </div>
        </FadeInUp>

        {/* Signup Form Card */}
        <FadeInUp delay={0.1}>
          <Card variant="glass" padding="lg" className="backdrop-blur-2xl">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Error Alert */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3"
                >
                  <div className="shrink-0 p-1 rounded-lg bg-red-500/20">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  </div>
                  <p className="text-sm text-red-300">{error}</p>
                </motion.div>
              )}

              {/* Name Field */}
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  placeholder="John Doe"
                  leftIcon={<User className="w-5 h-5" />}
                  variant="glass"
                />
              </div>

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                  leftIcon={<Mail className="w-5 h-5" />}
                  variant="glass"
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  leftIcon={<Lock className="w-5 h-5" />}
                  variant="glass"
                />
                {/* Password Strength Indicator */}
                {password && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden flex gap-0.5">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`flex-1 h-full rounded-full transition-colors ${
                            passwordStrength.strength >= level
                              ? passwordStrength.color
                              : "bg-zinc-800"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-zinc-500">
                      {passwordStrength.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Confirm your password"
                  leftIcon={<Lock className="w-5 h-5" />}
                  variant="glass"
                  rightIcon={
                    confirmPassword && password === confirmPassword ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : null
                  }
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={isSubmitting}
                rightIcon={!isSubmitting && <ArrowRight className="w-4 h-4" />}
                className="mt-4"
              >
                {isSubmitting ? "Creating account..." : "Create account"}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-4 bg-zinc-900/80 text-zinc-500">
                  Already have an account?
                </span>
              </div>
            </div>

            {/* Login Link */}
            <Button
              variant="outline"
              size="lg"
              fullWidth
              onClick={() => router.push("/login")}
            >
              Sign in instead
            </Button>
          </Card>
        </FadeInUp>

        {/* Footer */}
        <FadeInUp delay={0.2}>
          <p className="text-center mt-8 text-xs text-zinc-600">
            By creating an account, you agree to our{" "}
            <Link href="/terms" className="text-zinc-500 hover:text-white transition-colors">
              Terms of Service
            </Link>
            {" "}and{" "}
            <Link href="/privacy" className="text-zinc-500 hover:text-white transition-colors">
              Privacy Policy
            </Link>
          </p>
        </FadeInUp>
      </div>
    </main>
  );
}
