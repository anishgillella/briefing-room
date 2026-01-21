"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft,
    Loader2,
    AlertTriangle,
    Target,
    TrendingUp,
    DollarSign,
    Users,
    MessageSquare,
    Quote,
    AlertCircle,
    Sparkles,
    Mic,
    ChevronRight,
    Building2,
    MapPin,
    Briefcase,
    BarChart3,
    X,
    PhoneOff,
    Copy,
    CheckCircle,
    FileText,
    RefreshCw,
} from "lucide-react";
import VoiceSession, { VoiceSessionRef } from "@/components/voice-ingest/VoiceSession";
import { tokens, springConfig } from "@/lib/design-tokens";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const VAPI_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || "";
const VAPI_COACHING_ASSISTANT_ID = process.env.NEXT_PUBLIC_VAPI_COACHING_ASSISTANT_ID || "";

interface CandidatePriority {
    name: string;
    importance: string;
    evidence?: string;
    source_round?: string;
}

interface KeyQuote {
    text: string;
    round: string;
    context?: string;
}

interface RiskFactor {
    description: string;
    severity: string;
    source?: string;
}

interface CandidateIntelligence {
    candidate_id: string;
    candidate_name: string;
    role_title?: string;
    current_company?: string;
    priorities: CandidatePriority[];
    key_quotes: KeyQuote[];
    risk_factors: RiskFactor[];
    competing_offers: string[];
    close_probability?: number;
    average_interview_score?: number;
    recommendation?: string;
    interviews_completed: number;
    total_transcript_turns: number;
    all_transcripts: Array<{
        stage: string;
        turns: Array<{ speaker: string; text: string }>;
        full_text: string;
    }>;
    all_analytics: Array<Record<string, unknown>>;
}

interface CompensationData {
    role_title: string;
    location: string;
    company_stage?: string;
    salary_min?: number;
    salary_median?: number;
    salary_max?: number;
    salary_percentile_25?: number;
    salary_percentile_75?: number;
    equity_min_percent?: number;
    equity_max_percent?: number;
    equity_typical_percent?: number;
    vesting_standard?: string;
    market_trend?: string;
    confidence_level?: string;
}

interface OfferPrepContext {
    candidate: CandidateIntelligence;
    market_data?: CompensationData;
    ready_for_coaching: boolean;
}

interface OfferDetails {
    base_salary: number;
    equity_percent?: number;
    bonus_percent?: number;
    signing_bonus?: number;
    start_date?: string;
}

export default function OfferPrepPage() {
    const params = useParams();
    const router = useRouter();
    const candidateId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [context, setContext] = useState<OfferPrepContext | null>(null);

    // Offer details form state
    const [offerDetails, setOfferDetails] = useState<OfferDetails>({
        base_salary: 180000,
        equity_percent: 0.15,
        bonus_percent: 15,
    });

    // Coaching session state
    const [showCoachingModal, setShowCoachingModal] = useState(false);
    const [coachingVariables, setCoachingVariables] = useState<Record<string, string> | null>(null);
    const [preparingCoaching, setPreparingCoaching] = useState(false);
    const [coachingTranscript, setCoachingTranscript] = useState<Array<{ role: string; text: string }>>([]);
    const [coachingStartTime, setCoachingStartTime] = useState<number | null>(null);

    // Summary state
    const [coachingSummary, setCoachingSummary] = useState<any>(null);
    const [generatingSummary, setGeneratingSummary] = useState(false);
    const [showSummary, setShowSummary] = useState(false);

    // Market data refresh state
    const [companyName, setCompanyName] = useState<string>("");
    const [companyWebsite, setCompanyWebsite] = useState<string>("");
    const [refreshingMarketData, setRefreshingMarketData] = useState(false);

    useEffect(() => {
        fetchContext();
        fetchExistingSummary();
    }, [candidateId]);

    const startCoachingSession = async () => {
        if (!context || !context.ready_for_coaching) return;

        setPreparingCoaching(true);
        try {
            // Prepare coaching context
            const res = await fetch(`${API_URL}/api/offer-prep/coaching/prepare`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    candidate_id: candidateId,
                    offer_base: offerDetails.base_salary,
                    offer_equity: offerDetails.equity_percent,
                    offer_bonus: offerDetails.bonus_percent,
                    role_title: context.candidate.role_title,
                }),
            });

            if (!res.ok) {
                throw new Error("Failed to prepare coaching session");
            }

            const data = await res.json();
            setCoachingVariables(data.variables);
            setCoachingStartTime(Date.now());
            setCoachingTranscript([]);
            setShowCoachingModal(true);
        } catch (e) {
            console.error("Error starting coaching:", e);
            alert("Failed to start coaching session. Please try again.");
        } finally {
            setPreparingCoaching(false);
        }
    };

    // Reference to VoiceSession for programmatic control
    const voiceSessionRef = useRef<VoiceSessionRef | null>(null);

    const handleCoachingEnd = async () => {
        // First, forcefully stop the Vapi call to stop the voice
        if (voiceSessionRef.current) {
            voiceSessionRef.current.stopCall();
        }

        setShowCoachingModal(false);

        // Generate summary if we have transcript
        if (coachingTranscript.length > 0) {
            setGeneratingSummary(true);
            try {
                const duration = coachingStartTime
                    ? Math.floor((Date.now() - coachingStartTime) / 1000)
                    : undefined;

                const res = await fetch(`${API_URL}/api/offer-prep/coaching/save-summary`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        candidate_id: candidateId,
                        transcript_turns: coachingTranscript,
                        session_duration_seconds: duration,
                        offer_base: offerDetails.base_salary,
                        offer_equity: offerDetails.equity_percent,
                    }),
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.status === "success" && data.summary) {
                        setCoachingSummary(data.summary);
                        setShowSummary(true);
                    }
                }
            } catch (e) {
                console.error("Error generating summary:", e);
            } finally {
                setGeneratingSummary(false);
            }
        }
    };

    const handleCoachingTranscript = (speaker: 'user' | 'agent', text: string) => {
        setCoachingTranscript(prev => [...prev, { role: speaker, text }]);
    };

    const fetchExistingSummary = async () => {
        try {
            const res = await fetch(`${API_URL}/api/offer-prep/coaching/summary/${candidateId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.status === "success" && data.summary) {
                    setCoachingSummary(data.summary);
                }
            }
        } catch (e) {
            // Ignore - no existing summary
        }
    };

    const fetchContext = async () => {
        try {
            setLoading(true);
            const res = await fetch(
                `${API_URL}/api/offer-prep/candidate/${candidateId}/context?include_market_data=true`
            );
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "Failed to load offer prep context");
            }
            const data = await res.json();
            setContext(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    const refreshMarketData = async () => {
        if (!context) return;

        setRefreshingMarketData(true);
        try {
            const res = await fetch(`${API_URL}/api/offer-prep/market-data/enhanced`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    role_title: context.candidate.role_title || "Account Executive",
                    location: "San Francisco",
                    company_name: companyName || undefined,
                    company_website: companyWebsite || undefined,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                if (data.status === "success" || data.status === "partial") {
                    setContext({
                        ...context,
                        market_data: data.data,
                    });
                }
            }
        } catch (e) {
            console.error("Error refreshing market data:", e);
        } finally {
            setRefreshingMarketData(false);
        }
    };

    const getCloseProbabilityColor = (prob?: number) => {
        if (!prob) return "text-white/40";
        if (prob >= 0.7) return "text-green-400";
        if (prob >= 0.5) return "text-yellow-400";
        return "text-red-400";
    };

    const getCloseProbabilityBg = (prob?: number) => {
        if (!prob) return "bg-white/10";
        if (prob >= 0.7) return "bg-green-500/20 border-green-500/30";
        if (prob >= 0.5) return "bg-yellow-500/20 border-yellow-500/30";
        return "bg-red-500/20 border-red-500/30";
    };

    const formatCurrency = (value?: number) => {
        if (!value) return "N/A";
        return `$${value.toLocaleString()}`;
    };

    const formatPercent = (value?: number) => {
        if (!value) return "N/A";
        return `${value}%`;
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: tokens.bgApp }}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center"
                >
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                        <Loader2 className="w-10 h-10 mx-auto mb-4" style={{ color: tokens.brandPrimary }} />
                    </motion.div>
                    <p style={{ color: tokens.textMuted }}>Loading offer preparation context...</p>
                </motion.div>
            </div>
        );
    }

    if (error || !context) {
        return (
            <div className="min-h-screen flex items-center justify-center text-white" style={{ backgroundColor: tokens.bgApp }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={springConfig}
                    className="text-center p-8 rounded-2xl border"
                    style={{
                        backgroundColor: tokens.bgCard,
                        borderColor: tokens.borderSubtle,
                    }}
                >
                    <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                        style={{
                            backgroundColor: `${tokens.statusDanger}15`,
                            border: `1px solid ${tokens.statusDanger}30`,
                        }}
                    >
                        <AlertTriangle className="w-8 h-8" style={{ color: tokens.statusDanger }} />
                    </div>
                    <h1 className="text-xl font-semibold mb-2">Failed to Load</h1>
                    <p className="mb-4" style={{ color: tokens.textMuted }}>{error}</p>
                    <button
                        onClick={() => router.back()}
                        className="px-4 py-2 rounded-xl font-medium transition-all hover:scale-105"
                        style={{
                            backgroundColor: tokens.brandPrimary,
                            color: "white",
                        }}
                    >
                        Go Back
                    </button>
                </motion.div>
            </div>
        );
    }

    const { candidate, market_data, ready_for_coaching } = context;

    return (
        <div className="min-h-screen text-white" style={{ backgroundColor: tokens.bgApp }}>
            {/* Ambient Background */}
            <div
                className="fixed inset-0 pointer-events-none"
                style={{
                    background: `
                        radial-gradient(ellipse 80% 50% at 50% -20%, ${tokens.brandPrimary}15, transparent),
                        radial-gradient(ellipse 60% 40% at 100% 0%, ${tokens.brandSecondary}10, transparent),
                        ${tokens.bgApp}
                    `,
                }}
            />

            {/* Grain Texture */}
            <div
                className="fixed inset-0 pointer-events-none opacity-[0.015]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                }}
            />

            {/* Header */}
            <header
                className="border-b backdrop-blur-xl sticky top-0 z-50 relative"
                style={{
                    borderColor: tokens.borderSubtle,
                    backgroundColor: `${tokens.bgApp}cc`,
                }}
            >
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <motion.button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 transition group"
                        style={{ color: tokens.textMuted }}
                        whileHover={{ x: -2 }}
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        Back to Candidate
                    </motion.button>

                    <div className="flex items-center gap-4">
                        {/* Close Probability Badge */}
                        <div
                            className={`px-4 py-2 rounded-full border ${getCloseProbabilityBg(
                                candidate.close_probability
                            )}`}
                        >
                            <span className="text-sm text-white/60 mr-2">Close Probability</span>
                            <span
                                className={`text-lg font-bold ${getCloseProbabilityColor(
                                    candidate.close_probability
                                )}`}
                            >
                                {candidate.close_probability
                                    ? `${Math.round(candidate.close_probability * 100)}%`
                                    : "N/A"}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-8 relative">
                {/* Page Title */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={springConfig}
                    className="mb-8"
                >
                    <h1 className="text-3xl font-light tracking-tight text-white mb-2">
                        Offer Preparation
                    </h1>
                    <div className="flex items-center gap-4" style={{ color: tokens.textMuted }}>
                        <span className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            {candidate.candidate_name}
                        </span>
                        {candidate.role_title && (
                            <span className="flex items-center gap-2">
                                <Briefcase className="w-4 h-4" />
                                {candidate.role_title}
                            </span>
                        )}
                        {candidate.current_company && (
                            <span className="flex items-center gap-2">
                                <Building2 className="w-4 h-4" />
                                {candidate.current_company}
                            </span>
                        )}
                    </div>
                </motion.div>

                {/* Not Ready Warning */}
                <AnimatePresence>
                    {!ready_for_coaching && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={springConfig}
                            className="mb-8 p-6 rounded-2xl"
                            style={{
                                backgroundColor: `${tokens.statusWarning}10`,
                                border: `1px solid ${tokens.statusWarning}30`,
                            }}
                        >
                            <div className="flex items-start gap-4">
                                <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: tokens.statusWarning }} />
                                <div>
                                    <h3 className="font-semibold mb-1" style={{ color: tokens.statusWarning }}>
                                        Interviews Not Complete
                                    </h3>
                                    <p className="text-sm" style={{ color: `${tokens.statusWarning}99` }}>
                                        {candidate.interviews_completed}/3 interviews completed. Complete all
                                        interview rounds to get full coaching preparation.
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Candidate Intelligence */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Interview Summary Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ ...springConfig, delay: 0.1 }}
                            className="rounded-2xl p-6 border"
                            style={{
                                backgroundColor: tokens.bgCard,
                                borderColor: tokens.borderSubtle,
                            }}
                        >
                            <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                                <MessageSquare className="w-5 h-5" style={{ color: tokens.brandPrimary }} />
                                Interview Summary
                            </h2>

                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div
                                    className="rounded-xl p-4 text-center"
                                    style={{ backgroundColor: tokens.bgSurface }}
                                >
                                    <div className="text-3xl font-light" style={{ color: tokens.brandPrimary }}>
                                        {candidate.interviews_completed}
                                    </div>
                                    <div className="text-xs uppercase tracking-wider mt-1" style={{ color: tokens.textMuted }}>
                                        Rounds Complete
                                    </div>
                                </div>
                                <div
                                    className="rounded-xl p-4 text-center"
                                    style={{ backgroundColor: tokens.bgSurface }}
                                >
                                    <div className="text-3xl font-light" style={{ color: tokens.brandSecondary }}>
                                        {candidate.average_interview_score || "—"}
                                    </div>
                                    <div className="text-xs uppercase tracking-wider mt-1" style={{ color: tokens.textMuted }}>
                                        Avg Score
                                    </div>
                                </div>
                                <div
                                    className="rounded-xl p-4 text-center"
                                    style={{ backgroundColor: tokens.bgSurface }}
                                >
                                    <div className="text-3xl font-light" style={{ color: tokens.statusSuccess }}>
                                        {candidate.total_transcript_turns}
                                    </div>
                                    <div className="text-xs uppercase tracking-wider mt-1" style={{ color: tokens.textMuted }}>
                                        Transcript Turns
                                    </div>
                                </div>
                            </div>

                            {candidate.recommendation && (
                                <div
                                    className="p-4 rounded-xl border"
                                    style={{
                                        backgroundColor:
                                            candidate.recommendation === "Strong Hire"
                                                ? `${tokens.statusSuccess}10`
                                                : candidate.recommendation === "Hire"
                                                ? `${tokens.brandSecondary}10`
                                                : `${tokens.statusDanger}10`,
                                        borderColor:
                                            candidate.recommendation === "Strong Hire"
                                                ? `${tokens.statusSuccess}30`
                                                : candidate.recommendation === "Hire"
                                                ? `${tokens.brandSecondary}30`
                                                : `${tokens.statusDanger}30`,
                                    }}
                                >
                                    <span className="text-sm" style={{ color: tokens.textMuted }}>Recommendation: </span>
                                    <span
                                        className="font-semibold"
                                        style={{
                                            color:
                                                candidate.recommendation === "Strong Hire"
                                                    ? tokens.statusSuccess
                                                    : candidate.recommendation === "Hire"
                                                    ? tokens.brandSecondary
                                                    : tokens.statusDanger,
                                        }}
                                    >
                                        {candidate.recommendation}
                                    </span>
                                </div>
                            )}
                        </motion.div>

                        {/* Candidate Priorities */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ ...springConfig, delay: 0.15 }}
                            className="rounded-2xl p-6 border"
                            style={{
                                backgroundColor: tokens.bgCard,
                                borderColor: tokens.borderSubtle,
                            }}
                        >
                            <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                                <Target className="w-5 h-5" style={{ color: tokens.brandSecondary }} />
                                What They Value
                            </h2>

                            {candidate.priorities.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {candidate.priorities.map((priority, i) => (
                                        <div
                                            key={i}
                                            className="p-4 rounded-xl border"
                                            style={{
                                                backgroundColor:
                                                    priority.importance === "high"
                                                        ? `${tokens.brandPrimary}10`
                                                        : priority.importance === "medium"
                                                        ? `${tokens.brandSecondary}10`
                                                        : tokens.bgSurface,
                                                borderColor:
                                                    priority.importance === "high"
                                                        ? `${tokens.brandPrimary}30`
                                                        : priority.importance === "medium"
                                                        ? `${tokens.brandSecondary}30`
                                                        : tokens.borderSubtle,
                                            }}
                                        >
                                            <div className="font-medium text-white mb-1">
                                                {priority.name}
                                            </div>
                                            <div className="text-xs uppercase" style={{ color: tokens.textMuted }}>
                                                {priority.importance} Priority
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8" style={{ color: tokens.textMuted }}>
                                    <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p>Priorities will be extracted during coaching session</p>
                                </div>
                            )}
                        </motion.div>

                        {/* Key Quotes */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ ...springConfig, delay: 0.2 }}
                            className="rounded-2xl p-6 border"
                            style={{
                                backgroundColor: tokens.bgCard,
                                borderColor: tokens.borderSubtle,
                            }}
                        >
                            <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                                <Quote className="w-5 h-5" style={{ color: tokens.statusWarning }} />
                                Key Quotes from Interviews
                            </h2>

                            {candidate.key_quotes.length > 0 ? (
                                <div className="space-y-4">
                                    {candidate.key_quotes.map((quote, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ ...springConfig, delay: 0.25 + i * 0.05 }}
                                            className="p-4 rounded-xl border-l-4"
                                            style={{
                                                backgroundColor: tokens.bgSurface,
                                                borderColor: `${tokens.statusWarning}60`,
                                            }}
                                        >
                                            <p className="text-white/90 italic">"{quote.text}"</p>
                                            <p className="text-xs mt-2" style={{ color: tokens.textMuted }}>
                                                — {quote.round}
                                                {quote.context && ` • ${quote.context}`}
                                            </p>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8" style={{ color: tokens.textMuted }}>
                                    <Quote className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p>Key quotes will be extracted during coaching session</p>
                                </div>
                            )}
                        </motion.div>

                        {/* Risk Factors */}
                        <AnimatePresence>
                            {candidate.risk_factors.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ ...springConfig, delay: 0.25 }}
                                    className="rounded-2xl p-6 border"
                                    style={{
                                        backgroundColor: `${tokens.statusDanger}08`,
                                        borderColor: `${tokens.statusDanger}30`,
                                    }}
                                >
                                    <h2 className="text-lg font-medium mb-4 flex items-center gap-2" style={{ color: tokens.statusDanger }}>
                                        <AlertTriangle className="w-5 h-5" />
                                        Risk Factors
                                    </h2>
                                    <div className="space-y-3">
                                        {candidate.risk_factors.map((risk, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ ...springConfig, delay: 0.3 + i * 0.05 }}
                                                className="flex items-start gap-3 p-3 rounded-xl"
                                                style={{ backgroundColor: `${tokens.statusDanger}10` }}
                                            >
                                                <AlertCircle
                                                    className="w-4 h-4 mt-0.5 flex-shrink-0"
                                                    style={{
                                                        color: risk.severity === "high"
                                                            ? tokens.statusDanger
                                                            : tokens.statusWarning
                                                    }}
                                                />
                                                <span className="text-white/80">{risk.description}</span>
                                            </motion.div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Right Column - Market Data & Offer */}
                    <div className="space-y-6">
                        {/* Market Positioning */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ ...springConfig, delay: 0.2 }}
                            className="rounded-2xl p-6 border"
                            style={{
                                backgroundColor: tokens.bgCard,
                                borderColor: tokens.borderSubtle,
                            }}
                        >
                            <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5" style={{ color: tokens.statusSuccess }} />
                                Market Positioning
                            </h2>

                            {market_data ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-sm mb-4" style={{ color: tokens.textMuted }}>
                                        <Briefcase className="w-4 h-4" />
                                        {market_data.role_title}
                                        <span style={{ color: tokens.textMuted }}>•</span>
                                        <MapPin className="w-4 h-4" />
                                        {market_data.location}
                                    </div>

                                    {/* Salary Range Bar */}
                                    <div>
                                        <div className="flex justify-between text-xs mb-1" style={{ color: tokens.textMuted }}>
                                            <span>{formatCurrency(market_data.salary_min)}</span>
                                            <span>{formatCurrency(market_data.salary_max)}</span>
                                        </div>
                                        <div
                                            className="h-3 rounded-full overflow-hidden"
                                            style={{ backgroundColor: tokens.bgSurface }}
                                        >
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{
                                                    width: market_data.salary_median
                                                        ? `${
                                                              ((market_data.salary_median -
                                                                  (market_data.salary_min || 0)) /
                                                                  ((market_data.salary_max || 1) -
                                                                      (market_data.salary_min || 0))) *
                                                              100
                                                          }%`
                                                        : "50%",
                                                }}
                                                transition={{ ...springConfig, delay: 0.4 }}
                                                className="h-full"
                                                style={{
                                                    background: `linear-gradient(to right, ${tokens.brandPrimary}, ${tokens.brandSecondary})`,
                                                }}
                                            />
                                        </div>
                                        <div className="text-center mt-2">
                                            <span className="text-xs" style={{ color: tokens.textMuted }}>Median: </span>
                                            <span className="text-sm font-semibold text-white">
                                                {formatCurrency(market_data.salary_median)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Equity Benchmark */}
                                    <div
                                        className="p-4 rounded-xl"
                                        style={{ backgroundColor: tokens.bgSurface }}
                                    >
                                        <div className="text-xs uppercase tracking-wider mb-1" style={{ color: tokens.textMuted }}>
                                            Typical Equity
                                        </div>
                                        <div className="text-xl font-semibold text-white">
                                            {market_data.equity_typical_percent
                                                ? `${market_data.equity_typical_percent}%`
                                                : "N/A"}
                                        </div>
                                        {market_data.vesting_standard && (
                                            <div className="text-xs mt-1" style={{ color: tokens.textMuted }}>
                                                {market_data.vesting_standard}
                                            </div>
                                        )}
                                    </div>

                                    {/* Market Trend */}
                                    {market_data.market_trend && (
                                        <div
                                            className="p-3 rounded-xl text-sm"
                                            style={{
                                                backgroundColor:
                                                    market_data.market_trend === "rising"
                                                        ? `${tokens.statusSuccess}10`
                                                        : market_data.market_trend === "declining"
                                                        ? `${tokens.statusDanger}10`
                                                        : tokens.bgSurface,
                                                color:
                                                    market_data.market_trend === "rising"
                                                        ? tokens.statusSuccess
                                                        : market_data.market_trend === "declining"
                                                        ? tokens.statusDanger
                                                        : tokens.textMuted,
                                            }}
                                        >
                                            Market trend: {market_data.market_trend}
                                        </div>
                                    )}

                                    {market_data.confidence_level && (
                                        <div className="text-xs text-center" style={{ color: tokens.textMuted }}>
                                            Data confidence: {market_data.confidence_level}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8" style={{ color: tokens.textMuted }}>
                                    <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p>Market data unavailable</p>
                                </div>
                            )}

                            {/* Company Info for Market Research */}
                            <div
                                className="mt-4 pt-4"
                                style={{ borderTop: `1px solid ${tokens.borderSubtle}` }}
                            >
                                <div className="text-xs uppercase tracking-wider mb-3" style={{ color: tokens.textMuted }}>
                                    Enhance Market Data
                                </div>
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        placeholder="Company Name (e.g., Acme Inc)"
                                        value={companyName}
                                        onChange={(e) => setCompanyName(e.target.value)}
                                        className="w-full rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none transition-colors"
                                        style={{
                                            backgroundColor: tokens.bgSurface,
                                            border: `1px solid ${tokens.borderSubtle}`,
                                        }}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Company Website (e.g., https://acme.com)"
                                        value={companyWebsite}
                                        onChange={(e) => setCompanyWebsite(e.target.value)}
                                        className="w-full rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none transition-colors"
                                        style={{
                                            backgroundColor: tokens.bgSurface,
                                            border: `1px solid ${tokens.borderSubtle}`,
                                        }}
                                    />
                                    <button
                                        onClick={refreshMarketData}
                                        disabled={refreshingMarketData}
                                        className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                                        style={{
                                            backgroundColor: `${tokens.brandPrimary}20`,
                                            border: `1px solid ${tokens.brandPrimary}30`,
                                            color: tokens.brandPrimary,
                                        }}
                                    >
                                        {refreshingMarketData ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Researching...
                                            </>
                                        ) : (
                                            <>
                                                <RefreshCw className="w-4 h-4" />
                                                Refresh Market Data
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </motion.div>

                        {/* Your Offer */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ ...springConfig, delay: 0.25 }}
                            className="rounded-2xl p-6 border"
                            style={{
                                backgroundColor: `${tokens.brandPrimary}08`,
                                borderColor: `${tokens.brandPrimary}30`,
                            }}
                        >
                            <h2 className="text-lg font-medium mb-4 flex items-center gap-2" style={{ color: tokens.brandPrimary }}>
                                <DollarSign className="w-5 h-5" />
                                Your Offer
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: tokens.textMuted }}>
                                        Base Salary
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: tokens.textMuted }}>
                                            $
                                        </span>
                                        <input
                                            type="number"
                                            value={offerDetails.base_salary}
                                            onChange={(e) =>
                                                setOfferDetails({
                                                    ...offerDetails,
                                                    base_salary: parseInt(e.target.value) || 0,
                                                })
                                            }
                                            className="w-full rounded-xl px-4 py-3 pl-8 text-white focus:outline-none transition-colors"
                                            style={{
                                                backgroundColor: tokens.bgSurface,
                                                border: `1px solid ${tokens.borderSubtle}`,
                                            }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: tokens.textMuted }}>
                                        Equity (%)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={offerDetails.equity_percent || ""}
                                        onChange={(e) =>
                                            setOfferDetails({
                                                ...offerDetails,
                                                equity_percent: parseFloat(e.target.value) || undefined,
                                            })
                                        }
                                        placeholder="0.15"
                                        className="w-full rounded-xl px-4 py-3 text-white focus:outline-none transition-colors"
                                        style={{
                                            backgroundColor: tokens.bgSurface,
                                            border: `1px solid ${tokens.borderSubtle}`,
                                        }}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: tokens.textMuted }}>
                                        Target Bonus (%)
                                    </label>
                                    <input
                                        type="number"
                                        value={offerDetails.bonus_percent || ""}
                                        onChange={(e) =>
                                            setOfferDetails({
                                                ...offerDetails,
                                                bonus_percent: parseInt(e.target.value) || undefined,
                                            })
                                        }
                                        placeholder="15"
                                        className="w-full rounded-xl px-4 py-3 text-white focus:outline-none transition-colors"
                                        style={{
                                            backgroundColor: tokens.bgSurface,
                                            border: `1px solid ${tokens.borderSubtle}`,
                                        }}
                                    />
                                </div>
                            </div>
                        </motion.div>

                        {/* Start Coaching CTA */}
                        <motion.button
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ ...springConfig, delay: 0.3 }}
                            onClick={startCoachingSession}
                            disabled={!ready_for_coaching || preparingCoaching}
                            className="w-full py-5 rounded-2xl font-semibold text-lg flex items-center justify-center gap-3 transition-all"
                            style={{
                                background: ready_for_coaching && !preparingCoaching
                                    ? `linear-gradient(to right, ${tokens.brandPrimary}, ${tokens.brandSecondary})`
                                    : tokens.bgSurface,
                                color: ready_for_coaching && !preparingCoaching ? "white" : tokens.textMuted,
                                cursor: ready_for_coaching && !preparingCoaching ? "pointer" : "not-allowed",
                                boxShadow: ready_for_coaching && !preparingCoaching
                                    ? `0 0 40px ${tokens.brandPrimary}30`
                                    : "none",
                            }}
                            whileHover={ready_for_coaching && !preparingCoaching ? { scale: 1.02 } : {}}
                            whileTap={ready_for_coaching && !preparingCoaching ? { scale: 0.98 } : {}}
                        >
                            {preparingCoaching ? (
                                <>
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    Preparing Session...
                                </>
                            ) : (
                                <>
                                    <Mic className="w-6 h-6" />
                                    Start Coaching Session
                                    <ChevronRight className="w-5 h-5" />
                                </>
                            )}
                        </motion.button>

                        <p className="text-center text-xs" style={{ color: tokens.textMuted }}>
                            ~12 min personalized coaching call
                        </p>
                    </div>
                </div>
            </main>

            {/* Coaching Session Modal */}
            <AnimatePresence>
                {showCoachingModal && coachingVariables && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        style={{ backgroundColor: `${tokens.bgApp}f5` }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={springConfig}
                            className="rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
                            style={{
                                backgroundColor: tokens.bgCard,
                                border: `1px solid ${tokens.borderSubtle}`,
                            }}
                        >
                            {/* Modal Header */}
                            <div
                                className="px-8 py-5 flex items-center justify-between flex-shrink-0"
                                style={{ borderBottom: `1px solid ${tokens.borderSubtle}` }}
                            >
                                <div className="flex items-center gap-4">
                                    <div
                                        className="w-12 h-12 rounded-full flex items-center justify-center"
                                        style={{
                                            background: `linear-gradient(to right, ${tokens.brandPrimary}, ${tokens.brandSecondary})`,
                                        }}
                                    >
                                        <Mic className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-semibold text-white">
                                            Coaching Session
                                        </h3>
                                        <p className="text-sm" style={{ color: tokens.textMuted }}>
                                            Preparing offer for {candidate.candidate_name}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleCoachingEnd}
                                    className="p-3 rounded-xl transition-colors flex items-center gap-2"
                                    style={{
                                        backgroundColor: `${tokens.statusDanger}10`,
                                        border: `1px solid ${tokens.statusDanger}20`,
                                        color: tokens.statusDanger,
                                    }}
                                >
                                    <PhoneOff className="w-5 h-5" />
                                    End Session
                                </button>
                            </div>

                            {/* Voice Session */}
                            <div className="flex-1 p-8 overflow-hidden">
                                <div className="h-full flex flex-col">
                                    <VoiceSession
                                        vapiPublicKey={VAPI_PUBLIC_KEY}
                                        assistantConfig={{
                                            assistantId: VAPI_COACHING_ASSISTANT_ID,
                                            assistantOverrides: {
                                                variableValues: coachingVariables,
                                            },
                                        }}
                                        sessionId={`coaching-${candidateId}-${Date.now()}`}
                                        onEnd={handleCoachingEnd}
                                        onTranscript={handleCoachingTranscript}
                                        ref={voiceSessionRef}
                                    />

                                    {/* Live Transcript (optional) */}
                                    {coachingTranscript.length > 0 && (
                                        <div
                                            className="mt-6 max-h-48 overflow-y-auto pt-4"
                                            style={{ borderTop: `1px solid ${tokens.borderSubtle}` }}
                                        >
                                            <h4 className="text-xs uppercase tracking-wider mb-3" style={{ color: tokens.textMuted }}>
                                                Live Transcript
                                            </h4>
                                            <div className="space-y-2">
                                                {coachingTranscript.slice(-5).map((item, i) => (
                                                    <div
                                                        key={i}
                                                        className="text-sm"
                                                        style={{
                                                            color: item.role === "agent"
                                                                ? tokens.brandPrimary
                                                                : tokens.textSecondary
                                                        }}
                                                    >
                                                        <span className="font-medium">
                                                            {item.role === "agent" ? "Coach: " : "You: "}
                                                        </span>
                                                        {item.text}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Context Panel */}
                            <div
                                className="px-8 py-4 flex-shrink-0"
                                style={{
                                    borderTop: `1px solid ${tokens.borderSubtle}`,
                                    backgroundColor: tokens.bgSurface,
                                }}
                            >
                                <div className="flex gap-6 text-xs" style={{ color: tokens.textMuted }}>
                                    <span>
                                        <strong style={{ color: tokens.textSecondary }}>Candidate:</strong>{" "}
                                        {coachingVariables.candidate_name}
                                    </span>
                                    <span>
                                        <strong style={{ color: tokens.textSecondary }}>Offer:</strong>{" "}
                                        {coachingVariables.offer_base}
                                    </span>
                                    <span>
                                        <strong style={{ color: tokens.textSecondary }}>Equity:</strong>{" "}
                                        {coachingVariables.offer_equity}
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Generating Summary Indicator */}
            <AnimatePresence>
                {generatingSummary && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center"
                        style={{ backgroundColor: `${tokens.bgApp}e6` }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={springConfig}
                            className="text-center"
                        >
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            >
                                <Loader2 className="w-12 h-12 mx-auto mb-4" style={{ color: tokens.brandPrimary }} />
                            </motion.div>
                            <h3 className="text-xl font-semibold text-white mb-2">
                                Generating Your Offer Script
                            </h3>
                            <p style={{ color: tokens.textMuted }}>
                                Analyzing coaching session and creating personalized recommendations...
                            </p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Coaching Summary Modal */}
            <AnimatePresence>
                {showSummary && coachingSummary && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-16 overflow-y-auto"
                        style={{ backgroundColor: `${tokens.bgApp}f5` }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={springConfig}
                            className="rounded-3xl max-w-4xl w-full shadow-2xl mb-8"
                            style={{
                                backgroundColor: tokens.bgCard,
                                border: `1px solid ${tokens.borderSubtle}`,
                            }}
                        >
                            {/* Modal Header */}
                            <div
                                className="px-8 py-5 flex items-center justify-between rounded-t-3xl"
                                style={{
                                    borderBottom: `1px solid ${tokens.borderSubtle}`,
                                    backgroundColor: tokens.bgCard,
                                }}
                            >
                                <div className="flex items-center gap-4">
                                    <div
                                        className="w-12 h-12 rounded-full flex items-center justify-center"
                                        style={{ backgroundColor: `${tokens.statusSuccess}20` }}
                                    >
                                        <CheckCircle className="w-6 h-6" style={{ color: tokens.statusSuccess }} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-semibold text-white">
                                            Coaching Complete
                                        </h3>
                                        <p className="text-sm" style={{ color: tokens.textMuted }}>
                                            Your personalized offer script is ready
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowSummary(false)}
                                    className="p-2 rounded-lg transition-colors hover:bg-white/10"
                                >
                                    <X className="w-5 h-5" style={{ color: tokens.textMuted }} />
                                </button>
                            </div>

                            {/* Summary Content */}
                            <div className="p-8 space-y-8">
                                {/* Offer Script */}
                                {coachingSummary.offer_script && (
                                    <div
                                        className="rounded-2xl p-6"
                                        style={{
                                            backgroundColor: `${tokens.brandPrimary}08`,
                                            border: `1px solid ${tokens.brandPrimary}30`,
                                        }}
                                    >
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-lg font-semibold flex items-center gap-2" style={{ color: tokens.brandPrimary }}>
                                                <FileText className="w-5 h-5" />
                                                Your Offer Script
                                            </h4>
                                            <button
                                                onClick={() => {
                                                    const script = `Opening:\n${coachingSummary.offer_script.opening}\n\nEquity Explanation:\n${coachingSummary.offer_script.equity_explanation}\n\n${coachingSummary.offer_script.competitor_handling ? `Competitor Handling:\n${coachingSummary.offer_script.competitor_handling}\n\n` : ''}Closing:\n${coachingSummary.offer_script.closing}`;
                                                    navigator.clipboard.writeText(script);
                                                }}
                                                className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors hover:bg-white/10"
                                                style={{
                                                    backgroundColor: tokens.bgSurface,
                                                    border: `1px solid ${tokens.borderSubtle}`,
                                                    color: tokens.textSecondary,
                                                }}
                                            >
                                                <Copy className="w-4 h-4" />
                                                Copy Script
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <h5 className="text-xs uppercase tracking-wider mb-2" style={{ color: tokens.textMuted }}>Opening</h5>
                                                <p
                                                    className="rounded-xl p-4 border-l-4"
                                                    style={{
                                                        backgroundColor: tokens.bgSurface,
                                                        borderColor: `${tokens.brandPrimary}60`,
                                                        color: tokens.textSecondary,
                                                    }}
                                                >
                                                    {coachingSummary.offer_script.opening}
                                                </p>
                                            </div>

                                            <div>
                                                <h5 className="text-xs uppercase tracking-wider mb-2" style={{ color: tokens.textMuted }}>Equity Explanation</h5>
                                                <p
                                                    className="rounded-xl p-4 border-l-4"
                                                    style={{
                                                        backgroundColor: tokens.bgSurface,
                                                        borderColor: `${tokens.brandSecondary}60`,
                                                        color: tokens.textSecondary,
                                                    }}
                                                >
                                                    {coachingSummary.offer_script.equity_explanation}
                                                </p>
                                            </div>

                                            {coachingSummary.offer_script.competitor_handling && (
                                                <div>
                                                    <h5 className="text-xs uppercase tracking-wider mb-2" style={{ color: tokens.textMuted }}>Handling Competition</h5>
                                                    <p
                                                        className="rounded-xl p-4 border-l-4"
                                                        style={{
                                                            backgroundColor: tokens.bgSurface,
                                                            borderColor: `${tokens.statusWarning}60`,
                                                            color: tokens.textSecondary,
                                                        }}
                                                    >
                                                        {coachingSummary.offer_script.competitor_handling}
                                                    </p>
                                                </div>
                                            )}

                                            <div>
                                                <h5 className="text-xs uppercase tracking-wider mb-2" style={{ color: tokens.textMuted }}>Closing</h5>
                                                <p
                                                    className="rounded-xl p-4 border-l-4"
                                                    style={{
                                                        backgroundColor: tokens.bgSurface,
                                                        borderColor: `${tokens.statusSuccess}60`,
                                                        color: tokens.textSecondary,
                                                    }}
                                                >
                                                    {coachingSummary.offer_script.closing}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Key Reminders */}
                                {coachingSummary.key_reminders && coachingSummary.key_reminders.length > 0 && (
                                    <div
                                        className="rounded-2xl p-6"
                                        style={{
                                            backgroundColor: `${tokens.brandSecondary}08`,
                                            border: `1px solid ${tokens.brandSecondary}30`,
                                        }}
                                    >
                                        <h4 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: tokens.brandSecondary }}>
                                            <Sparkles className="w-5 h-5" />
                                            Key Reminders
                                        </h4>
                                        <ul className="space-y-3">
                                            {coachingSummary.key_reminders.map((reminder: string, i: number) => (
                                                <li key={i} className="flex items-start gap-3">
                                                    <div
                                                        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                                                        style={{ backgroundColor: `${tokens.brandSecondary}20` }}
                                                    >
                                                        <span className="text-xs font-bold" style={{ color: tokens.brandSecondary }}>{i + 1}</span>
                                                    </div>
                                                    <span style={{ color: tokens.textSecondary }}>{reminder}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Objection Responses */}
                                {coachingSummary.objection_responses && coachingSummary.objection_responses.length > 0 && (
                                    <div
                                        className="rounded-2xl p-6"
                                        style={{
                                            backgroundColor: `${tokens.statusWarning}08`,
                                            border: `1px solid ${tokens.statusWarning}30`,
                                        }}
                                    >
                                        <h4 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: tokens.statusWarning }}>
                                            <MessageSquare className="w-5 h-5" />
                                            Objection Responses
                                        </h4>
                                        <div className="space-y-4">
                                            {coachingSummary.objection_responses.map((obj: any, i: number) => (
                                                <div
                                                    key={i}
                                                    className="rounded-xl p-4"
                                                    style={{ backgroundColor: tokens.bgSurface }}
                                                >
                                                    <div className="font-medium mb-2" style={{ color: tokens.statusWarning }}>
                                                        "{obj.objection}"
                                                    </div>
                                                    <div
                                                        className="pl-4 border-l-2"
                                                        style={{
                                                            borderColor: `${tokens.statusWarning}30`,
                                                            color: tokens.textSecondary,
                                                        }}
                                                    >
                                                        {obj.response}
                                                    </div>
                                                    {obj.notes && (
                                                        <div className="text-sm mt-2 italic" style={{ color: tokens.textMuted }}>
                                                            Note: {obj.notes}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Strategy Tips */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {coachingSummary.lead_with && (
                                        <div
                                            className="rounded-xl p-4"
                                            style={{
                                                backgroundColor: tokens.bgSurface,
                                                border: `1px solid ${tokens.statusSuccess}30`,
                                            }}
                                        >
                                            <h5 className="text-xs uppercase tracking-wider mb-2" style={{ color: tokens.statusSuccess }}>Lead With</h5>
                                            <p style={{ color: tokens.textSecondary }}>{coachingSummary.lead_with}</p>
                                        </div>
                                    )}

                                    {coachingSummary.negotiation_boundaries && (
                                        <div
                                            className="rounded-xl p-4"
                                            style={{
                                                backgroundColor: tokens.bgSurface,
                                                border: `1px solid ${tokens.brandSecondary}30`,
                                            }}
                                        >
                                            <h5 className="text-xs uppercase tracking-wider mb-2" style={{ color: tokens.brandSecondary }}>Negotiation Room</h5>
                                            <p style={{ color: tokens.textSecondary }}>{coachingSummary.negotiation_boundaries}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Avoid */}
                                {coachingSummary.avoid && coachingSummary.avoid.length > 0 && (
                                    <div
                                        className="rounded-xl p-4"
                                        style={{
                                            backgroundColor: `${tokens.statusDanger}08`,
                                            border: `1px solid ${tokens.statusDanger}30`,
                                        }}
                                    >
                                        <h5 className="text-xs uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: tokens.statusDanger }}>
                                            <AlertTriangle className="w-4 h-4" />
                                            Avoid
                                        </h5>
                                        <div className="flex flex-wrap gap-2">
                                            {coachingSummary.avoid.map((item: string, i: number) => (
                                                <span
                                                    key={i}
                                                    className="px-3 py-1 rounded-lg text-sm"
                                                    style={{
                                                        backgroundColor: `${tokens.statusDanger}10`,
                                                        border: `1px solid ${tokens.statusDanger}20`,
                                                        color: tokens.statusDanger,
                                                    }}
                                                >
                                                    {item}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer Actions */}
                            <div
                                className="px-8 py-5 flex items-center justify-between"
                                style={{ borderTop: `1px solid ${tokens.borderSubtle}` }}
                            >
                                <button
                                    onClick={() => {
                                        setShowSummary(false);
                                        startCoachingSession();
                                    }}
                                    className="px-4 py-2 rounded-xl flex items-center gap-2 transition-colors hover:bg-white/10"
                                    style={{
                                        backgroundColor: tokens.bgSurface,
                                        border: `1px solid ${tokens.borderSubtle}`,
                                        color: tokens.textSecondary,
                                    }}
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Redo Coaching
                                </button>

                                <motion.button
                                    onClick={() => setShowSummary(false)}
                                    className="px-6 py-3 rounded-xl text-white font-semibold transition-all"
                                    style={{
                                        background: `linear-gradient(to right, ${tokens.brandPrimary}, ${tokens.brandSecondary})`,
                                    }}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    Done
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Show Summary Card if exists */}
            <AnimatePresence>
                {coachingSummary && !showSummary && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={springConfig}
                        className="fixed bottom-6 right-6 z-40"
                    >
                        <motion.button
                            onClick={() => setShowSummary(true)}
                            className="px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg transition-all"
                            style={{
                                backgroundColor: `${tokens.statusSuccess}20`,
                                border: `1px solid ${tokens.statusSuccess}30`,
                                color: tokens.statusSuccess,
                            }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <FileText className="w-5 h-5" />
                            <span className="font-medium">View Offer Script</span>
                        </motion.button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
