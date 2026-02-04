"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    User,
    CheckCircle,
    MessageSquare,
    Zap,
    BarChart3,
    TrendingUp,
    Search,
    MoreHorizontal,
    Mic,
    Send,
    FileText,
    Sparkles,
    Check
} from "lucide-react";

// =============================================================================
// SHARED STYLES & TOKENS
// =============================================================================

const colors = {
    cardBg: "#0F172A",
    primary: "#6366F1",
    accentCyan: "#38BDF8",
    accentGreen: "#22C55E",
    accentAmber: "#F59E0B",
    accentRose: "#F43F5E",
    text: "#F8FAFC",
    textMuted: "#64748B",
    border: "rgba(255, 255, 255, 0.08)",
};

// =============================================================================
// DEMO 1: JOB PROFILE ENRICHMENT (Parsing JD)
// =============================================================================

export function JobProfileDemo() {
    const [step, setStep] = useState<"typing" | "processing" | "results">("typing");
    const [typedText, setTypedText] = useState("");
    const fullText = "We are looking for a Senior React Engineer with 5+ years of experience in TypeScript and Node.js. Must have experience with System Design and AWS.";

    useEffect(() => {
        let isMounted = true;
        let timeout: NodeJS.Timeout;

        const runDemo = async () => {
            // Phase 1: Typing
            if (step === "typing") {
                for (let i = 0; i <= fullText.length; i++) {
                    if (!isMounted) return;
                    await new Promise(r => setTimeout(r, 30));
                    setTypedText(fullText.slice(0, i));
                }
                if (!isMounted) return;
                await new Promise(r => setTimeout(r, 500));
                setStep("processing");
            }

            // Phase 2: Processing
            if (step === "processing") {
                await new Promise(r => setTimeout(r, 1500));
                if (!isMounted) return;
                setStep("results");
            }

            // Phase 3: Results (hold then reset)
            if (step === "results") {
                await new Promise(r => setTimeout(r, 4000));
                if (!isMounted) return;
                setStep("typing");
                setTypedText("");
            }
        };

        runDemo();
        return () => { isMounted = false; };
    }, [step]); // Re-run when step changes to trigger next phase logic

    return (
        <div className="w-full h-full min-h-[280px] flex flex-col p-6 relative overflow-hidden">
            <AnimatePresence mode="wait">
                {step === "results" ? (
                    <motion.div
                        key="results"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        className="flex flex-col gap-3 h-full justify-center"
                    >
                        <div className="flex items-center gap-2 text-emerald-400 mb-2">
                            <CheckCircle className="w-5 h-5" />
                            <span className="font-semibold text-sm">Profile Enriched</span>
                        </div>

                        <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                            <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-2">Extracted Signals</div>
                            <div className="flex flex-wrap gap-2">
                                {["React", "TypeScript", "Node.js", "System Design", "AWS"].map((skill, i) => (
                                    <motion.div
                                        key={skill}
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: i * 0.1 }}
                                        className="px-2 py-1 rounded-md bg-indigo-500/20 text-indigo-300 text-xs font-medium border border-indigo-500/30"
                                    >
                                        {skill}
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                            <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-2">Rubric Generated</div>
                            <div className="space-y-2">
                                <div className="h-1.5 w-3/4 bg-slate-700 rounded-full overflow-hidden">
                                    <motion.div className="h-full bg-emerald-500" initial={{ width: 0 }} animate={{ width: "80%" }} transition={{ delay: 0.5, duration: 1 }} />
                                </div>
                                <div className="h-1.5 w-1/2 bg-slate-700 rounded-full overflow-hidden">
                                    <motion.div className="h-full bg-blue-500" initial={{ width: 0 }} animate={{ width: "60%" }} transition={{ delay: 0.7, duration: 1 }} />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="input"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col h-full"
                    >
                        <div className="flex items-center gap-2 mb-3 text-slate-400">
                            <FileText className="w-4 h-4" />
                            <span className="text-xs font-medium">Job Description</span>
                        </div>
                        <div className="flex-1 bg-black/20 rounded-lg p-3 text-sm text-slate-300 font-mono leading-relaxed border border-white/5 relative overflow-hidden">
                            {typedText}
                            {step === "typing" && <span className="animate-pulse">|</span>}

                            {step === "processing" && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center flex-col gap-3"
                                >
                                    <div className="relative">
                                        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                                        <Sparkles className="w-4 h-4 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                    </div>
                                    <span className="text-xs font-medium text-indigo-400">Extracting Signals...</span>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}


// =============================================================================
// DEMO 2: SOURCING & SCREENING (Real-time sorting)
// =============================================================================

export function SourcingDemo() {
    const [candidates, setCandidates] = useState([
        { id: 1, name: "Sarah Chen", role: "Senior FE", score: 0, status: "Pending" },
        { id: 2, name: "Marcus J.", role: "Full Stack", score: 0, status: "Pending" },
        { id: 3, name: "Alia R.", role: "Backend", score: 0, status: "Pending" },
    ]);

    const [phase, setPhase] = useState<"scanning" | "sorting" | "complete">("scanning");

    useEffect(() => {
        let timeout: NodeJS.Timeout;

        // Phase 1: Simulate scanning (scores ticking up)
        if (phase === "scanning") {
            const interval = setInterval(() => {
                setCandidates((prev) =>
                    prev.map((c) => {
                        const target = c.id === 1 ? 94 : c.id === 2 ? 88 : 72;
                        if (c.score < target) {
                            return { ...c, score: Math.min(c.score + Math.floor(Math.random() * 5) + 1, target) };
                        }
                        return c;
                    })
                );
            }, 100);

            timeout = setTimeout(() => {
                clearInterval(interval);
                setPhase("sorting");
            }, 2000);

            return () => {
                clearInterval(interval);
                clearTimeout(timeout);
            };
        }

        // Phase 2: Sort by score
        if (phase === "sorting") {
            timeout = setTimeout(() => {
                setCandidates((prev) => [...prev].sort((a, b) => b.score - a.score));
                setPhase("complete");
            }, 800);
        }

        // Phase 3: Reset loop
        if (phase === "complete") {
            timeout = setTimeout(() => {
                setCandidates([
                    { id: 1, name: "Sarah Chen", role: "Senior FE", score: 0, status: "Pending" },
                    { id: 2, name: "Marcus J.", role: "Full Stack", score: 0, status: "Pending" },
                    { id: 3, name: "Alia R.", role: "Backend", score: 0, status: "Pending" },
                ]);
                setPhase("scanning");
            }, 3000);
        }

        return () => clearTimeout(timeout);
    }, [phase]);

    return (
        <div className="w-full h-full min-h-[280px] flex flex-col p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                    <Search className="w-3.5 h-3.5" />
                    <span>3 Candidates Found</span>
                </div>
                <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500/20" />
                    <div className="w-2 h-2 rounded-full bg-yellow-500/20" />
                    <div className="w-2 h-2 rounded-full bg-green-500/20" />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 space-y-2 relative">
                <AnimatePresence mode="popLayout">
                    {candidates.map((candidate) => (
                        <motion.div
                            layout
                            key={candidate.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400">
                                    {candidate.name[0]}
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-slate-200">{candidate.name}</div>
                                    <div className="text-[10px] text-slate-500">{candidate.role}</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* Score badge */}
                                <div className="text-right">
                                    <div className="text-xs font-bold font-mono text-cyan-400">
                                        {candidate.score > 0 ? `${candidate.score}%` : "..."}
                                    </div>
                                    <div className="text-[10px] text-slate-500">Fit</div>
                                </div>

                                {/* Status Indicator */}
                                <motion.div
                                    className="w-1.5 h-1.5 rounded-full"
                                    animate={{
                                        backgroundColor:
                                            candidate.score > 90
                                                ? colors.accentGreen
                                                : candidate.score > 80
                                                    ? colors.accentCyan
                                                    : colors.textMuted,
                                        boxShadow: candidate.score > 90 ? `0 0 8px ${colors.accentGreen}` : "none",
                                    }}
                                />
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* Scanning Overlay */}
                <AnimatePresence>
                    {phase === "scanning" && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 pointer-events-none"
                        >
                            <motion.div
                                className="w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"
                                animate={{ top: ["0%", "100%"] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                style={{ position: "absolute", filter: "blur(2px)" }}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

// =============================================================================
// DEMO 3: AI INTERVIEW COPILOT (Chat stream)
// =============================================================================

export function InterviewDemo() {
    const [messages, setMessages] = useState<{ id: number; role: "ai" | "user"; text: string }[]>([]);
    const [step, setStep] = useState(0);

    const script = [
        { role: "user", text: "Can you explain the trade-offs of using microservices here?" },
        { role: "ai", text: "Probing for: System Design breadth..." }, // Internal thought
        { role: "ai", text: "💡 Suggestion: Ask about data consistency challenges." }, // Suggestion
    ] as const;

    useEffect(() => {
        let isMounted = true;

        const loop = async () => {
            if (!isMounted) return;

            // Step 1: User asks question
            await new Promise((r) => setTimeout(r, 1000));
            if (!isMounted) return;
            setMessages([{ id: 1, role: "user", text: "Can you explain the trade-offs here?" }]);

            // Step 2: Analysis (Thought)
            await new Promise((r) => setTimeout(r, 1500));
            if (!isMounted) return;
            setMessages((prev) => {
                // Prevent duplicate adding if react strict mode runs twice fast
                if (prev.some(m => m.id === 2)) return prev;
                return [...prev, { id: 2, role: "ai", text: "Analyzing response quality..." }]
            });

            // Step 3: Suggestion
            await new Promise((r) => setTimeout(r, 1500));
            if (!isMounted) return;
            setMessages((prev) => {
                if (prev.some(m => m.id === 3)) return prev;
                return [...prev, { id: 3, role: "ai", text: "Ask about eventual consistency." }]
            });

            // Reset
            await new Promise((r) => setTimeout(r, 4000));
            if (!isMounted) return;
            setMessages([]);

            // Continue loop
            if (isMounted) loop();
        };

        loop();

        return () => { isMounted = false; };
    }, []);

    return (
        <div className="w-full h-full min-h-[280px] flex flex-col relative overflow-hidden">
            {/* Video Call Background Placeholder */}
            <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center">
                <div className="text-slate-700 font-bold text-4xl opacity-10 uppercase tracking-widest">
                    Video Feed
                </div>
            </div>

            {/* Copilot Sidebar (Overlay) */}
            <div className="absolute right-4 top-4 bottom-4 w-48 bg-slate-950/90 backdrop-blur-md rounded-xl border border-white/10 p-3 flex flex-col">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
                    <Zap className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-xs font-semibold text-indigo-100">AI Copilot</span>
                </div>

                <div className="flex-1 space-y-3 overflow-hidden flex flex-col justify-end">
                    <AnimatePresence>
                        {messages.map((msg) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, x: 20, scale: 0.9 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className={`p-2 rounded-lg text-xs ${msg.role === "ai"
                                        ? "bg-indigo-500/20 border border-indigo-500/30 text-indigo-200"
                                        : "bg-slate-800 text-slate-300"
                                    }`}
                            >
                                {msg.text}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* Fake Input */}
                <div className="mt-3 relative">
                    <div className="h-6 bg-slate-800 rounded-full w-full opacity-50" />
                    <Mic className="absolute right-1 top-1 w-4 h-4 text-slate-500" />
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// DEMO 4: ANALYTICS (Morphing Radar)
// =============================================================================

export function AnalyticsDemo() {
    const [candidateA, setCandidateA] = useState(true);

    useEffect(() => {
        const interval = setInterval(() => {
            setCandidateA((prev) => !prev);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const stats = [
        { label: "Tech", a: 90, b: 60 },
        { label: "Comm", a: 70, b: 95 },
        { label: "Lead", a: 85, b: 40 },
        { label: "Design", a: 60, b: 80 },
        { label: "Speed", a: 95, b: 70 },
    ];

    return (
        <div className="w-full h-full flex flex-col items-center justify-center relative bg-slate-900/30">
            {/* Toggle Header */}
            <div className="absolute top-4 flex gap-4 text-xs font-medium">
                <div className={`transition-colors duration-500 ${candidateA ? "text-indigo-400" : "text-slate-600"}`}>
                    Candidate A
                </div>
                <div className={`transition-colors duration-500 ${!candidateA ? "text-rose-400" : "text-slate-600"}`}>
                    Candidate B
                </div>
            </div>

            <div className="relative w-40 h-40">
                {/* Background Grid (Pentagon) */}
                <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full opacity-20" style={{ transform: "rotate(-90deg)" }}>
                    {[20, 40, 60, 80, 100].map(r => (
                        <circle key={r} cx="50" cy="50" r={r / 2} fill="none" stroke="currentColor" strokeWidth="0.5" className="text-slate-400" />
                    ))}
                    {/* Axis lines would go here */}
                </svg>

                {/* Data Shape */}
                <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full overflow-visible" style={{ transform: "rotate(-90deg)" }}>
                    <motion.path
                        d="" // We need to calculate points, simplified for this demo to dynamic polygon
                        animate={{
                            d: stats.map((stat, i) => {
                                const val = candidateA ? stat.a : stat.b;
                                const angle = (Math.PI * 2 * i) / 5;
                                const r = val / 2; // scale to radius 50
                                const x = 50 + r * Math.cos(angle);
                                const y = 50 + r * Math.sin(angle);
                                return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                            }).join(" ") + " Z"
                        }}
                        transition={{ type: "spring", stiffness: 100, damping: 20 }}
                        fill={candidateA ? "rgba(99, 102, 241, 0.2)" : "rgba(244, 63, 94, 0.2)"}
                        stroke={candidateA ? "#6366F1" : "#F43F5E"}
                        strokeWidth="2"
                    />
                    {/* Dots */}
                    {stats.map((stat, i) => (
                        <motion.circle
                            key={i}
                            r="2"
                            animate={{
                                cx: 50 + ((candidateA ? stat.a : stat.b) / 2) * Math.cos((Math.PI * 2 * i) / 5),
                                cy: 50 + ((candidateA ? stat.a : stat.b) / 2) * Math.sin((Math.PI * 2 * i) / 5)
                            }}
                            fill={candidateA ? "#6366F1" : "#F43F5E"}
                        />
                    ))}
                </svg>
            </div>

            {/* Labels */}
            <div className="absolute inset-0 pointer-events-none">
                {stats.map((stat, i) => {
                    // Calculate label positions roughly
                    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                    const r = 45; // percentage
                    const x = 50 + r * Math.cos(angle);
                    const y = 50 + r * Math.sin(angle);

                    return (
                        <div
                            key={i}
                            className="absolute text-[9px] text-slate-400 font-medium"
                            style={{
                                left: `${x}%`,
                                top: `${y}%`,
                                transform: "translate(-50%, -50%)"
                            }}
                        >
                            {stat.label}
                        </div>
                    )
                })}
            </div>
        </div>
    );
}
