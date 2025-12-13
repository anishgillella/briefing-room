"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Vapi from "@vapi-ai/web";
import {
    ArrowLeft,
    Briefcase,
    MapPin,
    Star,
    AlertTriangle,
    ThumbsUp,
    ThumbsDown,
    PlayCircle,
    Loader2,
    CheckCircle,
    XCircle,
    ChevronDown,
    ChevronUp,
    Target,
    Lightbulb,
    MessageSquare,
    Zap,
    TrendingUp,
    TrendingDown,
    Shield,
    Clock,
    Sparkles,
    Mic,
    MicOff,
    Volume2,
} from "lucide-react";

const API_URL = "http://localhost:8000";

// Types
interface Candidate {
    id: string;
    name: string;
    email?: string;
    job_title?: string;
    current_company?: string;
    location_city?: string;
    location_state?: string;
    years_experience?: number;
    bio_summary?: string;
    industries: string[];
    skills: string[];
    algo_score?: number;
    ai_score?: number;
    combined_score?: number;
    tier?: string;
    one_line_summary?: string;
    pros: string[];
    cons: string[];
    reasoning?: string;
    interview_questions: string[];
    missing_required: string[];
    missing_preferred: string[];
    red_flags: string[];
    interview_status?: string;
    interview_score?: number;
    recommendation?: string;
    quota_attainment_history?: string;
    years_closing_experience?: number;
    sold_to_finance_accounting_leaders?: boolean;
    mid_market_enterprise_experience?: boolean;
    finance_accounting_degree?: boolean;
    travel_willingness?: boolean;
}

interface ScoreBreakdown {
    technical_skills: number;
    experience_relevance: number;
    leadership_potential: number;
    communication_signals: number;
    culture_fit_signals: number;
    growth_trajectory: number;
}

interface SkillMatch {
    skill: string;
    required_level: string;
    candidate_level: string;
    evidence?: string;
    is_match: boolean;
}

interface Strength {
    strength: string;
    evidence: string;
    how_to_verify: string;
}

interface Concern {
    concern: string;
    evidence: string;
    suggested_question: string;
    severity: string;
}

interface SuggestedQuestion {
    question: string;
    category: string;
    purpose: string;
    follow_up?: string;
}

interface PreBrief {
    candidate_name: string;
    current_role: string;
    years_experience: number;
    overall_fit_score: number;
    fit_summary: string;
    score_breakdown: ScoreBreakdown;
    skill_matches: SkillMatch[];
    strengths: Strength[];
    concerns: Concern[];
    suggested_questions: SuggestedQuestion[];
    tldr: string;
    key_things_to_remember: string[];
}

export default function CandidateDetailPage() {
    const params = useParams();
    const router = useRouter();
    const candidateId = params.id as string;

    const [candidate, setCandidate] = useState<Candidate | null>(null);
    const [prebrief, setPrebrief] = useState<PreBrief | null>(null);
    const [loading, setLoading] = useState(true);
    const [prebriefLoading, setPrebriefLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [startingInterview, setStartingInterview] = useState(false);
    const [activeTab, setActiveTab] = useState<"overview" | "analysis" | "interview">("overview");
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        strengths: true,
        concerns: true,
        questions: true,
    });

    // Voice agent state
    const [isVoiceActive, setIsVoiceActive] = useState(false);
    const [isVoiceConnecting, setIsVoiceConnecting] = useState(false);
    const [voiceTranscript, setVoiceTranscript] = useState<string[]>([]);
    const vapiRef = useRef<Vapi | null>(null);

    useEffect(() => {
        fetchCandidate();
    }, [candidateId]);

    const fetchCandidate = async () => {
        try {
            const res = await fetch(`${API_URL}/api/pluto/candidates/${candidateId}`);
            if (!res.ok) throw new Error("Candidate not found");
            const data = await res.json();
            setCandidate(data);
            // Auto-fetch prebrief if available
            fetchPrebrief();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchPrebrief = async () => {
        setPrebriefLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/pluto/candidates/${candidateId}/prebrief`);
            if (res.ok) {
                const data = await res.json();
                setPrebrief(data.prebrief);
            }
        } catch (e) {
            // Prebrief not available yet, that's okay
        } finally {
            setPrebriefLoading(false);
        }
    };

    const generatePrebrief = async () => {
        setPrebriefLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/pluto/candidates/${candidateId}/prebrief`);
            if (res.ok) {
                const data = await res.json();
                setPrebrief(data.prebrief);
            } else {
                alert("Failed to generate pre-brief");
            }
        } catch (e) {
            alert("Failed to generate pre-brief");
        } finally {
            setPrebriefLoading(false);
        }
    };

    const handleStartInterview = async () => {
        setStartingInterview(true);
        try {
            const res = await fetch(`${API_URL}/api/pluto/candidates/${candidateId}/interview/start`, {
                method: "POST",
            });
            if (res.ok) {
                const data = await res.json();
                router.push(`/candidates/${candidateId}/interview?room=${data.room_name}`);
            } else {
                const data = await res.json();
                alert(data.detail || "Failed to start interview");
            }
        } catch (e) {
            alert("Failed to start interview");
        } finally {
            setStartingInterview(false);
        }
    };

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Build briefing context for voice agent
    const buildBriefingContext = useCallback(() => {
        if (!candidate) return "";
        const parts = [
            `Candidate: ${candidate.name}`,
            candidate.job_title ? `Current Role: ${candidate.job_title}` : "",
            candidate.years_experience ? `Experience: ${candidate.years_experience} years` : "",
            candidate.one_line_summary ? `Summary: ${candidate.one_line_summary}` : "",
            candidate.pros?.length ? `Strengths: ${candidate.pros.join(", ")}` : "",
            candidate.cons?.length ? `Concerns: ${candidate.cons.join(", ")}` : "",
            candidate.red_flags?.length ? `Red Flags: ${candidate.red_flags.join(", ")}` : "",
            candidate.interview_questions?.length ? `Suggested Questions: ${candidate.interview_questions.join(" | ")}` : "",
        ];
        return parts.filter(Boolean).join("\n");
    }, [candidate]);

    // Start voice agent
    const startVoiceAgent = useCallback(async () => {
        const vapiKey = process.env.NEXT_PUBLIC_VAPI_WEB_KEY;
        const assistantId = process.env.NEXT_PUBLIC_VAPI_BRIEFING_ASSISTANT_ID;

        if (!vapiKey) {
            alert("Voice AI not configured. Add NEXT_PUBLIC_VAPI_WEB_KEY to .env.local");
            return;
        }

        setIsVoiceConnecting(true);
        setVoiceTranscript([]);

        try {
            const vapi = new Vapi(vapiKey);
            vapiRef.current = vapi;

            vapi.on("call-start", () => {
                setIsVoiceConnecting(false);
                setIsVoiceActive(true);
                setVoiceTranscript(prev => [...prev, "🎙️ Voice assistant connected. Ask me anything about this candidate!"]);
            });

            vapi.on("call-end", () => {
                setIsVoiceActive(false);
                setVoiceTranscript(prev => [...prev, "👋 Voice assistant disconnected."]);
            });

            vapi.on("message", (msg: any) => {
                if (msg.type === "transcript" && msg.transcript) {
                    const role = msg.role === "assistant" ? "🤖" : "🗣️";
                    setVoiceTranscript(prev => [...prev, `${role} ${msg.transcript}`]);
                }
            });

            vapi.on("error", (err: any) => {
                console.error("VAPI error:", err);
                setIsVoiceConnecting(false);
                setIsVoiceActive(false);
                if (err && Object.keys(err).length > 0) {
                    setVoiceTranscript(prev => [...prev, `❌ Error: ${err.message || JSON.stringify(err)}`]);
                }
            });

            const briefingContext = buildBriefingContext();

            if (assistantId) {
                await vapi.start(assistantId, {
                    variableValues: {
                        candidateName: candidate?.name || "the candidate",
                        briefingContext: briefingContext,
                    }
                });
            } else {
                // Inline assistant config
                await vapi.start({
                    model: {
                        provider: "openai",
                        model: "gpt-4o-mini",
                        messages: [
                            {
                                role: "system",
                                content: `You are a helpful interview preparation assistant. You're helping a recruiter prepare for an interview with a candidate.

Here's the candidate information:
${briefingContext}

Help by:
- Answering questions about the candidate's background
- Suggesting probing questions based on their experience
- Highlighting concerns or red flags to explore
- Providing interviewing tips specific to this candidate

Be concise and helpful. The recruiter has limited time before the interview.`
                            }
                        ]
                    },
                    voice: {
                        provider: "11labs",
                        voiceId: "21m00Tcm4TlvDq8ikWAM"
                    },
                    firstMessage: `Hi! I'm ready to help you prepare for your interview with ${candidate?.name || "this candidate"}. What would you like to know?`
                });
            }
        } catch (err) {
            console.error("Voice agent failed:", err);
            setIsVoiceConnecting(false);
            const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
            alert(`Failed to start voice AI: ${errorMsg}`);
        }
    }, [candidate, buildBriefingContext]);

    // Stop voice agent
    const stopVoiceAgent = useCallback(() => {
        if (vapiRef.current) {
            vapiRef.current.stop();
            vapiRef.current = null;
        }
        setIsVoiceActive(false);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (vapiRef.current) {
                vapiRef.current.stop();
            }
        };
    }, []);

    // Toggle voice
    const handleVoiceToggle = () => {
        if (isVoiceActive) {
            stopVoiceAgent();
        } else {
            startVoiceAgent();
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 text-purple-400 animate-spin mx-auto mb-4" />
                    <p className="text-white/60">Loading candidate profile...</p>
                </div>
            </div>
        );
    }

    if (error || !candidate) {
        return (
            <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-white">
                <div className="text-center">
                    <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <h1 className="text-xl font-bold mb-2">Candidate Not Found</h1>
                    <p className="text-white/60 mb-4">{error}</p>
                    <button
                        onClick={() => window.history.length > 1 ? router.back() : router.push("/")}
                        className="px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    const getScoreColor = (score?: number) => {
        if (!score) return "text-gray-400";
        if (score >= 80) return "text-green-400";
        if (score >= 60) return "text-yellow-400";
        return "text-red-400";
    };

    const getScoreGradient = (score?: number) => {
        if (!score) return "from-gray-500 to-gray-600";
        if (score >= 80) return "from-green-500 to-emerald-500";
        if (score >= 60) return "from-yellow-500 to-orange-500";
        return "from-red-500 to-rose-500";
    };

    const getTierClass = (tier?: string) => {
        switch (tier) {
            case "Top Tier": return "bg-gradient-to-r from-yellow-500 to-orange-500 text-white";
            case "Strong": return "bg-gradient-to-r from-green-500 to-emerald-500 text-white";
            case "Good": return "bg-gradient-to-r from-blue-500 to-cyan-500 text-white";
            case "Evaluate": return "bg-gradient-to-r from-purple-500 to-pink-500 text-white";
            default: return "bg-gradient-to-r from-gray-500 to-slate-500 text-white";
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity?.toLowerCase()) {
            case "high": return "bg-red-500/20 border-red-500/30 text-red-400";
            case "medium": return "bg-yellow-500/20 border-yellow-500/30 text-yellow-400";
            default: return "bg-blue-500/20 border-blue-500/30 text-blue-400";
        }
    };

    const tabs = [
        { id: "overview", label: "Overview", icon: Target },
        { id: "analysis", label: "Deep Analysis", icon: Zap },
        { id: "interview", label: "Interview Prep", icon: MessageSquare },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 text-white">
            {/* Header */}
            <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <button
                        onClick={() => window.history.length > 1 ? router.back() : router.push("/")}
                        className="flex items-center gap-2 text-white/60 hover:text-white transition group"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        Back to Rankings
                    </button>
                    <div className="flex gap-3 items-center">
                        {/* Voice indicator */}
                        {isVoiceActive && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 border border-violet-500/30 rounded-full animate-pulse">
                                <Volume2 className="w-4 h-4 text-violet-400" />
                                <span className="text-sm text-violet-300">AI Listening...</span>
                            </div>
                        )}
                        {/* Voice AI Button */}
                        <button
                            onClick={handleVoiceToggle}
                            disabled={isVoiceConnecting}
                            className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${isVoiceActive
                                ? "bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30"
                                : "bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30"
                                } disabled:opacity-50`}
                        >
                            {isVoiceConnecting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isVoiceActive ? (
                                <MicOff className="w-4 h-4" />
                            ) : (
                                <Mic className="w-4 h-4" />
                            )}
                            {isVoiceConnecting ? "Connecting..." : isVoiceActive ? "Stop AI" : "Ask AI"}
                        </button>
                        {!prebrief && !prebriefLoading && (
                            <button
                                onClick={generatePrebrief}
                                className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition flex items-center gap-2"
                            >
                                <Sparkles className="w-4 h-4" />
                                Generate Deep Analysis
                            </button>
                        )}
                        <button
                            onClick={handleStartInterview}
                            disabled={startingInterview}
                            className="px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg hover:from-purple-700 hover:to-pink-700 transition flex items-center gap-2 font-semibold disabled:opacity-50 shadow-lg shadow-purple-500/25"
                        >
                            {startingInterview ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <PlayCircle className="w-5 h-5" />
                            )}
                            Start Interview
                        </button>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <div className="bg-gradient-to-b from-purple-900/20 to-transparent">
                <div className="max-w-7xl mx-auto px-6 py-8">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-4xl font-bold">{candidate.name}</h1>
                                {candidate.tier && (
                                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${getTierClass(candidate.tier)}`}>
                                        {candidate.tier}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-4 text-white/60 mb-4">
                                {candidate.job_title && (
                                    <span className="flex items-center gap-1.5">
                                        <Briefcase className="w-4 h-4" />
                                        {candidate.job_title}
                                        {candidate.current_company && ` at ${candidate.current_company}`}
                                    </span>
                                )}
                                {(candidate.location_city || candidate.location_state) && (
                                    <span className="flex items-center gap-1.5">
                                        <MapPin className="w-4 h-4" />
                                        {candidate.location_city}{candidate.location_city && candidate.location_state && ", "}{candidate.location_state}
                                    </span>
                                )}
                                {candidate.years_experience && (
                                    <span className="flex items-center gap-1.5">
                                        <Clock className="w-4 h-4" />
                                        {candidate.years_experience} years experience
                                    </span>
                                )}
                            </div>
                            {/* One-line summary or TL;DR */}
                            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4 max-w-3xl">
                                <p className="text-lg text-white/90">
                                    {prebrief?.tldr || candidate.one_line_summary || candidate.bio_summary}
                                </p>
                            </div>
                        </div>

                        {/* Score Cards */}
                        <div className="flex gap-3 ml-6">
                            {[
                                { label: "Combined", value: candidate.combined_score, icon: Target },
                                { label: "Algorithm", value: candidate.algo_score, icon: Zap },
                                { label: "AI Score", value: candidate.ai_score, icon: Sparkles },
                            ].map((score) => (
                                <div
                                    key={score.label}
                                    className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4 text-center min-w-[100px]"
                                >
                                    <score.icon className={`w-5 h-5 mx-auto mb-2 ${getScoreColor(score.value)}`} />
                                    <div className={`text-3xl font-bold bg-gradient-to-r ${getScoreGradient(score.value)} bg-clip-text text-transparent`}>
                                        {score.value ?? "—"}
                                    </div>
                                    <div className="text-xs text-white/40 mt-1">{score.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Key Things to Remember (if prebrief available) */}
            {prebrief?.key_things_to_remember && prebrief.key_things_to_remember.length > 0 && (
                <div className="max-w-7xl mx-auto px-6 -mt-2 mb-6">
                    <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Lightbulb className="w-5 h-5 text-purple-400" />
                            <h3 className="font-semibold text-purple-300">Key Things to Remember</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {prebrief.key_things_to_remember.map((item, i) => (
                                <div key={i} className="flex items-start gap-2 text-sm text-white/80">
                                    <span className="text-purple-400 mt-0.5">•</span>
                                    {item}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Navigation */}
            <div className="max-w-7xl mx-auto px-6 mb-6">
                <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${activeTab === tab.id
                                ? "bg-white/10 text-white"
                                : "text-white/50 hover:text-white/80"
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                    {prebriefLoading && (
                        <div className="flex items-center gap-2 px-4 py-2 text-white/50">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">Generating analysis...</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 pb-12">
                {/* OVERVIEW TAB */}
                {activeTab === "overview" && (
                    <div className="space-y-6 animate-fadeIn">
                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: "Closing Experience", value: candidate.years_closing_experience ? `${candidate.years_closing_experience} years` : "Not specified", icon: TrendingUp },
                                { label: "Sold to Finance", value: candidate.sold_to_finance_accounting_leaders ? "Yes" : "No", icon: candidate.sold_to_finance_accounting_leaders ? CheckCircle : XCircle, color: candidate.sold_to_finance_accounting_leaders ? "text-green-400" : "text-red-400" },
                                { label: "Enterprise Exp", value: candidate.mid_market_enterprise_experience ? "Yes" : "No", icon: candidate.mid_market_enterprise_experience ? CheckCircle : XCircle, color: candidate.mid_market_enterprise_experience ? "text-green-400" : "text-red-400" },
                                { label: "Travel Ready", value: candidate.travel_willingness === true ? "Yes" : candidate.travel_willingness === false ? "No" : "Unknown", icon: Shield },
                            ].map((stat, i) => (
                                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                                    <stat.icon className={`w-5 h-5 ${stat.color || "text-white/60"}`} />
                                    <div>
                                        <div className="text-xs text-white/40">{stat.label}</div>
                                        <div className="font-semibold">{stat.value}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Bio Summary */}
                        {candidate.bio_summary && (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                    <Briefcase className="w-5 h-5 text-blue-400" />
                                    Professional Summary
                                </h2>
                                <p className="text-white/70 leading-relaxed">{candidate.bio_summary}</p>
                            </div>
                        )}

                        {/* Quota Attainment */}
                        {candidate.quota_attainment_history && (
                            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-6">
                                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-green-400" />
                                    Quota Attainment History
                                </h2>
                                <p className="text-white/80">{candidate.quota_attainment_history}</p>
                            </div>
                        )}

                        {/* Skills & Industries */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {candidate.skills?.length > 0 && (
                                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                                    <h3 className="text-white/60 font-semibold mb-4">Skills</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {candidate.skills.map((skill, i) => (
                                            <span
                                                key={i}
                                                className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm"
                                            >
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {candidate.industries?.length > 0 && (
                                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                                    <h3 className="text-white/60 font-semibold mb-4">Industries</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {candidate.industries.map((industry, i) => (
                                            <span
                                                key={i}
                                                className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm"
                                            >
                                                {industry}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ANALYSIS TAB */}
                {activeTab === "analysis" && (
                    <div className="space-y-6 animate-fadeIn">
                        {/* Score Breakdown (if prebrief available) */}
                        {prebrief?.score_breakdown && (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                                <h2 className="text-lg font-semibold mb-4">Score Breakdown</h2>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {Object.entries(prebrief.score_breakdown).map(([key, value]) => (
                                        <div key={key} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                            <span className="text-white/60 capitalize text-sm">{key.replace(/_/g, " ")}</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full bg-gradient-to-r ${getScoreGradient(value)} rounded-full`}
                                                        style={{ width: `${value}%` }}
                                                    />
                                                </div>
                                                <span className={`font-bold text-sm ${getScoreColor(value)}`}>{value}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Strengths & Concerns Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Strengths */}
                            <div className="bg-green-500/10 border border-green-500/20 rounded-xl overflow-hidden">
                                <button
                                    onClick={() => toggleSection("strengths")}
                                    className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition"
                                >
                                    <h3 className="text-green-400 font-semibold flex items-center gap-2">
                                        <ThumbsUp className="w-5 h-5" />
                                        Strengths ({prebrief?.strengths?.length || candidate.pros?.length || 0})
                                    </h3>
                                    {expandedSections.strengths ? <ChevronUp className="w-5 h-5 text-white/40" /> : <ChevronDown className="w-5 h-5 text-white/40" />}
                                </button>
                                {expandedSections.strengths && (
                                    <div className="p-4 pt-0 space-y-3">
                                        {(prebrief?.strengths || candidate.pros?.map(p => ({ strength: p, evidence: "", how_to_verify: "" })) || []).map((s: any, i) => (
                                            <div key={i} className="p-3 bg-white/5 rounded-lg">
                                                <div className="font-medium text-white/90 mb-1 flex items-start gap-2">
                                                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                                                    {s.strength || s}
                                                </div>
                                                {s.evidence && <div className="text-sm text-white/50 ml-6 mb-1">{s.evidence}</div>}
                                                {s.how_to_verify && <div className="text-sm text-green-400 ml-6">✓ Verify: {s.how_to_verify}</div>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Concerns */}
                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl overflow-hidden">
                                <button
                                    onClick={() => toggleSection("concerns")}
                                    className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition"
                                >
                                    <h3 className="text-yellow-400 font-semibold flex items-center gap-2">
                                        <ThumbsDown className="w-5 h-5" />
                                        Concerns ({prebrief?.concerns?.length || candidate.cons?.length || 0})
                                    </h3>
                                    {expandedSections.concerns ? <ChevronUp className="w-5 h-5 text-white/40" /> : <ChevronDown className="w-5 h-5 text-white/40" />}
                                </button>
                                {expandedSections.concerns && (
                                    <div className="p-4 pt-0 space-y-3">
                                        {(prebrief?.concerns || candidate.cons?.map(c => ({ concern: c, evidence: "", suggested_question: "", severity: "medium" })) || []).map((c: any, i) => (
                                            <div key={i} className={`p-3 rounded-lg border ${getSeverityColor(c.severity || "medium")}`}>
                                                <div className="flex items-start justify-between mb-1">
                                                    <span className="font-medium flex items-start gap-2">
                                                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                                        {c.concern || c}
                                                    </span>
                                                    {c.severity && <span className="text-xs uppercase px-2 py-0.5 rounded bg-white/10">{c.severity}</span>}
                                                </div>
                                                {c.evidence && <div className="text-sm text-white/50 ml-6 mb-1">{c.evidence}</div>}
                                                {c.suggested_question && <div className="text-sm text-yellow-300 ml-6">💡 Ask: "{c.suggested_question}"</div>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Red Flags */}
                        {candidate.red_flags?.length > 0 && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
                                <h3 className="text-red-400 font-semibold mb-4 flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5" />
                                    Red Flags ({candidate.red_flags.length})
                                </h3>
                                <div className="space-y-2">
                                    {candidate.red_flags.map((flag, i) => (
                                        <div key={i} className="flex items-start gap-2 text-white/80">
                                            <span className="text-red-400">⚠</span>
                                            {flag}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Skill Matches (if prebrief available) */}
                        {prebrief?.skill_matches && prebrief.skill_matches.length > 0 && (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                                <h2 className="font-semibold mb-4">Skill Matches</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {prebrief.skill_matches.map((skill, i) => (
                                        <div
                                            key={i}
                                            className={`p-3 rounded-lg border flex items-center justify-between ${skill.is_match
                                                ? "bg-green-500/10 border-green-500/20"
                                                : "bg-red-500/10 border-red-500/20"
                                                }`}
                                        >
                                            <div>
                                                <span className="font-medium">{skill.skill}</span>
                                                <span className="text-white/40 text-sm ml-2">
                                                    (needs: {skill.required_level})
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm capitalize">{skill.candidate_level}</span>
                                                {skill.is_match ? (
                                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                                ) : (
                                                    <XCircle className="w-4 h-4 text-red-400" />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* AI Reasoning */}
                        {candidate.reasoning && (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-purple-400" />
                                    AI Reasoning
                                </h2>
                                <p className="text-white/70 leading-relaxed">{candidate.reasoning}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* INTERVIEW TAB */}
                {activeTab === "interview" && (
                    <div className="space-y-6 animate-fadeIn">
                        {/* Suggested Questions */}
                        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                            <button
                                onClick={() => toggleSection("questions")}
                                className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition"
                            >
                                <h3 className="font-semibold flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-purple-400" />
                                    Suggested Interview Questions ({prebrief?.suggested_questions?.length || candidate.interview_questions?.length || 0})
                                </h3>
                                {expandedSections.questions ? <ChevronUp className="w-5 h-5 text-white/40" /> : <ChevronDown className="w-5 h-5 text-white/40" />}
                            </button>
                            {expandedSections.questions && (
                                <div className="p-4 pt-0 space-y-4">
                                    {(prebrief?.suggested_questions || candidate.interview_questions?.map((q, i) => ({ question: q, category: "General", purpose: "", follow_up: "" })) || []).map((q: any, i) => (
                                        <div key={i} className="p-4 bg-white/5 rounded-lg border-l-4 border-purple-500">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-purple-400 font-bold">{i + 1}.</span>
                                                {q.category && (
                                                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded capitalize">
                                                        {q.category}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-white/90 mb-2">"{q.question || q}"</p>
                                            {q.purpose && <p className="text-sm text-white/50 mb-1">Purpose: {q.purpose}</p>}
                                            {q.follow_up && <p className="text-sm text-purple-300">Follow-up: {q.follow_up}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Quick Tips for Interview */}
                        <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-6">
                            <h3 className="font-semibold mb-4 flex items-center gap-2">
                                <Lightbulb className="w-5 h-5 text-indigo-400" />
                                Interview Tips for {candidate.name}
                            </h3>
                            <div className="space-y-3">
                                {candidate.sold_to_finance_accounting_leaders === false && (
                                    <div className="flex items-start gap-2 text-sm text-white/80">
                                        <span className="text-yellow-400">⚠</span>
                                        Probe deeply on finance sales experience — this is a key gap
                                    </div>
                                )}
                                {candidate.years_closing_experience && candidate.years_closing_experience < 2 && (
                                    <div className="flex items-start gap-2 text-sm text-white/80">
                                        <span className="text-yellow-400">⚠</span>
                                        Limited closing experience — focus on specific deal examples
                                    </div>
                                )}
                                {candidate.red_flags?.length > 0 && (
                                    <div className="flex items-start gap-2 text-sm text-white/80">
                                        <span className="text-red-400">🚩</span>
                                        Address red flags early: {candidate.red_flags[0]}
                                    </div>
                                )}
                                {candidate.pros?.length > 0 && (
                                    <div className="flex items-start gap-2 text-sm text-white/80">
                                        <span className="text-green-400">✓</span>
                                        Leverage strength: {candidate.pros[0]}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Start Interview CTA */}
                        <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-xl p-8 text-center">
                            <h3 className="text-2xl font-bold mb-2">Ready to Interview?</h3>
                            <p className="text-white/60 mb-6">
                                Start a live interview with AI assistance for real-time coaching
                            </p>
                            <button
                                onClick={handleStartInterview}
                                disabled={startingInterview}
                                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-700 hover:to-pink-700 transition flex items-center gap-2 font-bold mx-auto shadow-lg shadow-purple-500/25 disabled:opacity-50"
                            >
                                {startingInterview ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <PlayCircle className="w-5 h-5" />
                                )}
                                Start Interview Now
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* Floating Voice Assistant Panel */}
            {(isVoiceActive || voiceTranscript.length > 0) && (
                <div className="fixed bottom-6 right-6 w-96 max-h-[400px] bg-slate-900/95 backdrop-blur-xl border border-violet-500/30 rounded-2xl shadow-2xl shadow-violet-500/10 overflow-hidden animate-slideUp z-50">
                    <div className="p-4 border-b border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {isVoiceActive ? (
                                <div className="w-3 h-3 bg-violet-400 rounded-full animate-pulse" />
                            ) : (
                                <div className="w-3 h-3 bg-gray-500 rounded-full" />
                            )}
                            <span className="font-semibold text-white">Voice Assistant</span>
                        </div>
                        <div className="flex gap-2">
                            {isVoiceActive && (
                                <button
                                    onClick={stopVoiceAgent}
                                    className="px-3 py-1 text-xs bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition"
                                >
                                    Stop
                                </button>
                            )}
                            {!isVoiceActive && voiceTranscript.length > 0 && (
                                <button
                                    onClick={() => setVoiceTranscript([])}
                                    className="px-3 py-1 text-xs bg-white/10 text-white/60 rounded-lg hover:bg-white/20 transition"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="p-4 max-h-[320px] overflow-y-auto space-y-2">
                        {voiceTranscript.length === 0 && !isVoiceActive && (
                            <p className="text-white/40 text-sm text-center py-4">
                                Click &quot;Ask AI&quot; to start voice assistant
                            </p>
                        )}
                        {voiceTranscript.map((line, i) => (
                            <div
                                key={i}
                                className={`text-sm ${line.startsWith("🤖") ? "text-violet-300" :
                                    line.startsWith("🗣️") ? "text-white/90" :
                                        line.startsWith("🎙️") ? "text-green-400" :
                                            line.startsWith("👋") ? "text-yellow-400" :
                                                line.startsWith("❌") ? "text-red-400" :
                                                    "text-white/60"
                                    }`}
                            >
                                {line}
                            </div>
                        ))}
                        {isVoiceActive && (
                            <div className="flex items-center gap-2 text-violet-400 text-sm animate-pulse">
                                <Mic className="w-4 h-4" />
                                <span>Listening...</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Animation Styles */}
            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.3s ease-out;
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-slideUp {
                    animation: slideUp 0.3s ease-out;
                }
            `}</style>
        </div>
    );
}
