"use client";

import Link from "next/link";
import { Mic, FileText, Sparkles, Users, ArrowRight, Zap } from "lucide-react";

export default function HomePage() {
    // Debug: Log that this page is rendering
    console.log("🏠 HomePage rendering - this is the root page");

    return (
        <main className="min-h-screen gradient-bg text-white">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#000000]/80 backdrop-blur-md border-b border-white/5 py-4">
                <div className="flex items-center justify-center max-w-7xl mx-auto px-6">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/10">
                            <span className="text-sm">⚛️</span>
                        </div>
                        <h1 className="text-lg font-light tracking-wide text-white">Superposition</h1>
                    </div>
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

                    <p className="text-xl text-white/60 max-w-2xl mx-auto leading-relaxed mb-16">
                        Superposition uses multi-modal AI to analyze candidates beyond keywords.
                        <br />
                        Create job profiles via voice, analyze specific job needs, and conduct AI interviews.
                    </p>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                        {/* Option 1: Full Voice Workflow */}
                        <Link href="/onboard" className="group">
                            <div className="glass-panel rounded-3xl p-8 h-full border border-white/10 hover:border-indigo-500/50 transition-all duration-300 hover:bg-white/5 relative overflow-hidden">
                                {/* Gradient accent */}
                                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="flex flex-col items-center text-center space-y-4">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Mic className="w-8 h-8 text-indigo-400" />
                                    </div>

                                    <div className="space-y-2">
                                        <h3 className="text-xl font-semibold text-white flex items-center justify-center gap-2">
                                            Voice Intake + AI Interviews
                                            <Sparkles className="w-4 h-4 text-indigo-400" />
                                        </h3>
                                        <p className="text-white/50 text-sm leading-relaxed">
                                            Complete workflow: Talk to our AI to create a job profile,
                                            then run AI-powered interviews with candidates.
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-2 justify-center mt-4">
                                        <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
                                            Voice Onboarding
                                        </span>
                                        <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300">
                                            AI Interviews
                                        </span>
                                        <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300">
                                            Offer Prep
                                        </span>
                                    </div>

                                    <div className="pt-4 flex items-center gap-2 text-indigo-400 text-sm font-medium group-hover:gap-3 transition-all">
                                        Start Voice Flow
                                        <ArrowRight className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                        </Link>

                        {/* Option 2: Quick Start - JD + Candidates */}
                        <Link href="/quick-start" className="group">
                            <div className="glass-panel rounded-3xl p-8 h-full border border-white/10 hover:border-green-500/50 transition-all duration-300 hover:bg-white/5 relative overflow-hidden">
                                {/* Gradient accent */}
                                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="flex flex-col items-center text-center space-y-4">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/20 to-cyan-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <FileText className="w-8 h-8 text-green-400" />
                                    </div>

                                    <div className="space-y-2">
                                        <h3 className="text-xl font-semibold text-white flex items-center justify-center gap-2">
                                            Quick Start
                                            <Zap className="w-4 h-4 text-green-400" />
                                        </h3>
                                        <p className="text-white/50 text-sm leading-relaxed">
                                            Paste a job description, upload candidates, run interviews, and prepare offers.
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-2 justify-center mt-4">
                                        <span className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-xs text-green-300">
                                            Paste JD
                                        </span>
                                        <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300">
                                            Upload Resumes
                                        </span>
                                        <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300">
                                            AI Interviews
                                        </span>
                                        <span className="px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-xs text-pink-300">
                                            Offer Prep
                                        </span>
                                    </div>

                                    <div className="pt-4 flex items-center gap-2 text-green-400 text-sm font-medium group-hover:gap-3 transition-all">
                                        Get Started
                                        <ArrowRight className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                        </Link>
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
