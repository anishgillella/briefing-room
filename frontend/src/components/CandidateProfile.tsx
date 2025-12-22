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
    Clock,
    PlayCircle,
    Loader2,
    Building2,
    GraduationCap,
    Mail,
    Pencil,
    Check,
    X
} from "lucide-react";

interface CandidateProfileProps {
    candidate: Candidate;
    prebrief: PreBrief | null;
    loadingPrebrief?: boolean;
    isModal?: boolean;
    onStartInterview?: () => void;
    startingInterview?: boolean;
    onUpdateEmail?: (email: string) => void;
}

export default function CandidateProfile({
    candidate,
    prebrief,
    isModal = false,
    onStartInterview,
    startingInterview = false,
    onUpdateEmail,
}: CandidateProfileProps) {
    const [activeTab, setActiveTab] = useState<"overview" | "analysis" | "interview">("overview");
    const [isEditingEmail, setIsEditingEmail] = useState(false);
    const [emailInput, setEmailInput] = useState(candidate.email || "");

    const handleSaveEmail = () => {
        if (emailInput.trim() && onUpdateEmail) {
            onUpdateEmail(emailInput.trim());
        }
        setIsEditingEmail(false);
    };

    const handleCancelEmail = () => {
        setEmailInput(candidate.email || "");
        setIsEditingEmail(false);
    };

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
            <div className={`${isModal ? "p-8" : "max-w-7xl mx-auto px-6 py-12"}`}>

                {/* -------------------- HEADER / HERO -------------------- */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-12">

                    {/* Hero Card (Span 8) */}
                    <div className="md:col-span-8 glass-card-premium p-10 relative overflow-hidden group animate-fade-up">
                        {/* Subtle Background Glow */}
                        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-purple-500/10 via-blue-500/5 to-transparent blur-[120px] opacity-60 pointer-events-none"></div>

                        <div className="relative z-10 flex flex-col h-full justify-between gap-8">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h1 className="text-6xl font-semibold tracking-tighter text-white mb-3 drop-shadow-2xl">
                                        {candidate.name}
                                    </h1>
                                    <div className="flex items-center gap-6 text-xl text-white/50 font-light tracking-wide">
                                        {candidate.job_title && (
                                            <span className="flex items-center gap-2">
                                                <Briefcase className="w-5 h-5 opacity-70" />
                                                {candidate.job_title}
                                            </span>
                                        )}
                                        {candidate.current_company && (
                                            <>
                                                <span className="w-1.5 h-1.5 rounded-full bg-white/20"></span>
                                                <span className="flex items-center gap-2">
                                                    <Building2 className="w-5 h-5 opacity-70" />
                                                    {candidate.current_company}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                    {/* Email Section */}
                                    <div className="mt-4 flex items-center gap-3">
                                        <Mail className="w-5 h-5 text-white/40" />
                                        {isEditingEmail ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="email"
                                                    value={emailInput}
                                                    onChange={(e) => setEmailInput(e.target.value)}
                                                    placeholder="Enter email address"
                                                    className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/30 w-64"
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") handleSaveEmail();
                                                        if (e.key === "Escape") handleCancelEmail();
                                                    }}
                                                />
                                                <button
                                                    onClick={handleSaveEmail}
                                                    className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition-colors"
                                                    title="Save"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={handleCancelEmail}
                                                    className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                                                    title="Cancel"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : candidate.email ? (
                                            <div className="flex items-center gap-2 group">
                                                <a
                                                    href={`mailto:${candidate.email}`}
                                                    className="text-white/60 hover:text-white/90 text-sm transition-colors"
                                                >
                                                    {candidate.email}
                                                </a>
                                                {onUpdateEmail && (
                                                    <button
                                                        onClick={() => setIsEditingEmail(true)}
                                                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 text-white/40 hover:text-white/70 transition-all"
                                                        title="Edit email"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setIsEditingEmail(true)}
                                                className="px-4 py-2 bg-white/5 border border-dashed border-white/20 rounded-xl text-white/40 hover:text-white/70 hover:border-white/40 text-sm transition-all flex items-center gap-2"
                                            >
                                                <span>Add email address</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className={`px-5 py-2 rounded-full text-sm font-bold tracking-widest uppercase border ${getTierBg(candidate.tier)} ${getTierColor(candidate.tier)} shadow-lg backdrop-blur-md animate-scale-in delay-200`}>
                                    {candidate.tier || "Unknown"}
                                </div>
                            </div>

                            <div className="p-8 bg-black/20 rounded-3xl border border-white/5 backdrop-blur-md shadow-inner">
                                <p className="text-xl leading-relaxed text-white/90 font-light font-sans antialiased">
                                    "{prebrief?.tldr || candidate.one_line_summary || candidate.bio_summary}"
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Scores Widget (Span 4) */}
                    <div className="md:col-span-4 grid grid-rows-3 gap-5">
                        {[
                            { label: "Overall Match", value: candidate.combined_score, icon: Target, color: getScoreColor(candidate.combined_score) },
                            { label: "AI Analysis", value: candidate.ai_score, icon: Sparkles, color: "text-purple-400" },
                            { label: "Algo Match", value: candidate.algo_score, icon: Zap, color: "text-blue-400" },
                        ].map((score, i) => (
                            <div key={i} className="glass-card-premium px-8 py-0 flex items-center justify-between group transition-all duration-500 hover:bg-white/5 animate-fade-up cursor-default" style={{ animationDelay: `${(i + 2) * 100}ms` }}>
                                <div className="flex items-center gap-5">
                                    <div className={`w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center ${score.color} group-hover:scale-110 transition-transform duration-500 shadow-lg`}>
                                        <score.icon className="w-7 h-7" />
                                    </div>
                                    <span className="text-white/50 text-sm font-semibold uppercase tracking-widest">{score.label}</span>
                                </div>

                                <div className="relative flex items-center justify-center">
                                    {/* Conic Gradient Ring */}
                                    <div className="score-ring scale-110" style={getScoreCSS(score.value || 0, score.color)}></div>
                                    <span className={`absolute text-2xl font-bold tracking-tighter ${score.color}`}>
                                        {score.value ?? "—"}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* -------------------- SEGMENTED CONTROL TABS -------------------- */}
                <div className="flex justify-center mb-16 animate-fade-up delay-300">
                    <div className="bg-black/40 p-1.5 rounded-full inline-flex relative backdrop-blur-xl border border-white/10 shadow-2xl">
                        {[{ id: "overview", label: "Overview" }, { id: "analysis", label: "Deep Analysis" }, { id: "interview", label: "Interview Prep" }].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as "overview" | "analysis" | "interview")}
                                className={`relative z-10 px-10 py-3 rounded-full text-sm font-bold transition-all duration-500 tracking-wide ${activeTab === tab.id
                                    ? "text-white"
                                    : "text-white/40 hover:text-white/80"
                                    }`}
                            >
                                {activeTab === tab.id && (
                                    <div className="absolute inset-0 bg-white/10 rounded-full border border-white/10 shadow-lg backdrop-blur-md -z-10 animate-scale-in"></div>
                                )}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* -------------------- CONTENT AREA -------------------- */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-20 animate-fade-up delay-400">

                    {/* LEFT COLUMN (Details) - Span 8 */}
                    <div className="md:col-span-8 space-y-8">
                        {activeTab === "overview" && (
                            <>
                                {/* Experience & Stats Grid */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 animate-fade-up delay-500">
                                    {[
                                        { label: "Experience", value: `${candidate.years_experience || 0}y`, icon: Clock },
                                        { label: "Location", value: candidate.location_city || "Remote", icon: MapPin },
                                        { label: "Finance Sale", value: candidate.sold_to_finance_accounting_leaders ? "Yes" : "No", icon: Building2 },
                                        { label: "Founder", value: candidate.is_founder ? "Yes" : "No", icon: GraduationCap },
                                    ].map((stat, i) => (
                                        <div key={i} className="glass-card-premium p-6 text-center hover:-translate-y-1 transition-transform duration-500 border-white/5 bg-white/[0.02]">
                                            <stat.icon className="w-6 h-6 mx-auto mb-4 text-white/30" />
                                            <div className="text-3xl font-light text-white tracking-tight mb-2">{stat.value}</div>
                                            <div className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold">{stat.label}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Styles/Skills Section */}
                                <div className="glass-card-premium p-10 animate-fade-up delay-600">
                                    <h2 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-8">Core Competencies</h2>
                                    <div className="flex flex-wrap gap-3">
                                        {candidate.skills?.map((skill, i) => (
                                            <span key={i} className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/5 text-white/80 text-sm font-medium hover:bg-white/10 hover:border-white/20 transition-all cursor-default hover:scale-105 duration-300">
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Bio */}
                                <div className="glass-card-premium p-10 animate-fade-up delay-700">
                                    <h2 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-6">About Candidate</h2>
                                    <p className="text-white/70 leading-relaxed text-lg font-light text-justify">
                                        {candidate.bio_summary || "No bio available."}
                                    </p>
                                </div>
                            </>
                        )}

                        {activeTab === "analysis" && (
                            <div className="space-y-8">
                                {/* Reasoning Card */}
                                <div className="glass-card-premium p-10 relative overflow-hidden animate-fade-up delay-500">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none"></div>
                                    <h2 className="text-2xl font-semibold mb-8 flex items-center gap-4 text-white tracking-tight">
                                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                            <Sparkles className="w-5 h-5 text-purple-400" />
                                        </div>
                                        AI Reasoning Engine
                                    </h2>
                                    <p className="text-white/90 leading-relaxed font-light text-xl border-l-2 border-purple-500/30 pl-8">
                                        {candidate.reasoning}
                                    </p>
                                </div>

                                {/* Strengths & Weaknesses Split */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-up delay-600">
                                    <div className="glass-card-premium p-8 bg-emerald-950/10 border-emerald-500/10 hover:bg-emerald-950/20 transition-colors">
                                        <h3 className="text-emerald-400 font-semibold mb-8 flex items-center gap-3 text-lg tracking-wide uppercase">
                                            <ThumbsUp className="w-5 h-5" /> Key Strengths
                                        </h3>
                                        <ul className="space-y-5">
                                            {candidate.pros?.map((pro, i) => (
                                                <li key={i} className="flex items-start gap-4 group">
                                                    <div className="mt-1 w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                                                        <CheckCircle className="w-3 h-3 text-emerald-500" />
                                                    </div>
                                                    <span className="text-white/70 font-light group-hover:text-white transition-colors">{pro}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="glass-card-premium p-8 bg-rose-950/10 border-rose-500/10 hover:bg-rose-950/20 transition-colors">
                                        <h3 className="text-rose-400 font-semibold mb-8 flex items-center gap-3 text-lg tracking-wide uppercase">
                                            <ThumbsDown className="w-5 h-5" /> Potential Concerns
                                        </h3>
                                        <ul className="space-y-5">
                                            {candidate.cons?.map((con, i) => (
                                                <li key={i} className="flex items-start gap-4 group">
                                                    <div className="mt-1 w-5 h-5 rounded-full bg-rose-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-rose-500/20 transition-colors">
                                                        <AlertTriangle className="w-3 h-3 text-rose-500" />
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
                            <div className="space-y-8 animate-fade-up delay-500">
                                {/* Questions */}
                                <div className="glass-card-premium p-10">
                                    <h2 className="text-xl font-semibold mb-10 text-white flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                            <MessageSquare className="w-5 h-5 text-blue-400" />
                                        </div>
                                        Suggested Interview Questions
                                    </h2>
                                    <div className="space-y-5">
                                        {candidate.interview_questions?.map((q, i) => (
                                            <div key={i} className="p-8 bg-white/[0.02] rounded-3xl border border-white/5 hover:bg-white/[0.05] transition-all group duration-300 hover:-translate-x-[-8px]">
                                                <div className="flex gap-8">
                                                    <span className="text-5xl font-bold text-white/[0.03] group-hover:text-white/10 transition-colors select-none font-mono">0{i + 1}</span>
                                                    <p className="text-xl text-white/90 mt-2 font-light">{q}</p>
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
                                        className="w-full py-8 bg-white text-black rounded-[2rem] font-bold text-2xl transition-all hover:scale-[1.01] hover:shadow-[0_0_50px_rgba(255,255,255,0.3)] flex items-center justify-center gap-4 relative overflow-hidden group active:scale-95"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 skew-x-12 z-0"></div>
                                        <div className="relative z-10 flex items-center gap-4">
                                            {startingInterview ? <Loader2 className="w-8 h-8 animate-spin" /> : <PlayCircle className="w-8 h-8 fill-black text-white" />}
                                            Start AI Interview Session
                                        </div>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN (Widgets) - Span 4 */}
                    <div className="md:col-span-4 space-y-6">

                        {/* Red Flags Widget */}
                        {candidate.red_flags && candidate.red_flags.length > 0 && (
                            <div className="glass-card-premium p-8 bg-red-500/5 animate-fade-up delay-500 border-red-500/20">
                                <h3 className="text-red-400 font-bold text-xs uppercase mb-6 flex items-center gap-2 tracking-[0.2em]">
                                    <Shield className="w-4 h-4" /> Priority Alerts
                                </h3>
                                <div className="space-y-4">
                                    {candidate.red_flags.map((flag, i) => (
                                        <div key={i} className="p-4 bg-red-950/40 rounded-2xl text-sm text-red-200 border border-red-500/10 flex items-start gap-4 leading-relaxed">
                                            <XCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                                            {flag}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Quota History Widget */}
                        {candidate.quota_attainment_history && (
                            <div className="glass-card-premium p-8 animate-fade-up delay-600">
                                <h3 className="text-emerald-400 font-bold text-xs uppercase mb-6 flex items-center gap-2 tracking-[0.2em]">
                                    <TrendingUp className="w-4 h-4" /> Quota History
                                </h3>
                                <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
                                    <p className="text-white/80 text-sm leading-relaxed font-mono">
                                        {candidate.quota_attainment_history}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Industries Widget */}
                        <div className="glass-card-premium p-8 animate-fade-up delay-700">
                            <h3 className="text-indigo-400 font-bold text-xs uppercase mb-6 flex items-center gap-2 tracking-[0.2em]">
                                <Building2 className="w-4 h-4" /> Target Industries
                            </h3>
                            <div className="flex flex-wrap gap-2.5">
                                {candidate.industries?.map((ind, i) => (
                                    <span key={i} className="px-4 py-2 bg-indigo-500/10 text-indigo-200 rounded-xl text-[11px] font-bold border border-indigo-500/20 uppercase tracking-wider hover:bg-indigo-500/20 transition-colors">
                                        {ind}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Prebrief Highlights (if available) */}
                        {prebrief?.key_things_to_remember && (
                            <div className="glass-card-premium p-8 bg-gradient-to-b from-purple-500/5 to-transparent border-purple-500/20 animate-fade-up delay-800">
                                <h3 className="text-purple-300 font-bold text-xs uppercase mb-6 flex items-center gap-2 tracking-[0.2em]">
                                    <Lightbulb className="w-4 h-4" /> AI Critical Insights
                                </h3>
                                <ul className="space-y-4">
                                    {prebrief.key_things_to_remember.map((item, i) => (
                                        <li key={i} className="text-sm text-purple-100/70 pl-4 border-l-2 border-purple-500/30 leading-relaxed">
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
