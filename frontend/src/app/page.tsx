"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Mic, Users, Sparkles, ArrowRight, Briefcase } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect authenticated users to jobs page
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/jobs");
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <main className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </main>
    );
  }

  // Don't render landing page for authenticated users (they'll be redirected)
  if (isAuthenticated) {
    return (
      <main className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen gradient-bg text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#000000]/80 backdrop-blur-md border-b border-white/5 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/10">
              <span className="text-sm">⚛️</span>
            </div>
            <h1 className="text-lg font-light tracking-wide text-white">Briefing Room</h1>
          </div>
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <div className="pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          {/* Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[100px] -z-10 animate-pulse" />

          {/* Main Title */}
          <h2 className="text-6xl md:text-7xl font-bold tracking-tight mb-6">
            <span className="bg-gradient-to-r from-white via-white to-white/50 bg-clip-text text-transparent">
              Uncover Hidden
            </span>
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Talent Signals
            </span>
          </h2>

          <p className="text-xl text-white/60 max-w-2xl mx-auto leading-relaxed mb-12">
            Briefing Room uses multi-modal AI to analyze candidates beyond keywords.
            <br />
            Create job profiles, conduct AI interviews, and hire with confidence.
          </p>

          {/* Single CTA */}
          <div className="flex flex-col items-center gap-6">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 rounded-full font-medium text-lg transition-all shadow-lg shadow-indigo-500/25"
            >
              <Briefcase className="w-5 h-5" />
              Get Started
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <p className="text-white/40 text-sm">
              Already have an account?{" "}
              <Link href="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                Sign in
              </Link>
            </p>
          </div>

          {/* What you'll get */}
          <div className="mt-16 glass-panel rounded-3xl p-8 max-w-3xl mx-auto border border-white/10">
            <h3 className="text-lg font-medium text-white/80 mb-6">Everything you need to hire smarter</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-left">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-indigo-400 text-sm font-bold">1</span>
                </div>
                <div>
                  <p className="text-white font-medium text-sm">Create Jobs</p>
                  <p className="text-white/40 text-xs">Paste JD, AI extracts requirements</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-purple-400 text-sm font-bold">2</span>
                </div>
                <div>
                  <p className="text-white font-medium text-sm">Upload Candidates</p>
                  <p className="text-white/40 text-xs">CSV import with resume parsing</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-cyan-400 text-sm font-bold">3</span>
                </div>
                <div>
                  <p className="text-white font-medium text-sm">AI Interviews</p>
                  <p className="text-white/40 text-xs">Voice interviews with analysis</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-green-400 text-sm font-bold">4</span>
                </div>
                <div>
                  <p className="text-white font-medium text-sm">Hire Ready</p>
                  <p className="text-white/40 text-xs">Ranked candidates with scores</p>
                </div>
              </div>
            </div>
          </div>

          {/* Feature highlights */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="text-center p-6">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                <Mic className="w-6 h-6 text-indigo-400" />
              </div>
              <h4 className="font-medium text-white mb-2">Voice-First Onboarding</h4>
              <p className="text-sm text-white/40">
                Talk naturally with AI to capture job requirements, team context, and candidate traits
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-purple-400" />
              </div>
              <h4 className="font-medium text-white mb-2">AI-Powered Interviews</h4>
              <p className="text-sm text-white/40">
                Conduct structured interviews with AI that adapts to your hiring criteria
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6 text-cyan-400" />
              </div>
              <h4 className="font-medium text-white mb-2">Smart Candidate Analysis</h4>
              <p className="text-sm text-white/40">
                Extract insights from resumes and rank candidates based on actual job fit
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
