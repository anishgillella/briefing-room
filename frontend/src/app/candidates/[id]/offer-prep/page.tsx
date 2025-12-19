"use client";

import { useState, useEffect } from "react";
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
import VoiceSession from "@/components/voice-ingest/VoiceSession";

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

    const handleCoachingEnd = async () => {
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
            <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 text-purple-400 animate-spin mx-auto mb-4" />
                    <p className="text-white/60">Loading offer preparation context...</p>
                </div>
            </div>
        );
    }

    if (error || !context) {
        return (
            <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-white">
                <div className="text-center">
                    <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <h1 className="text-xl font-bold mb-2">Failed to Load</h1>
                    <p className="text-white/60 mb-4">{error}</p>
                    <button
                        onClick={() => router.back()}
                        className="px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    const { candidate, market_data, ready_for_coaching } = context;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 text-white">
            {/* Header */}
            <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-white/60 hover:text-white transition group"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        Back to Candidate
                    </button>

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
            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Page Title */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Offer Preparation
                    </h1>
                    <div className="flex items-center gap-4 text-white/60">
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
                </div>

                {/* Not Ready Warning */}
                {!ready_for_coaching && (
                    <div className="mb-8 p-6 rounded-2xl bg-yellow-500/10 border border-yellow-500/20">
                        <div className="flex items-start gap-4">
                            <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <h3 className="font-semibold text-yellow-300 mb-1">
                                    Interviews Not Complete
                                </h3>
                                <p className="text-yellow-200/70 text-sm">
                                    {candidate.interviews_completed}/3 interviews completed. Complete all
                                    interview rounds to get full coaching preparation.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Candidate Intelligence */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Interview Summary Card */}
                        <div className="glass-panel rounded-3xl p-6 border border-white/10">
                            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-purple-400" />
                                Interview Summary
                            </h2>

                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="bg-white/5 rounded-xl p-4 text-center">
                                    <div className="text-3xl font-bold text-purple-400">
                                        {candidate.interviews_completed}
                                    </div>
                                    <div className="text-xs text-white/40 uppercase tracking-wider mt-1">
                                        Rounds Complete
                                    </div>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4 text-center">
                                    <div className="text-3xl font-bold text-blue-400">
                                        {candidate.average_interview_score || "—"}
                                    </div>
                                    <div className="text-xs text-white/40 uppercase tracking-wider mt-1">
                                        Avg Score
                                    </div>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4 text-center">
                                    <div className="text-3xl font-bold text-green-400">
                                        {candidate.total_transcript_turns}
                                    </div>
                                    <div className="text-xs text-white/40 uppercase tracking-wider mt-1">
                                        Transcript Turns
                                    </div>
                                </div>
                            </div>

                            {candidate.recommendation && (
                                <div
                                    className={`p-4 rounded-xl ${
                                        candidate.recommendation === "Strong Hire"
                                            ? "bg-green-500/10 border border-green-500/20"
                                            : candidate.recommendation === "Hire"
                                            ? "bg-blue-500/10 border border-blue-500/20"
                                            : "bg-red-500/10 border border-red-500/20"
                                    }`}
                                >
                                    <span className="text-sm text-white/60">Recommendation: </span>
                                    <span
                                        className={`font-semibold ${
                                            candidate.recommendation === "Strong Hire"
                                                ? "text-green-400"
                                                : candidate.recommendation === "Hire"
                                                ? "text-blue-400"
                                                : "text-red-400"
                                        }`}
                                    >
                                        {candidate.recommendation}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Candidate Priorities */}
                        <div className="glass-panel rounded-3xl p-6 border border-white/10">
                            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <Target className="w-5 h-5 text-cyan-400" />
                                What They Value
                            </h2>

                            {candidate.priorities.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {candidate.priorities.map((priority, i) => (
                                        <div
                                            key={i}
                                            className={`p-4 rounded-xl border ${
                                                priority.importance === "high"
                                                    ? "bg-purple-500/10 border-purple-500/20"
                                                    : priority.importance === "medium"
                                                    ? "bg-blue-500/10 border-blue-500/20"
                                                    : "bg-white/5 border-white/10"
                                            }`}
                                        >
                                            <div className="font-medium text-white mb-1">
                                                {priority.name}
                                            </div>
                                            <div className="text-xs text-white/40 uppercase">
                                                {priority.importance} Priority
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-white/40">
                                    <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p>Priorities will be extracted during coaching session</p>
                                </div>
                            )}
                        </div>

                        {/* Key Quotes */}
                        <div className="glass-panel rounded-3xl p-6 border border-white/10">
                            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <Quote className="w-5 h-5 text-amber-400" />
                                Key Quotes from Interviews
                            </h2>

                            {candidate.key_quotes.length > 0 ? (
                                <div className="space-y-4">
                                    {candidate.key_quotes.map((quote, i) => (
                                        <div
                                            key={i}
                                            className="p-4 bg-white/5 rounded-xl border-l-4 border-amber-500/50"
                                        >
                                            <p className="text-white/90 italic">"{quote.text}"</p>
                                            <p className="text-xs text-white/40 mt-2">
                                                — {quote.round}
                                                {quote.context && ` • ${quote.context}`}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-white/40">
                                    <Quote className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p>Key quotes will be extracted during coaching session</p>
                                </div>
                            )}
                        </div>

                        {/* Risk Factors */}
                        {candidate.risk_factors.length > 0 && (
                            <div className="glass-panel rounded-3xl p-6 border border-red-500/20 bg-red-500/5">
                                <h2 className="text-lg font-semibold text-red-300 mb-4 flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5" />
                                    Risk Factors
                                </h2>
                                <div className="space-y-3">
                                    {candidate.risk_factors.map((risk, i) => (
                                        <div
                                            key={i}
                                            className="flex items-start gap-3 p-3 bg-red-500/10 rounded-lg"
                                        >
                                            <AlertCircle
                                                className={`w-4 h-4 mt-0.5 ${
                                                    risk.severity === "high"
                                                        ? "text-red-400"
                                                        : "text-orange-400"
                                                }`}
                                            />
                                            <span className="text-white/80">{risk.description}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column - Market Data & Offer */}
                    <div className="space-y-6">
                        {/* Market Positioning */}
                        <div className="glass-panel rounded-3xl p-6 border border-white/10">
                            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-green-400" />
                                Market Positioning
                            </h2>

                            {market_data ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-sm text-white/60 mb-4">
                                        <Briefcase className="w-4 h-4" />
                                        {market_data.role_title}
                                        <span className="text-white/30">•</span>
                                        <MapPin className="w-4 h-4" />
                                        {market_data.location}
                                    </div>

                                    {/* Salary Range Bar */}
                                    <div>
                                        <div className="flex justify-between text-xs text-white/40 mb-1">
                                            <span>{formatCurrency(market_data.salary_min)}</span>
                                            <span>{formatCurrency(market_data.salary_max)}</span>
                                        </div>
                                        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-purple-500 to-cyan-500"
                                                style={{
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
                                            />
                                        </div>
                                        <div className="text-center mt-2">
                                            <span className="text-xs text-white/40">Median: </span>
                                            <span className="text-sm font-semibold text-white">
                                                {formatCurrency(market_data.salary_median)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Equity Benchmark */}
                                    <div className="p-4 bg-white/5 rounded-xl">
                                        <div className="text-xs text-white/40 uppercase tracking-wider mb-1">
                                            Typical Equity
                                        </div>
                                        <div className="text-xl font-semibold text-white">
                                            {market_data.equity_typical_percent
                                                ? `${market_data.equity_typical_percent}%`
                                                : "N/A"}
                                        </div>
                                        {market_data.vesting_standard && (
                                            <div className="text-xs text-white/40 mt-1">
                                                {market_data.vesting_standard}
                                            </div>
                                        )}
                                    </div>

                                    {/* Market Trend */}
                                    {market_data.market_trend && (
                                        <div
                                            className={`p-3 rounded-lg text-sm ${
                                                market_data.market_trend === "rising"
                                                    ? "bg-green-500/10 text-green-400"
                                                    : market_data.market_trend === "declining"
                                                    ? "bg-red-500/10 text-red-400"
                                                    : "bg-white/5 text-white/60"
                                            }`}
                                        >
                                            Market trend: {market_data.market_trend}
                                        </div>
                                    )}

                                    {market_data.confidence_level && (
                                        <div className="text-xs text-white/30 text-center">
                                            Data confidence: {market_data.confidence_level}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-white/40">
                                    <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p>Market data unavailable</p>
                                </div>
                            )}

                            {/* Company Info for Market Research */}
                            <div className="mt-4 pt-4 border-t border-white/10">
                                <div className="text-xs text-white/40 uppercase tracking-wider mb-3">
                                    Enhance Market Data
                                </div>
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        placeholder="Company Name (e.g., Acme Inc)"
                                        value={companyName}
                                        onChange={(e) => setCompanyName(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Company Website (e.g., https://acme.com)"
                                        value={companyWebsite}
                                        onChange={(e) => setCompanyWebsite(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
                                    />
                                    <button
                                        onClick={refreshMarketData}
                                        disabled={refreshingMarketData}
                                        className="w-full flex items-center justify-center gap-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg px-4 py-2 text-sm text-purple-300 transition-colors disabled:opacity-50"
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
                        </div>

                        {/* Your Offer */}
                        <div className="glass-panel rounded-3xl p-6 border border-purple-500/20 bg-purple-500/5">
                            <h2 className="text-lg font-semibold text-purple-300 mb-4 flex items-center gap-2">
                                <DollarSign className="w-5 h-5" />
                                Your Offer
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">
                                        Base Salary
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
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
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-8 text-white focus:outline-none focus:border-purple-500/50"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">
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
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">
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
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Start Coaching CTA */}
                        <button
                            onClick={startCoachingSession}
                            disabled={!ready_for_coaching || preparingCoaching}
                            className={`w-full py-5 rounded-2xl font-semibold text-lg flex items-center justify-center gap-3 transition-all ${
                                ready_for_coaching && !preparingCoaching
                                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-[0_0_40px_rgba(168,85,247,0.4)] hover:scale-[1.02]"
                                    : "bg-white/5 text-white/40 cursor-not-allowed"
                            }`}
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
                        </button>

                        <p className="text-center text-xs text-white/30">
                            ~12 min personalized coaching call
                        </p>
                    </div>
                </div>
            </main>

            {/* Coaching Session Modal */}
            {showCoachingModal && coachingVariables && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#0A0A0A] rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-white/10 shadow-2xl flex flex-col">
                        {/* Modal Header */}
                        <div className="border-b border-white/10 px-8 py-5 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                                    <Mic className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-white">
                                        Coaching Session
                                    </h3>
                                    <p className="text-sm text-white/40">
                                        Preparing offer for {candidate.candidate_name}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleCoachingEnd}
                                className="p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors flex items-center gap-2"
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
                                />

                                {/* Live Transcript (optional) */}
                                {coachingTranscript.length > 0 && (
                                    <div className="mt-6 max-h-48 overflow-y-auto border-t border-white/10 pt-4">
                                        <h4 className="text-xs text-white/40 uppercase tracking-wider mb-3">
                                            Live Transcript
                                        </h4>
                                        <div className="space-y-2">
                                            {coachingTranscript.slice(-5).map((item, i) => (
                                                <div
                                                    key={i}
                                                    className={`text-sm ${
                                                        item.role === "agent"
                                                            ? "text-purple-300"
                                                            : "text-white/70"
                                                    }`}
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
                        <div className="border-t border-white/10 px-8 py-4 bg-white/5 flex-shrink-0">
                            <div className="flex gap-6 text-xs text-white/40">
                                <span>
                                    <strong className="text-white/60">Candidate:</strong>{" "}
                                    {coachingVariables.candidate_name}
                                </span>
                                <span>
                                    <strong className="text-white/60">Offer:</strong>{" "}
                                    {coachingVariables.offer_base}
                                </span>
                                <span>
                                    <strong className="text-white/60">Equity:</strong>{" "}
                                    {coachingVariables.offer_equity}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Generating Summary Indicator */}
            {generatingSummary && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="text-center">
                        <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-white mb-2">
                            Generating Your Offer Script
                        </h3>
                        <p className="text-white/50">
                            Analyzing coaching session and creating personalized recommendations...
                        </p>
                    </div>
                </div>
            )}

            {/* Coaching Summary Modal */}
            {showSummary && coachingSummary && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-[#0A0A0A] rounded-3xl max-w-4xl w-full border border-white/10 shadow-2xl my-8">
                        {/* Modal Header */}
                        <div className="border-b border-white/10 px-8 py-5 flex items-center justify-between sticky top-0 bg-[#0A0A0A] rounded-t-3xl z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <CheckCircle className="w-6 h-6 text-green-400" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-white">
                                        Coaching Complete
                                    </h3>
                                    <p className="text-sm text-white/40">
                                        Your personalized offer script is ready
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowSummary(false)}
                                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5 text-white/60" />
                            </button>
                        </div>

                        {/* Summary Content */}
                        <div className="p-8 space-y-8">
                            {/* Offer Script */}
                            {coachingSummary.offer_script && (
                                <div className="glass-panel rounded-2xl p-6 border border-purple-500/20 bg-purple-500/5">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-lg font-semibold text-purple-300 flex items-center gap-2">
                                            <FileText className="w-5 h-5" />
                                            Your Offer Script
                                        </h4>
                                        <button
                                            onClick={() => {
                                                const script = `Opening:\n${coachingSummary.offer_script.opening}\n\nEquity Explanation:\n${coachingSummary.offer_script.equity_explanation}\n\n${coachingSummary.offer_script.competitor_handling ? `Competitor Handling:\n${coachingSummary.offer_script.competitor_handling}\n\n` : ''}Closing:\n${coachingSummary.offer_script.closing}`;
                                                navigator.clipboard.writeText(script);
                                            }}
                                            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white/70 flex items-center gap-2 transition-colors"
                                        >
                                            <Copy className="w-4 h-4" />
                                            Copy Script
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <h5 className="text-xs text-white/40 uppercase tracking-wider mb-2">Opening</h5>
                                            <p className="text-white/90 bg-black/30 rounded-xl p-4 border-l-4 border-purple-500/50">
                                                {coachingSummary.offer_script.opening}
                                            </p>
                                        </div>

                                        <div>
                                            <h5 className="text-xs text-white/40 uppercase tracking-wider mb-2">Equity Explanation</h5>
                                            <p className="text-white/90 bg-black/30 rounded-xl p-4 border-l-4 border-blue-500/50">
                                                {coachingSummary.offer_script.equity_explanation}
                                            </p>
                                        </div>

                                        {coachingSummary.offer_script.competitor_handling && (
                                            <div>
                                                <h5 className="text-xs text-white/40 uppercase tracking-wider mb-2">Handling Competition</h5>
                                                <p className="text-white/90 bg-black/30 rounded-xl p-4 border-l-4 border-amber-500/50">
                                                    {coachingSummary.offer_script.competitor_handling}
                                                </p>
                                            </div>
                                        )}

                                        <div>
                                            <h5 className="text-xs text-white/40 uppercase tracking-wider mb-2">Closing</h5>
                                            <p className="text-white/90 bg-black/30 rounded-xl p-4 border-l-4 border-green-500/50">
                                                {coachingSummary.offer_script.closing}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Key Reminders */}
                            {coachingSummary.key_reminders && coachingSummary.key_reminders.length > 0 && (
                                <div className="glass-panel rounded-2xl p-6 border border-cyan-500/20 bg-cyan-500/5">
                                    <h4 className="text-lg font-semibold text-cyan-300 mb-4 flex items-center gap-2">
                                        <Sparkles className="w-5 h-5" />
                                        Key Reminders
                                    </h4>
                                    <ul className="space-y-3">
                                        {coachingSummary.key_reminders.map((reminder: string, i: number) => (
                                            <li key={i} className="flex items-start gap-3">
                                                <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <span className="text-cyan-400 text-xs font-bold">{i + 1}</span>
                                                </div>
                                                <span className="text-white/80">{reminder}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Objection Responses */}
                            {coachingSummary.objection_responses && coachingSummary.objection_responses.length > 0 && (
                                <div className="glass-panel rounded-2xl p-6 border border-amber-500/20 bg-amber-500/5">
                                    <h4 className="text-lg font-semibold text-amber-300 mb-4 flex items-center gap-2">
                                        <MessageSquare className="w-5 h-5" />
                                        Objection Responses
                                    </h4>
                                    <div className="space-y-4">
                                        {coachingSummary.objection_responses.map((obj: any, i: number) => (
                                            <div key={i} className="bg-black/30 rounded-xl p-4">
                                                <div className="text-amber-300 font-medium mb-2">
                                                    "{obj.objection}"
                                                </div>
                                                <div className="text-white/80 pl-4 border-l-2 border-amber-500/30">
                                                    {obj.response}
                                                </div>
                                                {obj.notes && (
                                                    <div className="text-white/40 text-sm mt-2 italic">
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
                                    <div className="glass-panel rounded-xl p-4 border border-green-500/20">
                                        <h5 className="text-xs text-green-400 uppercase tracking-wider mb-2">Lead With</h5>
                                        <p className="text-white/80">{coachingSummary.lead_with}</p>
                                    </div>
                                )}

                                {coachingSummary.negotiation_boundaries && (
                                    <div className="glass-panel rounded-xl p-4 border border-blue-500/20">
                                        <h5 className="text-xs text-blue-400 uppercase tracking-wider mb-2">Negotiation Room</h5>
                                        <p className="text-white/80">{coachingSummary.negotiation_boundaries}</p>
                                    </div>
                                )}
                            </div>

                            {/* Avoid */}
                            {coachingSummary.avoid && coachingSummary.avoid.length > 0 && (
                                <div className="glass-panel rounded-xl p-4 border border-red-500/20 bg-red-500/5">
                                    <h5 className="text-xs text-red-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        Avoid
                                    </h5>
                                    <div className="flex flex-wrap gap-2">
                                        {coachingSummary.avoid.map((item: string, i: number) => (
                                            <span key={i} className="px-3 py-1 bg-red-500/10 text-red-300 rounded-lg text-sm border border-red-500/20">
                                                {item}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="border-t border-white/10 px-8 py-5 flex items-center justify-between">
                            <button
                                onClick={() => {
                                    setShowSummary(false);
                                    startCoachingSession();
                                }}
                                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 flex items-center gap-2 transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Redo Coaching
                            </button>

                            <button
                                onClick={() => setShowSummary(false)}
                                className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold hover:opacity-90 transition-all"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Show Summary Card if exists */}
            {coachingSummary && !showSummary && (
                <div className="fixed bottom-6 right-6 z-40">
                    <button
                        onClick={() => setShowSummary(true)}
                        className="px-4 py-3 rounded-xl bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 flex items-center gap-3 shadow-lg transition-all hover:scale-105"
                    >
                        <FileText className="w-5 h-5" />
                        <span className="font-medium">View Offer Script</span>
                    </button>
                </div>
            )}

            {/* Custom Scrollbar Styles */}
            <style jsx global>{`
                .glass-panel {
                    background: rgba(255, 255, 255, 0.03);
                    backdrop-filter: blur(20px);
                }
            `}</style>
        </div>
    );
}
