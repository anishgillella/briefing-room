import { useState } from "react";
import { Candidate, PreBrief } from "@/types";
import {
    Briefcase,
    MapPin,
    Target,
    Zap,
    Sparkles,
    TrendingUp,
    CheckCircle,
    XCircle,
    Shield,
    ThumbsUp,
    ThumbsDown,
    AlertTriangle,
    MessageSquare,
    Lightbulb,
    ChevronUp,
    ChevronDown,
    Clock,
    PlayCircle,
    Loader2,
    Building2,
    GraduationCap,
    Award
} from "lucide-react";

interface CandidateProfileProps {
    candidate: Candidate;
    prebrief: PreBrief | null;
    loadingPrebrief?: boolean;
    isModal?: boolean;
    onStartInterview?: () => void;
    startingInterview?: boolean;
}

export default function CandidateProfile({
    candidate,
    prebrief,
    loadingPrebrief = false,
    isModal = false,
    onStartInterview,
    startingInterview = false,
}: CandidateProfileProps) {
    const [activeTab, setActiveTab] = useState<"overview" | "analysis" | "interview">("overview");

    // Helper for Tier Colors (Apple Watch Activity Ring style colors)
    const getTierColor = (tier?: string) => {
        switch (tier) {
            case "Top Tier": return "text-[#FFD60A]"; // Yellow
            case "Strong": return "text-[#30D158]";   // Green
            case "Good": return "text-[#0A84FF]";     // Blue
            case "Evaluate": return "text-[#BF5AF2]"; // Purple
            default: return "text-[#8E8E93]";         // Grey
        }
    };

    const getTierBg = (tier?: string) => {
        switch (tier) {
            case "Top Tier": return "bg-[#FFD60A]/10 border-[#FFD60A]/20";
            case "Strong": return "bg-[#30D158]/10 border-[#30D158]/20";
            case "Good": return "bg-[#0A84FF]/10 border-[#0A84FF]/20";
            case "Evaluate": return "bg-[#BF5AF2]/10 border-[#BF5AF2]/20";
            default: return "bg-[#8E8E93]/10 border-[#8E8E93]/20";
        }
    };

    const getScoreColor = (score?: number) => {
        if (!score) return "text-gray-500";
        if (score >= 80) return "text-[#30D158]"; // Green
        if (score >= 60) return "text-[#FFD60A]"; // Yellow
        return "text-[#FF453A]";                   // Red
    };

    const getScoreCSS = (score: number, color: string) => {
        // Map tailwind text colors to hex for the gradient
        const hexMap: Record<string, string> = {
            "text-[#30D158]": "#30D158",
            "text-[#FFD60A]": "#FFD60A",
            "text-[#FF453A]": "#FF453A",
            "text-purple-400": "#c084fc", // approximation
            "text-blue-400": "#60a5fa",   // approximation
        };
        const hex = hexMap[color] || "#FFFFFF";
        return { "--score": `${score}%`, "--primary": hex } as React.CSSProperties;
    };

    return (
        <div className={`text-white font-sans ${isModal ? "" : "min-h-screen"} animate-fade-in`}>
            {/* Main Wrapper */}
            <div className={`${isModal ? "p-6" : "max-w-7xl mx-auto px-6 py-8"}`}>

                {/* -------------------- BENTO GRID HEADER -------------------- */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">

                    {/* Hero Card (Span 8) */}
                    <div className="md:col-span-8 glass-card-premium p-8 relative overflow-hidden group animate-fade-up">
                        {/* Background Animated Gradient */}
                        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-purple-500/20 via-blue-500/10 to-transparent blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-1000 animate-pulse"></div>

                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div className="flex items-start justify-between mb-6">
                                <div>
                                    <h1 className="text-5xl font-semibold tracking-tight text-white mb-2 drop-shadow-lg">{candidate.name}</h1>
                                    <div className="flex items-center gap-3 text-lg text-white/60 font-light tracking-wide">
                                        {candidate.job_title && (
                                            <span className="flex items-center gap-2">
                                                <Briefcase className="w-4 h-4" />
                                                {candidate.job_title}
                                            </span>
                                        )}
                                        {candidate.current_company && (
                                            <>
                                                <span className="w-1 h-1 rounded-full bg-white/20"></span>
                                                <span className="flex items-center gap-2">
                                                    <Building2 className="w-4 h-4" />
                                                    {candidate.current_company}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className={`px-4 py-1.5 rounded-full border text-xs font-bold tracking-widest uppercase ${getTierBg(candidate.tier)} ${getTierColor(candidate.tier)} shadow-lg backdrop-blur-md animate-scale-in delay-200`}>
                                    {candidate.tier || "Unknown"}
                                </div>
                            </div>

                            <div className="p-6 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-md shadow-inner animate-fade-up delay-100">
                                <p className="text-lg leading-relaxed text-white/80 font-light">
                                    {prebrief?.tldr || candidate.one_line_summary || candidate.bio_summary}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Scores Widget (Span 4) */}
                    <div className="md:col-span-4 grid grid-rows-3 gap-4">
                        {[
                            { label: "Overall Score", value: candidate.combined_score, icon: Target, color: getScoreColor(candidate.combined_score) },
                            { label: "AI Analysis", value: candidate.ai_score, icon: Sparkles, color: "text-purple-400" },
                            { label: "Algo Match", value: candidate.algo_score, icon: Zap, color: "text-blue-400" },
                        ].map((score, i) => (
                            <div key={i} className={`glass-card-premium p-5 flex items-center justify-between group transition-all duration-500 hover:bg-white/5 animate-fade-up`} style={{ animationDelay: `${(i + 2) * 100}ms` }}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full bg-white/5 flex items-center justify-center ${score.color} group-hover:scale-110 transition-transform duration-500`}>
                                        <score.icon className="w-6 h-6" />
                                    </div>
                                    <span className="text-white/60 font-medium tracking-wide">{score.label}</span>
                                </div>

                                <div className="relative flex items-center justify-center">
                                    {/* Conic Gradient Ring */}
                                    <div className="score-ring" style={getScoreCSS(score.value || 0, score.color)}></div>
                                    <span className={`absolute text-xl font-bold tracking-tight ${score.color}`}>
                                        {score.value ?? "—"}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* -------------------- SEGMENTED CONTROL TABS -------------------- */}
                <div className="flex justify-center mb-10 animate-fade-up delay-300">
                    <div className="glass-card-premium p-1.5 rounded-full inline-flex relative">
                        {[{ id: "overview", label: "Overview" }, { id: "analysis", label: "Deep Analysis" }, { id: "interview", label: "Interview Prep" }].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`relative z-10 px-8 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${activeTab === tab.id
                                    ? "text-white text-shadow-sm"
                                    : "text-white/40 hover:text-white/80"
                                    }`}
                            >
                                {activeTab === tab.id && (
                                    <div className="absolute inset-0 bg-white/10 rounded-full border border-white/10 shadow-sm backdrop-blur-md -z-10 animate-scale-in"></div>
                                )}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* -------------------- CONTENT AREA -------------------- */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pb-20 animate-fade-up delay-400">

                    {/* LEFT COLUMN (Details) - Span 8 */}
                    <div className="md:col-span-8 space-y-6">
                        {activeTab === "overview" && (
                            <>
                                {/* Experience & Stats Grid */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up delay-500">
                                    {[
                                        { label: "Experience", value: `${candidate.years_experience || 0}y`, icon: Clock },
                                        { label: "Location", value: candidate.location_city || "Remote", icon: MapPin },
                                        { label: "Finance Sale", value: candidate.sold_to_finance_accounting_leaders ? "Yes" : "No", icon: Building2 },
                                        { label: "Founder", value: candidate.is_founder ? "Yes" : "No", icon: GraduationCap },
                                    ].map((stat, i) => (
                                        <div key={i} className="glass-card-premium p-6 text-center hover:scale-105 transition-transform duration-300">
                                            <stat.icon className="w-6 h-6 mx-auto mb-3 text-white/40" />
                                            <div className="text-2xl font-bold text-white tracking-tight">{stat.value}</div>
                                            <div className="text-[10px] text-white/40 uppercase tracking-widest mt-2 font-semibold">{stat.label}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Bio */}
                                <div className="glass-card-premium p-8 animate-fade-up delay-600">
                                    <h2 className="text-xl font-semibold mb-6 text-white tracking-tight">About</h2>
                                    <p className="text-white/70 leading-relaxed text-lg font-light">
                                        {candidate.bio_summary || "No bio available."}
                                    </p>
                                </div>

                                {/* Skills */}
                                <div className="glass-card-premium p-8 animate-fade-up delay-700">
                                    <h2 className="text-xl font-semibold mb-6 text-white tracking-tight">Skills & Expertise</h2>
                                    <div className="flex flex-wrap gap-2">
                                        {candidate.skills?.map((skill, i) => (
                                            <span key={i} className="px-4 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 text-sm font-medium hover:bg-white/10 hover:text-white transition-colors cursor-default">
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {activeTab === "analysis" && (
                            <div className="space-y-6">
                                {/* Reasoning Card */}
                                <div className="glass-card-premium p-8 relative overflow-hidden animate-fade-up delay-500">
                                    <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 blur-3xl rounded-full"></div>
                                    <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3 text-white tracking-tight">
                                        <Sparkles className="w-6 h-6 text-purple-400" />
                                        AI Reasoning
                                    </h2>
                                    <p className="text-white/80 leading-relaxed font-light text-lg">
                                        {candidate.reasoning}
                                    </p>
                                </div>

                                {/* Strengths & Weaknesses Split */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-up delay-600">
                                    <div className="glass-card-premium p-8 bg-emerald-900/5 hover:bg-emerald-900/10 transition-colors">
                                        <h3 className="text-emerald-400 font-semibold mb-6 flex items-center gap-3 text-lg tracking-wide">
                                            <ThumbsUp className="w-5 h-5" /> Strengths
                                        </h3>
                                        <ul className="space-y-4">
                                            {candidate.pros?.map((pro, i) => (
                                                <li key={i} className="flex items-start gap-4 group">
                                                    <div className="mt-1 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500/30 transition-colors">
                                                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                                                    </div>
                                                    <span className="text-white/70 font-light group-hover:text-white transition-colors">{pro}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="glass-card-premium p-8 bg-rose-900/5 hover:bg-rose-900/10 transition-colors">
                                        <h3 className="text-rose-400 font-semibold mb-6 flex items-center gap-3 text-lg tracking-wide">
                                            <ThumbsDown className="w-5 h-5" /> Concerns
                                        </h3>
                                        <ul className="space-y-4">
                                            {candidate.cons?.map((con, i) => (
                                                <li key={i} className="flex items-start gap-4 group">
                                                    <div className="mt-1 w-5 h-5 rounded-full bg-rose-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-rose-500/30 transition-colors">
                                                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                                                    </div>
                                                    <span className="text-white/70 font-light group-hover:text-white transition-colors">{con}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "interview" && (
                            <div className="space-y-6 animate-fade-up delay-500">
                                {/* Questions */}
                                <div className="glass-card-premium p-8">
                                    <h2 className="text-xl font-semibold mb-8 text-white flex items-center gap-2">
                                        <MessageSquare className="w-5 h-5 text-blue-400" />
                                        Suggested Questions
                                    </h2>
                                    <div className="space-y-4">
                                        {candidate.interview_questions?.map((q, i) => (
                                            <div key={i} className="p-6 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors group">
                                                <div className="flex gap-6">
                                                    <span className="text-4xl font-bold text-white/5 group-hover:text-white/10 transition-colors select-none">0{i + 1}</span>
                                                    <p className="text-lg text-white/80 mt-2 font-light">{q}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* CTAs */}
                                {!isModal && onStartInterview && (
                                    <button
                                        onClick={onStartInterview}
                                        disabled={startingInterview}
                                        className="w-full py-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-3xl font-semibold text-xl transition-all shadow-[0_10px_40px_-10px_rgba(79,70,229,0.5)] hover:shadow-[0_20px_60px_-10px_rgba(79,70,229,0.6)] hover:translate-y-[-2px] flex items-center justify-center gap-3 relative overflow-hidden group"
                                    >
                                        <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 skew-x-12"></div>
                                        {startingInterview ? <Loader2 className="w-6 h-6 animate-spin" /> : <PlayCircle className="w-6 h-6" />}
                                        Start AI Interview Session
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN (Widgets) - Span 4 */}
                    <div className="md:col-span-4 space-y-6">

                        {/* Red Flags Widget */}
                        {candidate.red_flags && candidate.red_flags.length > 0 && (
                            <div className="glass-card-premium p-6 bg-red-500/5 animate-fade-up delay-500 border-red-500/20">
                                <h3 className="text-red-400 font-semibold mb-4 flex items-center gap-2 tracking-wide">
                                    <Shield className="w-5 h-5" /> Priority Alerts
                                </h3>
                                <div className="space-y-3">
                                    {candidate.red_flags.map((flag, i) => (
                                        <div key={i} className="p-4 bg-red-950/30 rounded-xl text-sm text-red-200 border border-red-500/10 flex items-start gap-3">
                                            <XCircle className="w-4 h-4 text-red-400 mt-0.5" />
                                            {flag}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Quota History Widget */}
                        {candidate.quota_attainment_history && (
                            <div className="glass-card-premium p-6 animate-fade-up delay-600">
                                <h3 className="text-emerald-400 font-semibold mb-4 flex items-center gap-2 tracking-wide">
                                    <TrendingUp className="w-5 h-5" /> Quota History
                                </h3>
                                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                                    <p className="text-white/70 text-sm leading-relaxed font-mono">
                                        {candidate.quota_attainment_history}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Industries Widget */}
                        <div className="glass-card-premium p-6 animate-fade-up delay-700">
                            <h3 className="text-white font-semibold mb-4 flex items-center gap-2 tracking-wide">
                                <Building2 className="w-5 h-5 text-indigo-400" /> Target Industries
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {candidate.industries?.map((ind, i) => (
                                    <span key={i} className="px-3 py-1.5 bg-indigo-500/10 text-indigo-200 rounded-lg text-xs font-semibold border border-indigo-500/20 uppercase tracking-wider">
                                        {ind}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Prebrief Highlights (if available) */}
                        {prebrief?.key_things_to_remember && (
                            <div className="glass-card-premium p-6 bg-gradient-to-b from-purple-500/5 to-transparent border-purple-500/20 animate-fade-up delay-800">
                                <h3 className="text-purple-300 font-semibold mb-4 flex items-center gap-2 tracking-wide">
                                    <Lightbulb className="w-5 h-5" /> AI Insights
                                </h3>
                                <ul className="space-y-3">
                                    {prebrief.key_things_to_remember.map((item, i) => (
                                        <li key={i} className="text-sm text-purple-200/80 pl-3 border-l-2 border-purple-500/30">
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}
