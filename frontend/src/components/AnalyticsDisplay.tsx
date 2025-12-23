"use client";

import {
    MessageSquare,
    AlertTriangle,
    Volume2,
    TrendingUp,
    AlertCircle,
    CheckCircle,
    Lightbulb,
    ChevronRight,
    Sparkles,
    Flag,
    Star,
    Target,
    Users,
    Zap,
    HelpCircle,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface SkillEvidence {
    skill: string;
    quote: string;
    confidence: "High" | "Medium" | "Low" | string;
}

interface BehavioralProfile {
    leadership: number;
    resilience: number;
    communication: number;
    problem_solving: number;
    coachability: number;
}

interface CommunicationMetrics {
    speaking_pace_wpm: number;
    filler_word_frequency: "Low" | "Medium" | "High" | string;
    listen_to_talk_ratio: number;
}

interface RedFlag {
    concern: string;
    severity: "High" | "Medium" | "Low";
    evidence: string;
}

interface Highlight {
    moment: string;
    quote: string;
    why_notable: string;
}

interface RoleCompetency {
    competency: string;
    score: number;
    evidence_quote: string;
    assessment: string;
}

interface CulturalFitIndicators {
    values_alignment: number;
    work_style: string;
    motivation_drivers: string[];
    team_fit_notes: string;
}

interface EnthusiasmIndicators {
    overall_enthusiasm: number;
    role_interest: number;
    company_interest: number;
    questions_asked: string[];
    engagement_notes: string;
}

interface QuestionAnalytics {
    question: string;
    answer_summary: string;
    quality_score: number;
    key_insight: string;
    topic: string;
    relevance_score?: number;
    clarity_score?: number;
    depth_score?: number;
}

export interface Analytics {
    overall_score?: number;
    recommendation?: "Strong Hire" | "Hire" | "No Hire" | string;
    overall_synthesis?: string;
    question_analytics?: QuestionAnalytics[];
    skill_evidence?: SkillEvidence[];
    behavioral_profile?: BehavioralProfile;
    communication_metrics?: CommunicationMetrics;
    topics_to_probe?: string[];
    red_flags?: RedFlag[];
    highlights?: Highlight[];
    role_competencies?: RoleCompetency[];
    cultural_fit?: CulturalFitIndicators;
    enthusiasm?: EnthusiasmIndicators;
    // Legacy
    summary?: string;
}

interface AnalyticsDisplayProps {
    analytics: Analytics;
    candidateName?: string;
    showBackButton?: boolean;
    onBack?: () => void;
}

// ============================================================================
// Radar Chart Component
// ============================================================================

const RadarChart = ({ data }: { data: BehavioralProfile }) => {
    const size = 300;
    const center = size / 2;
    const radius = size * 0.35;

    const axes = [
        { label: "Leadership", value: data.leadership },
        { label: "Resilience", value: data.resilience },
        { label: "Communication", value: data.communication },
        { label: "Problem Solving", value: data.problem_solving },
        { label: "Coachability", value: data.coachability }
    ];

    const angleSlice = (Math.PI * 2) / 5;

    const getCoordinates = (value: number, index: number, max: number = 10) => {
        const angle = index * angleSlice - Math.PI / 2;
        const r = (value / max) * radius;
        return {
            x: center + r * Math.cos(angle),
            y: center + r * Math.sin(angle)
        };
    };

    const points = axes.map((axis, i) => {
        const coord = getCoordinates(axis.value, i);
        return `${coord.x},${coord.y}`;
    }).join(" ");

    const gridLevels = [2, 4, 6, 8, 10];

    return (
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[280px]">
            {/* Grid circles */}
            {gridLevels.map((level) => {
                const gridPoints = axes.map((_, i) => {
                    const coord = getCoordinates(level, i);
                    return `${coord.x},${coord.y}`;
                }).join(" ");
                return (
                    <polygon
                        key={level}
                        points={gridPoints}
                        fill="none"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="1"
                    />
                );
            })}

            {/* Axis lines */}
            {axes.map((_, i) => {
                const end = getCoordinates(10, i);
                return (
                    <line
                        key={i}
                        x1={center}
                        y1={center}
                        x2={end.x}
                        y2={end.y}
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="1"
                    />
                );
            })}

            {/* Data polygon */}
            <polygon
                points={points}
                fill="rgba(147, 51, 234, 0.3)"
                stroke="rgb(147, 51, 234)"
                strokeWidth="2"
            />

            {/* Data points */}
            {axes.map((axis, i) => {
                const coord = getCoordinates(axis.value, i);
                return (
                    <circle
                        key={i}
                        cx={coord.x}
                        cy={coord.y}
                        r="4"
                        fill="rgb(147, 51, 234)"
                    />
                );
            })}

            {/* Labels */}
            {axes.map((axis, i) => {
                const labelRadius = radius + 35;
                const angle = i * angleSlice - Math.PI / 2;
                const x = center + labelRadius * Math.cos(angle);
                const y = center + labelRadius * Math.sin(angle);
                return (
                    <text
                        key={i}
                        x={x}
                        y={y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-gray-400 text-[10px]"
                    >
                        {axis.label}
                    </text>
                );
            })}

            {/* Value labels */}
            {axes.map((axis, i) => {
                const coord = getCoordinates(axis.value, i);
                return (
                    <text
                        key={`val-${i}`}
                        x={coord.x}
                        y={coord.y - 12}
                        textAnchor="middle"
                        className="fill-white text-xs font-medium"
                    >
                        {axis.value}
                    </text>
                );
            })}
        </svg>
    );
};

// ============================================================================
// Main Component
// ============================================================================

export default function AnalyticsDisplay({
    analytics,
    candidateName,
    showBackButton = false,
    onBack
}: AnalyticsDisplayProps) {
    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Executive Summary Card */}
            <div className="glass-panel rounded-3xl p-8">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase">Executive Summary</h3>
                    {showBackButton && onBack && (
                        <button
                            onClick={onBack}
                            className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors text-sm font-medium"
                        >
                            Back
                        </button>
                    )}
                </div>
                <p className="text-lg text-gray-200 font-light leading-relaxed">
                    {analytics.overall_synthesis || analytics.summary || "No summary available"}
                </p>
                <div className="mt-8 flex items-center gap-8">
                    <div className="flex items-center gap-4">
                        <div className="text-6xl font-bold text-white">{analytics.overall_score || 0}</div>
                        <div className="text-gray-400">/ 100 Match Score</div>
                    </div>
                    {analytics.recommendation && (
                        <div className={`px-4 py-2 rounded-full text-sm font-semibold ${analytics.recommendation.includes('Strong Hire') || analytics.recommendation === 'Hire'
                            ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                            : analytics.recommendation.includes('No Hire')
                                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                            }`}>
                            {analytics.recommendation}
                        </div>
                    )}
                </div>
            </div>

            {/* Question-by-Question Analysis */}
            {analytics.question_analytics && analytics.question_analytics.length > 0 && (
                <div className="glass-panel rounded-3xl p-8">
                    <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase mb-6 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" /> Question Analysis
                    </h3>
                    <div className="space-y-6">
                        {analytics.question_analytics.map((qa, i) => (
                            <div key={i} className="group relative p-8 rounded-3xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all duration-500 ease-out">
                                <div className={`absolute -inset-0.5 rounded-3xl opacity-0 group-hover:opacity-100 transition duration-500 blur-2xl ${qa.quality_score >= 80 ? 'bg-green-500/10' : qa.quality_score >= 50 ? 'bg-yellow-500/10' : 'bg-red-500/10'
                                    }`} />

                                <div className="relative">
                                    <div className="flex justify-between items-start gap-6 mb-6">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/40">
                                                    {(qa.topic && qa.topic.toLowerCase() !== "none") ? qa.topic : "General"}
                                                </span>
                                                <div className="h-px w-8 bg-white/10" />
                                            </div>
                                            <h4 className="text-xl font-medium text-white leading-snug tracking-tight">
                                                {qa.question}
                                            </h4>
                                        </div>

                                        <div className="flex flex-col items-center">
                                            <div className={`text-4xl font-light tracking-tighter ${qa.quality_score >= 80 ? 'text-green-400' :
                                                qa.quality_score >= 50 ? 'text-yellow-400' : 'text-red-400'
                                                }`}>
                                                {qa.quality_score}
                                            </div>
                                            <div className="text-[10px] font-medium uppercase tracking-widest text-white/30 mt-1">
                                                Match
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mb-8">
                                        <p className="text-base text-gray-300 font-light leading-relaxed">
                                            {qa.answer_summary}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                                        <div className="lg:col-span-3 flex justify-between items-center py-4 px-6 rounded-2xl bg-black/20 border border-white/5">
                                            {[
                                                { label: "Relevance", value: qa.relevance_score },
                                                { label: "Clarity", value: qa.clarity_score },
                                                { label: "Depth", value: qa.depth_score }
                                            ].map((metric, idx) => (
                                                <div key={idx} className="flex flex-col items-center w-full px-2">
                                                    <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">
                                                        {metric.label}
                                                    </span>
                                                    <div className="flex items-baseline gap-0.5">
                                                        <span className={`text-xl font-medium ${(metric.value ?? 0) >= 8 ? 'text-white' : 'text-white/70'}`}>
                                                            {metric.value ?? '-'}
                                                        </span>
                                                        <span className="text-xs text-white/20">/10</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {qa.key_insight && (
                                            <div className="lg:col-span-2 flex items-center p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
                                                <div className="flex gap-3">
                                                    <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0 mt-1" />
                                                    <p className="text-xs text-blue-200/90 leading-relaxed font-medium">
                                                        {qa.key_insight}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Skill Evidence & Behavioral Profile */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {analytics.skill_evidence && analytics.skill_evidence.length > 0 && (
                    <div className="glass-panel rounded-3xl p-6">
                        <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase mb-4 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-400" /> Verified Skills
                        </h3>
                        <div className="space-y-3">
                            {analytics.skill_evidence.map((skill, i) => (
                                <div key={i} className="p-3 rounded-xl bg-green-500/5 border border-green-500/10">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-green-300">{skill.skill}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded ${skill.confidence === 'High' ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'
                                            }`}>{skill.confidence}</span>
                                    </div>
                                    <p className="text-xs text-gray-400 italic">&ldquo;{skill.quote}&rdquo;</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {analytics.behavioral_profile && (
                    <div className="glass-panel rounded-3xl p-6">
                        <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase mb-4 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-purple-400" /> Behavioral Profile
                        </h3>
                        <div className="flex justify-center">
                            <RadarChart data={analytics.behavioral_profile} />
                        </div>
                    </div>
                )}
            </div>

            {/* Red Flags & Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {analytics.red_flags && analytics.red_flags.length > 0 && (
                    <div className="glass-panel rounded-3xl p-6">
                        <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase mb-4 flex items-center gap-2">
                            <Flag className="w-4 h-4 text-red-400" /> Concerns & Red Flags
                        </h3>
                        <div className="space-y-3">
                            {analytics.red_flags.map((flag, i) => (
                                <div key={i} className={`p-3 rounded-xl border ${flag.severity === 'High' ? 'bg-red-500/10 border-red-500/20' :
                                    flag.severity === 'Medium' ? 'bg-yellow-500/10 border-yellow-500/20' :
                                        'bg-orange-500/10 border-orange-500/20'
                                    }`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-sm font-medium ${flag.severity === 'High' ? 'text-red-300' :
                                            flag.severity === 'Medium' ? 'text-yellow-300' :
                                                'text-orange-300'
                                            }`}>{flag.concern}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded ${flag.severity === 'High' ? 'bg-red-500/20 text-red-300' :
                                            flag.severity === 'Medium' ? 'bg-yellow-500/20 text-yellow-300' :
                                                'bg-orange-500/20 text-orange-300'
                                            }`}>{flag.severity}</span>
                                    </div>
                                    <p className="text-xs text-gray-400 italic">&ldquo;{flag.evidence}&rdquo;</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {analytics.highlights && analytics.highlights.length > 0 && (
                    <div className="glass-panel rounded-3xl p-6">
                        <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase mb-4 flex items-center gap-2">
                            <Star className="w-4 h-4 text-yellow-400" /> Standout Moments
                        </h3>
                        <div className="space-y-3">
                            {analytics.highlights.map((highlight, i) => (
                                <div key={i} className="p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                                    <div className="flex items-start gap-2 mb-2">
                                        <Sparkles className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                                        <span className="text-sm font-medium text-yellow-300">{highlight.moment}</span>
                                    </div>
                                    <p className="text-xs text-gray-300 italic mb-2">&ldquo;{highlight.quote}&rdquo;</p>
                                    <p className="text-xs text-gray-500">{highlight.why_notable}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Role Competencies */}
            {analytics.role_competencies && analytics.role_competencies.length > 0 && (
                <div className="glass-panel rounded-3xl p-6">
                    <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase mb-4 flex items-center gap-2">
                        <Target className="w-4 h-4 text-cyan-400" /> Role-Specific Competencies
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {analytics.role_competencies.map((comp, i) => (
                            <div key={i} className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-medium text-cyan-300">{comp.competency}</span>
                                    <div className={`text-2xl font-light ${comp.score >= 8 ? 'text-green-400' :
                                        comp.score >= 6 ? 'text-yellow-400' :
                                            'text-red-400'
                                        }`}>
                                        {comp.score}<span className="text-xs text-gray-500">/10</span>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-400 italic mb-2">&ldquo;{comp.evidence_quote}&rdquo;</p>
                                <p className="text-xs text-gray-500">{comp.assessment}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Cultural Fit & Enthusiasm */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {analytics.cultural_fit && (
                    <div className="glass-panel rounded-3xl p-6">
                        <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase mb-4 flex items-center gap-2">
                            <Users className="w-4 h-4 text-pink-400" /> Cultural Fit
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-400">Values Alignment</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${analytics.cultural_fit.values_alignment >= 8 ? 'bg-green-500' :
                                                analytics.cultural_fit.values_alignment >= 6 ? 'bg-yellow-500' :
                                                    'bg-red-500'
                                                }`}
                                            style={{ width: `${analytics.cultural_fit.values_alignment * 10}%` }}
                                        />
                                    </div>
                                    <span className="text-white font-medium text-sm">{analytics.cultural_fit.values_alignment}/10</span>
                                </div>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 uppercase tracking-wider">Work Style</span>
                                <p className="text-sm text-gray-300 mt-1">{analytics.cultural_fit.work_style}</p>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 uppercase tracking-wider">What Motivates Them</span>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {analytics.cultural_fit.motivation_drivers?.map((driver, i) => (
                                        <span key={i} className="px-2 py-1 text-xs rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/20">
                                            {driver}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 uppercase tracking-wider">Team Fit Notes</span>
                                <p className="text-xs text-gray-400 mt-1">{analytics.cultural_fit.team_fit_notes}</p>
                            </div>
                        </div>
                    </div>
                )}

                {analytics.enthusiasm && (
                    <div className="glass-panel rounded-3xl p-6">
                        <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase mb-4 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-400" /> Enthusiasm & Engagement
                        </h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="text-center p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                                    <div className={`text-2xl font-light ${analytics.enthusiasm.overall_enthusiasm >= 8 ? 'text-green-400' :
                                        analytics.enthusiasm.overall_enthusiasm >= 6 ? 'text-yellow-400' :
                                            'text-red-400'
                                        }`}>{analytics.enthusiasm.overall_enthusiasm}</div>
                                    <div className="text-[10px] text-gray-500 uppercase mt-1">Overall</div>
                                </div>
                                <div className="text-center p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                                    <div className={`text-2xl font-light ${analytics.enthusiasm.role_interest >= 8 ? 'text-green-400' :
                                        analytics.enthusiasm.role_interest >= 6 ? 'text-yellow-400' :
                                            'text-red-400'
                                        }`}>{analytics.enthusiasm.role_interest}</div>
                                    <div className="text-[10px] text-gray-500 uppercase mt-1">Role Interest</div>
                                </div>
                                <div className="text-center p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                                    <div className={`text-2xl font-light ${analytics.enthusiasm.company_interest >= 8 ? 'text-green-400' :
                                        analytics.enthusiasm.company_interest >= 6 ? 'text-yellow-400' :
                                            'text-red-400'
                                        }`}>{analytics.enthusiasm.company_interest}</div>
                                    <div className="text-[10px] text-gray-500 uppercase mt-1">Company</div>
                                </div>
                            </div>
                            {analytics.enthusiasm.questions_asked && analytics.enthusiasm.questions_asked.length > 0 && (
                                <div>
                                    <span className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                        <HelpCircle className="w-3 h-3" /> Questions They Asked
                                    </span>
                                    <ul className="mt-2 space-y-1">
                                        {analytics.enthusiasm.questions_asked.map((q, i) => (
                                            <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                                                <span className="text-amber-400 mt-0.5">•</span>
                                                {q}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <div>
                                <span className="text-xs text-gray-500 uppercase tracking-wider">Engagement Notes</span>
                                <p className="text-xs text-gray-400 mt-1">{analytics.enthusiasm.engagement_notes}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Communication Metrics & Topics to Probe */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {analytics.communication_metrics && (
                    <div className="glass-panel rounded-3xl p-6">
                        <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase mb-4 flex items-center gap-2">
                            <Volume2 className="w-4 h-4 text-blue-400" /> Communication Metrics
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-400">Speaking Pace</span>
                                <span className="text-white font-medium">{analytics.communication_metrics.speaking_pace_wpm} WPM</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-400">Filler Words</span>
                                <span className={`font-medium ${analytics.communication_metrics.filler_word_frequency === 'Low' ? 'text-green-400' :
                                    analytics.communication_metrics.filler_word_frequency === 'Medium' ? 'text-yellow-400' : 'text-red-400'
                                    }`}>{analytics.communication_metrics.filler_word_frequency}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-400">Listen/Talk Ratio</span>
                                <span className="text-white font-medium">{(analytics.communication_metrics.listen_to_talk_ratio * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                    </div>
                )}

                {analytics.topics_to_probe && analytics.topics_to_probe.length > 0 && (
                    <div className="glass-panel rounded-3xl p-6">
                        <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase mb-4 flex items-center gap-2">
                            <ChevronRight className="w-4 h-4 text-orange-400" /> Follow-Up Topics
                        </h3>
                        <ul className="space-y-2">
                            {analytics.topics_to_probe.map((topic, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                                    <span className="text-orange-400 mt-0.5">•</span>
                                    {topic}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
