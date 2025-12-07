"use client";

import { useState } from "react";
import { PreInterviewBrief } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, AlertTriangle, CheckCircle2, Briefcase, ChevronRight, Star, HelpCircle, Lightbulb } from "lucide-react";

interface PreInterviewBriefProps {
    brief: PreInterviewBrief;
    onActivateVoice?: () => void;
    isVoiceActive?: boolean;
    onClose?: () => void;
    isOverlay?: boolean;
}

// Custom Radar Chart for 6 dimensions
function RadarChart({ scores }: { scores: number[] }) {
    const labels = ["Tech", "Exp", "Lead", "Comm", "Cult", "Grow"];

    const points = scores.map((score, i) => {
        const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
        const radius = (score / 100) * 80;
        const x = 100 + radius * Math.cos(angle);
        const y = 100 + radius * Math.sin(angle);
        return `${x},${y}`;
    }).join(" ");

    const labelPoints = labels.map((label, i) => {
        const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
        const radius = 110;
        const x = 100 + radius * Math.cos(angle);
        const y = 100 + radius * Math.sin(angle);
        return { x, y, label, score: scores[i] };
    });

    return (
        <div className="relative w-full aspect-square max-w-[250px] mx-auto">
            <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
                {/* Background Grid */}
                {[20, 40, 60, 80].map((r) => (
                    <polygon
                        key={r}
                        points={Array.from({ length: 6 }).map((_, i) => {
                            const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                            const x = 100 + r * Math.cos(angle);
                            const y = 100 + r * Math.sin(angle);
                            return `${x},${y}`;
                        }).join(" ")}
                        fill="none"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="1"
                    />
                ))}

                {/* Axis Lines */}
                {Array.from({ length: 6 }).map((_, i) => {
                    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                    const x = 100 + 80 * Math.cos(angle);
                    const y = 100 + 80 * Math.sin(angle);
                    return <line key={i} x1="100" y1="100" x2={x} y2={y} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />;
                })}

                {/* Data Polygon */}
                <polygon
                    points={points}
                    fill="rgba(139, 92, 246, 0.3)"
                    stroke="rgba(139, 92, 246, 0.8)"
                    strokeWidth="2"
                    className="drop-shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                />

                {/* Score Dots */}
                {scores.map((score, i) => {
                    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                    const radius = (score / 100) * 80;
                    const x = 100 + radius * Math.cos(angle);
                    const y = 100 + radius * Math.sin(angle);
                    return <circle key={i} cx={x} cy={y} r="4" fill="#a78bfa" stroke="#fff" strokeWidth="1" />;
                })}
            </svg>

            {/* Labels with scores */}
            {labelPoints.map((p, i) => (
                <div
                    key={i}
                    className="absolute text-center"
                    style={{
                        left: `${(p.x / 200) * 100}%`,
                        top: `${(p.y / 200) * 100}%`,
                        transform: "translate(-50%, -50%)"
                    }}
                >
                    <span className="text-[10px] font-bold text-white/80 block">{p.score}</span>
                    <span className="text-[9px] text-white/40 uppercase tracking-wider">{p.label}</span>
                </div>
            ))}
        </div>
    );
}

export default function PreInterviewBriefComponent({ brief, onActivateVoice, isVoiceActive, onClose, isOverlay }: PreInterviewBriefProps) {
    const scores = [
        brief.score_breakdown.technical_skills,
        brief.score_breakdown.experience_relevance,
        brief.score_breakdown.leadership_potential,
        brief.score_breakdown.communication_signals,
        brief.score_breakdown.culture_fit_signals,
        brief.score_breakdown.growth_trajectory
    ];

    return (
        <div className={`h-full flex flex-col bg-slate-950 text-white font-sans overflow-hidden ${isOverlay ? 'rounded-2xl shadow-2xl border border-white/10' : ''}`}>
            {/* Fixed Header */}
            <div className="shrink-0 p-6 border-b border-white/10 bg-slate-900/80 backdrop-blur-xl">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-3xl font-bold">{brief.candidate_name}</h1>
                            <Badge variant="outline" className="border-violet-500/50 text-violet-300 bg-violet-500/10">
                                {brief.years_experience} yrs exp
                            </Badge>
                        </div>
                        <p className="text-white/50 text-lg">{brief.current_role}</p>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Fit Score */}
                        <div className="flex flex-col items-center">
                            <div className="relative w-20 h-20">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                                    <circle
                                        cx="40"
                                        cy="40"
                                        r="34"
                                        fill="none"
                                        stroke={brief.overall_fit_score >= 80 ? "#34d399" : brief.overall_fit_score >= 60 ? "#60a5fa" : "#fbbf24"}
                                        strokeWidth="6"
                                        strokeDasharray={2 * Math.PI * 34}
                                        strokeDashoffset={2 * Math.PI * 34 * (1 - brief.overall_fit_score / 100)}
                                        strokeLinecap="round"
                                        className="drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                                    />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold">{brief.overall_fit_score}</span>
                            </div>
                            <span className="text-[10px] uppercase tracking-widest text-white/40 mt-1">Fit Score</span>
                        </div>

                        {/* Voice Button */}
                        {onActivateVoice && (
                            <Button
                                onClick={onActivateVoice}
                                size="lg"
                                className={`px-6 ${isVoiceActive ?
                                    "bg-red-500 hover:bg-red-600 animate-pulse" :
                                    "bg-violet-600 hover:bg-violet-700"
                                    }`}
                            >
                                {isVoiceActive ? <MicOff className="w-5 h-5 mr-2" /> : <Mic className="w-5 h-5 mr-2" />}
                                {isVoiceActive ? "Stop AI" : "Ask AI"}
                            </Button>
                        )}

                        {/* Close Button for Overlay */}
                        {onClose && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onClose}
                                className="rounded-full hover:bg-white/10"
                            >
                                <span className="text-2xl">×</span>
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Scrollable Content - Single Page */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto p-6 space-y-8">

                    {/* TL;DR - Always First */}
                    <section className="p-5 rounded-2xl bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20">
                        <p className="text-lg leading-relaxed">
                            <span className="text-violet-400 font-bold">TL;DR → </span>
                            {brief.tldr}
                        </p>
                    </section>

                    {/* Key Things to Remember */}
                    <section>
                        <h2 className="text-xs uppercase tracking-widest text-white/40 mb-3 flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-amber-400" /> Key Things to Remember
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {brief.key_things_to_remember.map((item, i) => (
                                <Badge key={i} className="bg-amber-500/10 text-amber-200 border border-amber-500/30 px-3 py-1.5 text-sm">
                                    📌 {item}
                                </Badge>
                            ))}
                        </div>
                    </section>

                    {/* Two Column Layout: Radar + Experience */}
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Radar Chart */}
                        <section className="p-5 rounded-2xl bg-white/5 border border-white/10">
                            <h2 className="text-xs uppercase tracking-widest text-white/40 mb-4 text-center">Competency Radar</h2>
                            <RadarChart scores={scores} />
                        </section>

                        {/* Experience Highlights */}
                        <section className="p-5 rounded-2xl bg-blue-500/5 border border-blue-500/20">
                            <h2 className="text-xs uppercase tracking-widest text-blue-400 mb-4 flex items-center gap-2">
                                <Briefcase className="w-4 h-4" /> Career Highlights
                            </h2>
                            <div className="space-y-4">
                                {brief.experience_highlights.map((exp, i) => (
                                    <div key={i} className="pb-4 border-b border-white/5 last:border-0 last:pb-0">
                                        <h4 className="font-bold text-blue-100">{exp.role}</h4>
                                        <p className="text-white/50 text-sm mb-1">{exp.company} • {exp.duration}</p>
                                        <p className="text-white/80 text-sm">🏆 {exp.key_achievement}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    {/* ⚠️ CONCERNS - Amber/Orange Section */}
                    <section className="p-6 rounded-2xl bg-amber-500/5 border-2 border-amber-500/30">
                        <h2 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" /> Areas to Probe ({brief.concerns.length})
                        </h2>
                        <div className="space-y-4">
                            {brief.concerns.map((concern, i) => (
                                <div key={i} className="p-4 rounded-xl bg-black/30 border-l-4 border-amber-500">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-amber-200">{concern.concern}</h3>
                                        <Badge className={
                                            concern.severity === 'high' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                                                'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                        }>
                                            {concern.severity}
                                        </Badge>
                                    </div>
                                    <p className="text-white/60 text-sm mb-3">{concern.evidence}</p>
                                    <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                                        <p className="text-amber-100 italic text-sm">💬 "{concern.suggested_question}"</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* ✅ STRENGTHS - Green Section */}
                    <section className="p-6 rounded-2xl bg-emerald-500/5 border-2 border-emerald-500/30">
                        <h2 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5" /> Verified Strengths ({brief.strengths.length})
                        </h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            {brief.strengths.map((s, i) => (
                                <div key={i} className="p-4 rounded-xl bg-black/30 border-l-4 border-emerald-500">
                                    <div className="flex items-start gap-3">
                                        <Star className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                                        <div>
                                            <h3 className="font-bold text-emerald-200 mb-1">{s.strength}</h3>
                                            <p className="text-white/60 text-sm mb-2">{s.evidence}</p>
                                            <p className="text-emerald-300/80 text-xs flex items-center gap-1">
                                                <ChevronRight className="w-3 h-3" /> Verify: {s.how_to_verify}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* 💬 QUESTION BANK - Blue/Purple Section */}
                    <section className="p-6 rounded-2xl bg-indigo-500/5 border-2 border-indigo-500/30">
                        <h2 className="text-lg font-bold text-indigo-400 mb-4 flex items-center gap-2">
                            <HelpCircle className="w-5 h-5" /> Suggested Questions ({brief.suggested_questions.length})
                        </h2>
                        <div className="space-y-4">
                            {brief.suggested_questions.map((q, i) => (
                                <div key={i} className="p-4 rounded-xl bg-black/30 border-l-4 border-indigo-500">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Badge className={
                                            q.category === 'technical' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                                                q.category === 'behavioral' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                                                    q.category === 'situational' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' :
                                                        'bg-green-500/20 text-green-300 border-green-500/30'
                                        }>
                                            {q.category}
                                        </Badge>
                                        <span className="text-xs text-white/40">{q.purpose}</span>
                                    </div>
                                    <p className="text-lg text-indigo-100 font-medium mb-2">"{q.question}"</p>
                                    {q.follow_up && (
                                        <p className="text-white/50 text-sm pl-4 border-l-2 border-indigo-500/30">
                                            ↳ Follow-up: "{q.follow_up}"
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Topics to Avoid */}
                    {brief.topics_to_avoid.length > 0 && (
                        <section className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                            <h2 className="text-sm font-bold text-red-400 mb-2">🚫 Topics to Avoid</h2>
                            <ul className="space-y-1">
                                {brief.topics_to_avoid.map((topic, i) => (
                                    <li key={i} className="text-white/60 text-sm">• {topic}</li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* Bottom Padding */}
                    <div className="h-8" />
                </div>
            </div>
        </div>
    );
}
