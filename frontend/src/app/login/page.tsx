"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Mail, Lock, LogIn, AlertCircle, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { MeshGradient } from "@/components/ui/animated-background";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { FadeInUp, Spinner } from "@/components/ui/motion";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      <main className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <Spinner size="lg" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#09090b] text-white flex items-center justify-center px-6 overflow-hidden">
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
                className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-white/10 shadow-lg shadow-indigo-500/10"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Sparkles className="w-6 h-6 text-indigo-400" />
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
              Welcome back
            </motion.h1>
            <motion.p
              className="text-zinc-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              Sign in to continue to your account
            </motion.p>
          </div>
        </FadeInUp>

        {/* Login Form Card */}
        <FadeInUp delay={0.1}>
          <Card variant="glass" padding="lg" className="backdrop-blur-2xl">
            <form onSubmit={handleSubmit} className="space-y-6">
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

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                  leftIcon={<Mail className="w-5 h-5" />}
                  variant="glass"
                  inputSize="lg"
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-zinc-500 hover:text-indigo-400 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  leftIcon={<Lock className="w-5 h-5" />}
                  variant="glass"
                  inputSize="lg"
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
                className="mt-2"
              >
                {isSubmitting ? "Signing in..." : "Sign in"}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-4 bg-zinc-900/80 text-zinc-500">
                  New to Briefing Room?
                </span>
              </div>
            </div>

            {/* Sign Up Link */}
            <Button
              variant="outline"
              size="lg"
              fullWidth
              onClick={() => router.push("/signup")}
            >
              Create an account
            </Button>
          </Card>
        </FadeInUp>

        {/* Footer */}
        <FadeInUp delay={0.2}>
          <p className="text-center mt-8 text-xs text-zinc-600">
            By signing in, you agree to our{" "}
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
