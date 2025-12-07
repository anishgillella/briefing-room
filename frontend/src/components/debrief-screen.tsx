"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    generateDebrief,
    DebriefResponse,
    getInterviewAnalytics,
    InterviewAnalytics,
    getBriefing,
    HighlightItem
} from "@/lib/api";
import {
    Download,
    CheckCircle2,
    AlertTriangle,
    Lightbulb,
    MessageSquare,
    Star,
    ChevronRight,
    BarChart3,
    Clock,
    User,
    FileText,
    HelpCircle
} from "lucide-react";

interface DebriefScreenProps {
    roomName: string;
    transcript?: string;
    onClose: () => void;
}

function ScoreRing({ score, label, color = "violet" }: { score: number; label: string; color?: "violet" | "emerald" | "blue" | "amber" }) {
    const getColor = (c: string) => {
        if (c === "emerald") return "#34d399";
        if (c === "blue") return "#60a5fa";
        if (c === "amber") return "#fbbf24";
        return "#a78bfa";
    };

    // Normalize score to 10
    const normalizedScore = score > 10 ? score / 10 : score;

    return (
        <div className="flex flex-col items-center">
            <div className="relative w-20 h-20 mb-2">
                <svg className="w-full h-full transform -rotate-90">
                    <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                    <circle
                        cx="40"
                        cy="40"
                        r="34"
                        fill="none"
                        stroke={getColor(color)}
                        strokeWidth="6"
                        strokeDasharray={2 * Math.PI * 34}
                        strokeDashoffset={2 * Math.PI * 34 * (1 - normalizedScore / 10)}
                        strokeLinecap="round"
                        className={`drop-shadow-[0_0_8px_${getColor(color)}40] transition-all duration-1000 ease-out`}
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-xl font-bold">
                    {normalizedScore.toFixed(1)}
                </div>
            </div>
            <span className="text-xs uppercase tracking-wider text-white/40">{label}</span>
        </div>
    );
}

// Helper to check if highlight is valid (since interface has no methods at runtime)
const isValidHighlight = (h: HighlightItem | null | undefined): boolean => {
    return !!(h && h.quote && h.quote.length > 5);
};

export default function DebriefScreen({ roomName, transcript, onClose }: DebriefScreenProps) {
    const [debrief, setDebrief] = useState<DebriefResponse | null>(null);
    const [analytics, setAnalytics] = useState<InterviewAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [candidateName, setCandidateName] = useState("Candidate");
    const [role, setRole] = useState("Position");
    const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

    // Tab state
    const [activeTab, setActiveTab] = useState("overview");

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Get candidate info
                const briefing = await getBriefing(roomName);
                if (briefing.candidate_name && briefing.candidate_name !== "the candidate") {
                    setCandidateName(briefing.candidate_name);
                }
                if (briefing.role) setRole(briefing.role);

                // 2. Generate/Fetch Debrief
                // Pass empty array for chatHistory, undefined for notes, and the transcript string
                const debriefData = await generateDebrief(roomName, [], undefined, transcript);
                setDebrief(debriefData);

                // 3. Fetch Analytics
                const analyticsData = await getInterviewAnalytics(roomName, transcript || "");
                setAnalytics(analyticsData);

            } catch (err) {
                console.error("Debrief error:", err);
                setError(err instanceof Error ? err.message : "Failed to load debrief");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [roomName, transcript]);

    const getRecColor = (rec: string) => {
        const r = rec.toLowerCase();
        if (r.includes("strong hire")) return "bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]";
        if (r.includes("hire") && !r.includes("no")) return "bg-emerald-600/80 text-white";
        if (r.includes("no hire")) return "bg-red-500/80 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]";
        return "bg-amber-500/80 text-white";
    };

    const exportMarkdown = () => {
        if (!debrief || !analytics) return;

        const content = `
# Interview Debrief: ${candidateName}
**Score:** ${analytics.overall.overall_score}/100
**Verdict:** ${analytics.overall.recommendation}

## Executive Summary
${debrief.summary}

## Strengths
${debrief.strengths.map(s => `- ${s}`).join('\n')}

## Concerns
${debrief.improvements.map(a => `- ${a}`).join('\n')}

## Recommended Next Round Questions
${debrief.follow_up_questions.map(q => `- ${q}`).join('\n')}

## Question Analysis
${analytics.qa_pairs.map(qa => `
### ${qa.question}
**Answer:** ${qa.answer}
**Metrics:** Clarity: ${qa.metrics.clarity}/10, Relevance: ${qa.metrics.relevance}/10, Depth: ${qa.metrics.depth}/10
`).join('\n')}

## Full Transcript
${transcript || "No transcript available."}
        `.trim();

        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debrief-${candidateName.replace(/\s+/g, '-').toLowerCase()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
                <div className="relative mb-8">
                    <div className="w-24 h-24 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-4xl">🧠</div>
                </div>
                <h2 className="text-2xl font-bold mb-2">Synthesizing Interview...</h2>
                <p className="text-white/40">Analyzing transcript, scoring answers, and generating verdict</p>
            </div>
        );
    }

    if (error || !debrief || !analytics) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-8">
                <div className="text-5xl mb-6">⚠️</div>
                <h2 className="text-2xl font-bold mb-2 text-red-400">Analysis Failed</h2>
                <p className="text-white/60 mb-6 max-w-md text-center">{error}</p>
                <div className="flex gap-4">
                    <Button onClick={() => window.location.reload()} variant="outline">Retry</Button>
                    <Button onClick={onClose}>Close</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/10 p-4 shrink-0">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-white/10">
                            ←
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                Review: {candidateName}
                                <Badge variant="outline" className="text-white/40 border-white/10 font-normal">
                                    {role}
                                </Badge>
                            </h1>
                        </div>
                    </div>

                    {/* Simplified Tabs in Header */}
                    <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setActiveTab("overview")}
                            className={activeTab === "overview" ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"}
                        >
                            Overview
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setActiveTab("transcript")}
                            className={activeTab === "transcript" ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"}
                        >
                            Transcript
                        </Button>
                    </div>

                    <div className="flex gap-3">
                        <Button variant="outline" className="border-white/10 hover:bg-white/5" onClick={exportMarkdown}>
                            <Download className="w-4 h-4 mr-2" /> Export
                        </Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={onClose}>
                            Done
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-6xl mx-auto p-6 space-y-6">

                    {/* OVERVIEW TAB CONTENT */}
                    {activeTab === "overview" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Hero Section: Verdict & Scores */}
                            <div className="grid md:grid-cols-12 gap-6">
                                {/* Verdict Card - 4 cols */}
                                <Card className="md:col-span-4 bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border-indigo-500/20">
                                    <CardContent className="p-6 flex flex-col items-center justify-center h-full text-center">
                                        <span className="text-xs uppercase tracking-widest text-indigo-300 mb-4">AI Recommendation</span>
                                        <Badge className={`text-lg px-6 py-2 mb-4 ${getRecColor(analytics.overall.recommendation)} border-0`}>
                                            {analytics.overall.recommendation}
                                        </Badge>
                                        <div className="flex items-center gap-2 text-sm text-indigo-200/60 w-full justify-center">
                                            <span>Confidence:</span>
                                            <span>{analytics.overall.confidence}%</span>
                                        </div>
                                        <p className="mt-4 text-xs text-white/50 italic px-4">
                                            "{analytics.overall.recommendation_reasoning.slice(0, 80)}..."
                                        </p>
                                    </CardContent>
                                </Card>

                                {/* Score Breakdown - 8 cols */}
                                <Card className="md:col-span-8 bg-white/5 border-white/10">
                                    <CardContent className="p-6 flex flex-col md:flex-row justify-around items-center h-full gap-8">
                                        <div className="text-center md:mr-8">
                                            <span className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-white to-white/50">
                                                {analytics.overall.overall_score}
                                            </span>
                                            <p className="text-xs uppercase tracking-widest text-white/40 mt-2">Overall Score</p>
                                        </div>
                                        <div className="h-px w-full md:h-16 md:w-px bg-white/10"></div>
                                        <div className="flex gap-8">
                                            <ScoreRing score={analytics.overall.communication_score} label="Communication" color="blue" />
                                            <ScoreRing score={analytics.overall.technical_score} label="Technical" color="violet" />
                                            <ScoreRing score={analytics.overall.cultural_fit_score} label="Culture Fit" color="emerald" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Executive Summary */}
                            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <Lightbulb className="w-5 h-5 text-amber-400" /> Executive Summary
                                </h2>
                                <p className="text-lg leading-relaxed text-white/90">
                                    {debrief.summary}
                                </p>
                            </div>

                            {/* NEXT ROUND QUESTIONS (NEW) */}
                            <div className="p-6 rounded-2xl bg-gradient-to-br from-violet-900/20 to-indigo-900/20 border border-violet-500/20">
                                <h2 className="text-lg font-bold text-violet-300 mb-4 flex items-center gap-2">
                                    <HelpCircle className="w-5 h-5" /> Suggested for Next Round
                                </h2>
                                <div className="grid md:grid-cols-2 gap-4">
                                    {debrief.follow_up_questions.map((q, i) => (
                                        <div key={i} className="bg-black/20 p-4 rounded-xl border border-white/5 flex gap-3">
                                            <span className="text-violet-500 font-mono text-sm">{i + 1}.</span>
                                            <p className="text-white/90 text-sm font-medium">{q}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Strengths & Red Flags Grid */}
                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Strengths */}
                                <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                                    <h2 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2">
                                        <CheckCircle2 className="w-5 h-5" /> Key Strengths
                                    </h2>
                                    <ul className="space-y-3">
                                        {debrief.strengths.map((point, i) => (
                                            <li key={i} className="flex gap-3 text-emerald-100/90">
                                                <span className="text-emerald-500 mt-1">•</span>
                                                {point}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Red Flags / Improvements */}
                                <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                                    <h2 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5" /> Areas to Probe
                                    </h2>
                                    <ul className="space-y-3">
                                        {debrief.improvements.map((point, i) => (
                                            <li key={i} className="flex gap-3 text-amber-100/90">
                                                <span className="text-amber-500 mt-1">•</span>
                                                {point}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Interview Highlights & Analytics */}
                            <div className="grid md:grid-cols-3 gap-6">
                                {/* Highlights Column */}
                                <div className="md:col-span-2 space-y-6">
                                    {/* Best Answer */}
                                    {isValidHighlight(analytics.highlights.best_answer) && (
                                        <div className="p-6 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                                <Star className="w-32 h-32" />
                                            </div>
                                            <h3 className="text-sm uppercase tracking-widest text-violet-300 mb-3 flex items-center gap-2">
                                                <Star className="w-4 h-4" /> Best Answer
                                            </h3>
                                            <blockquote className="text-xl font-medium italic text-white mb-4 relative z-10">
                                                "{analytics.highlights.best_answer.quote}"
                                            </blockquote>
                                            <p className="text-white/60 text-sm border-l-2 border-violet-500/30 pl-3">
                                                {analytics.highlights.best_answer.context}
                                            </p>
                                        </div>
                                    )}

                                    {/* Red Flag Moment */}
                                    {isValidHighlight(analytics.highlights.red_flag) && (
                                        <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/20">
                                            <h3 className="text-sm uppercase tracking-widest text-red-400 mb-3 flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4" /> Specific Concern
                                            </h3>
                                            <blockquote className="text-lg text-white/90 mb-3">
                                                "{analytics.highlights.red_flag!.quote}"
                                            </blockquote>
                                            <p className="text-white/50 text-sm">
                                                {analytics.highlights.red_flag!.context}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Metrics Sidebar */}
                                <div className="space-y-4">
                                    <Card className="bg-black/20 border-white/10">
                                        <CardContent className="p-4">
                                            <h3 className="text-xs uppercase text-white/40 mb-3 flex items-center gap-2">
                                                <Clock className="w-3 h-3" /> Pacing
                                            </h3>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center text-sm pt-2">
                                                    <span className="text-white/50">Avg Response Length</span>
                                                    <span className="font-mono">{Math.round(analytics.overall.avg_response_length)} words</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm pt-2 border-t border-white/5">
                                                    <span className="text-white/50">Total Questions</span>
                                                    <span className="font-mono">{analytics.overall.total_questions}</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="bg-black/20 border-white/10">
                                        <CardContent className="p-4">
                                            <h3 className="text-xs uppercase text-white/40 mb-2">Meta</h3>
                                            <div className="flex justify-between text-xs text-white/30">
                                                <span>Analysis Model</span>
                                                <span>Gemini 2.5 Flash</span>
                                            </div>
                                            <div className="flex justify-between text-xs text-white/30 mt-1">
                                                <span>Date</span>
                                                <span>{new Date().toLocaleDateString()}</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>

                            {/* Q&A Analysis */}
                            {analytics.qa_pairs.length > 0 && (
                                <section className="pt-6 border-t border-white/10">
                                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                                        <MessageSquare className="w-5 h-5 text-blue-400" /> Question Analysis
                                        <Badge className="bg-white/10 text-white/60 ml-2">{analytics.qa_pairs.length} Q&As</Badge>
                                    </h2>

                                    <div className="grid gap-4">
                                        {analytics.qa_pairs.map((qa, i) => (
                                            <div
                                                key={i}
                                                className={`group rounded-xl border transition-all duration-300 overflow-hidden ${expandedQuestion === i
                                                        ? "bg-white/10 border-white/20"
                                                        : "bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10"
                                                    }`}
                                            >
                                                <div
                                                    className="p-4 cursor-pointer flex justify-between items-start gap-4"
                                                    onClick={() => setExpandedQuestion(expandedQuestion === i ? null : i)}
                                                >
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <Badge variant="outline" className="border-white/20 text-white/50 text-[10px] uppercase">
                                                                {qa.question_type}
                                                            </Badge>
                                                            <div className="flex gap-1">
                                                                {[1, 2, 3].map(n => (
                                                                    <div key={n} className={`w-1.5 h-1.5 rounded-full ${n <= (qa.metrics.relevance / 3.3) ? 'bg-blue-400' : 'bg-white/10'}`} />
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <h3 className="font-medium text-white/90">{qa.question}</h3>
                                                    </div>
                                                    <ChevronRight className={`w-5 h-5 text-white/30 transition-transform ${expandedQuestion === i ? 'rotate-90' : ''}`} />
                                                </div>

                                                {/* Expanded Content */}
                                                {expandedQuestion === i && (
                                                    <div className="px-4 pb-4 border-t border-white/5 pt-4 bg-black/20">
                                                        <p className="text-white/70 italic text-sm mb-4 pl-3 border-l-2 border-white/10">
                                                            "{qa.answer.slice(0, 300)}..."
                                                        </p>

                                                        <div className="grid grid-cols-3 gap-2 mb-3">
                                                            <div className="bg-white/5 rounded p-2 text-center border border-white/5">
                                                                <span className="block text-lg font-bold text-white">{qa.metrics.clarity}/10</span>
                                                                <span className="text-[10px] text-white/40 uppercase">Clarity</span>
                                                            </div>
                                                            <div className="bg-white/5 rounded p-2 text-center border border-white/5">
                                                                <span className="block text-lg font-bold text-white">{qa.metrics.relevance}/10</span>
                                                                <span className="text-[10px] text-white/40 uppercase">Relevance</span>
                                                            </div>
                                                            <div className="bg-white/5 rounded p-2 text-center border border-white/5">
                                                                <span className="block text-lg font-bold text-white">{qa.metrics.depth}/10</span>
                                                                <span className="text-[10px] text-white/40 uppercase">Depth</span>
                                                            </div>
                                                        </div>

                                                        <div className="bg-blue-500/10 rounded-lg p-3 text-sm text-blue-200 border border-blue-500/20">
                                                            <span className="font-bold mr-2">💡 Analysis:</span>
                                                            {qa.highlight || "No specific highlight for this answer."}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>
                    )}

                    {/* TRANSCRIPT TAB CONTENT */}
                    {activeTab === "transcript" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                                <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-violet-400" /> Full Transcript
                                </h2>

                                {transcript ? (
                                    <div className="space-y-4 font-mono text-sm leading-relaxed text-white/80">
                                        {transcript.split('\n').filter(line => line.trim()).map((line, i) => {
                                            const isInterviewer = line.toLowerCase().startsWith('interviewer') || line.toLowerCase().startsWith('user');
                                            return (
                                                <div key={i} className={`p-3 rounded-lg ${isInterviewer ? 'bg-white/10 ml-8' : 'bg-black/20 mr-8 border border-white/5'}`}>
                                                    <span className={`block text-xs uppercase tracking-wider mb-1 ${isInterviewer ? 'text-violet-300' : 'text-emerald-300'}`}>
                                                        {isInterviewer ? 'Interviewer' : 'Candidate'}
                                                    </span>
                                                    {line.replace(/^(interviewer|candidate|user|assistant):/i, '').trim()}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-white/40 italic">
                                        No transcript was recorded for this session.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="h-12 text-center text-white/20 text-xs">
                        Analysis generated by Superposition AI • {roomName}
                    </div>
                </div>
            </div>
        </div>
    );
}
