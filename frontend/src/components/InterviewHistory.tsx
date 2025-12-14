"use client";

import { useState, useEffect } from "react";
import {
    CheckCircle,
    Clock,
    PlayCircle,
    ChevronRight,
    ChevronDown,
    Loader2,
    ThumbsUp,
    ThumbsDown,
    MessageSquare,
    AlertTriangle,
    Lightbulb
} from "lucide-react";
import {
    getCandidateInterviews,
    startNextInterview,
    submitDecision,
    formatStageName,
    getStageStatus,
    lookupCandidateByName,
    type CandidateInterviewsResponse,
    type InterviewSummary,
} from "@/lib/interviewApi";

interface InterviewHistoryProps {
    candidateId: string;
    candidateName: string;
    onStartInterview?: (roomUrl: string, token: string, stage: string) => void;
}

const STAGES = ['round_1', 'round_2', 'round_3'] as const;

export default function InterviewHistory({
    candidateId,
    candidateName,
    onStartInterview
}: InterviewHistoryProps) {
    const [data, setData] = useState<CandidateInterviewsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [startingInterview, setStartingInterview] = useState(false);
    const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
    const [showDecisionModal, setShowDecisionModal] = useState(false);
    const [submittingDecision, setSubmittingDecision] = useState(false);
    const [decisionNotes, setDecisionNotes] = useState("");
    const [dbCandidateId, setDbCandidateId] = useState<string | null>(null);

    useEffect(() => {
        loadInterviews();
    }, [candidateId, candidateName]);

    const loadInterviews = async () => {
        try {
            setLoading(true);
            setError(null);

            // First, lookup the DB UUID from the candidate name
            // This bridges JSON simple IDs (0,1,2) to database UUIDs
            let effectiveId = candidateId;

            // Check if candidateId looks like a UUID (contains dashes and is 36 chars)
            const isUuid = candidateId.length === 36 && candidateId.includes('-');

            if (!isUuid && candidateName) {
                // Need to lookup DB UUID by name
                try {
                    const lookup = await lookupCandidateByName(candidateName);
                    effectiveId = lookup.db_id;
                    setDbCandidateId(lookup.db_id);
                } catch (lookupErr) {
                    // Candidate not in database yet - show empty state
                    setData(null);
                    setError("Candidate not yet in database. Run migration to sync data.");
                    setLoading(false);
                    return;
                }
            } else {
                setDbCandidateId(candidateId);
            }

            const response = await getCandidateInterviews(effectiveId);
            setData(response);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load interviews");
        } finally {
            setLoading(false);
        }
    };

    const handleStartInterview = async () => {
        if (!dbCandidateId) {
            setError("Cannot start interview: Candidate not found in database");
            return;
        }
        try {
            setStartingInterview(true);
            const response = await startNextInterview(dbCandidateId);
            if (onStartInterview) {
                onStartInterview(response.room_url, response.token, response.stage);
            }
            // Refresh after starting
            await loadInterviews();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to start interview");
        } finally {
            setStartingInterview(false);
        }
    };

    const handleDecision = async (decision: 'accepted' | 'rejected') => {
        if (!dbCandidateId) {
            setError("Cannot submit decision: Candidate not found in database");
            return;
        }
        try {
            setSubmittingDecision(true);
            await submitDecision(dbCandidateId, decision, decisionNotes);
            setShowDecisionModal(false);
            setDecisionNotes("");
            await loadInterviews();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to submit decision");
        } finally {
            setSubmittingDecision(false);
        }
    };

    const toggleStage = (stage: string) => {
        const newExpanded = new Set(expandedStages);
        if (newExpanded.has(stage)) {
            newExpanded.delete(stage);
        } else {
            newExpanded.add(stage);
        }
        setExpandedStages(newExpanded);
    };

    const getScoreColor = (score?: number) => {
        if (!score) return "text-white/40";
        if (score >= 80) return "text-green-400";
        if (score >= 60) return "text-yellow-400";
        return "text-red-400";
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-8">
                <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                <p className="text-red-400">{error}</p>
                <button
                    onClick={loadInterviews}
                    className="mt-4 px-4 py-2 bg-white/10 rounded-lg text-white/60 hover:bg-white/20"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="space-y-8 animate-fade-in">
            {/* -------------------- PIPELINE PROGRESS -------------------- */}
            <div className="relative">
                {/* Connecting Line */}
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/10 -translate-y-1/2 z-0"></div>

                <div className="relative z-10 flex justify-between px-4">
                    {STAGES.map((stage, i) => {
                        const status = getStageStatus(stage, data.interviews);
                        const interview = data.interviews.find(int => int.stage === stage);
                        const score = interview?.analytics?.overall_score;
                        const isCompleted = status === 'completed';
                        const isActive = status === 'in_progress';

                        return (
                            <div key={stage} className="flex flex-col items-center gap-4 group cursor-pointer" onClick={() => toggleStage(stage)}>
                                {/* Status Ring */}
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center border-4 transition-all duration-500 shadow-xl ${isCompleted
                                    ? 'bg-black border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                                    : isActive
                                        ? 'bg-black border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.3)] scale-110'
                                        : 'bg-black border-white/10'
                                    }`}>
                                    {isCompleted ? (
                                        <div className="text-green-500 font-bold text-lg">{score || <CheckCircle className="w-6 h-6" />}</div>
                                    ) : isActive ? (
                                        <Clock className="w-6 h-6 text-yellow-500 animate-pulse" />
                                    ) : (
                                        <span className="text-white/20 font-medium">0{i + 1}</span>
                                    )}
                                </div>

                                {/* Labels */}
                                <div className="text-center">
                                    <h3 className={`font-semibold tracking-tight text-sm uppercase ${isCompleted ? 'text-white' : isActive ? 'text-yellow-400' : 'text-white/40'
                                        }`}>
                                        {formatStageName(stage)}
                                    </h3>
                                    {isCompleted && interview?.analytics?.recommendation && (
                                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${interview.analytics.recommendation === 'Hire' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                            }`}>
                                            {interview.analytics.recommendation}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* -------------------- AVERAGE SCORE SCORECARD -------------------- */}
            {data.average_score && (
                <div className="glass-card-premium p-8 flex items-center justify-between relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                    <div>
                        <h3 className="text-white/40 text-xs font-bold uppercase tracking-[0.2em] mb-1">Performance Average</h3>
                        <div className="flex items-baseline gap-2">
                            <span className={`text-6xl font-light tracking-tighter ${getScoreColor(data.average_score)}`}>
                                {data.average_score.toFixed(0)}
                            </span>
                            <span className="text-white/20 text-xl font-light">/ 100</span>
                        </div>
                    </div>
                    <div className="h-16 w-px bg-white/10 mx-8"></div>
                    <div className="flex-1">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-1000 ease-out"
                                    style={{ width: `${(data.stages_completed / 3) * 100}%` }}
                                ></div>
                            </div>
                            <span className="text-white/60 text-sm font-mono">{data.stages_completed}/3 Stages</span>
                        </div>
                        <p className="text-white/40 text-xs">Pipeline completion progress</p>
                    </div>
                </div>
            )}

            {/* -------------------- INTERVIEW DETAILS LIST -------------------- */}
            <div className="space-y-4">
                {data.interviews.map((interview) => (
                    <div
                        key={interview.id}
                        className={`group rounded-2xl border border-white/5 transition-all duration-500 overflow-hidden ${expandedStages.has(interview.stage)
                            ? 'bg-white/5 shadow-2xl ring-1 ring-white/10'
                            : 'bg-transparent hover:bg-white/5'
                            }`}
                    >
                        {/* Header */}
                        <button
                            onClick={() => toggleStage(interview.stage)}
                            className="w-full px-8 py-6 flex justify-between items-center"
                        >
                            <div className="flex items-center gap-6">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${interview.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/20'
                                    }`}>
                                    {interview.status === 'completed' ? <CheckCircle className="w-5 h-5" /> : <div className="w-2 h-2 rounded-full bg-current" />}
                                </div>
                                <div className="text-left">
                                    <h4 className="text-white font-medium text-lg tracking-tight">{formatStageName(interview.stage)}</h4>
                                    <p className="text-white/40 text-xs uppercase tracking-wider mt-0.5">{interview.status}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-8">
                                {interview.analytics?.overall_score && (
                                    <div className="text-right">
                                        <div className={`text-2xl font-light tracking-tight ${getScoreColor(interview.analytics.overall_score)}`}>
                                            {interview.analytics.overall_score}
                                        </div>
                                        <div className="text-[10px] text-white/30 uppercase tracking-widest">Score</div>
                                    </div>
                                )}
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-500 ${expandedStages.has(interview.stage) ? 'rotate-180 bg-white/10' : ''}`}>
                                    <ChevronDown className="w-4 h-4 text-white/60" />
                                </div>
                            </div>
                        </button>

                        {/* Expanded Content */}
                        {expandedStages.has(interview.stage) && interview.analytics && (
                            <div className="px-8 pb-8 pt-2 animate-fade-in">
                                <div className="h-px w-full bg-white/5 mb-8"></div>

                                {/* 1. The Verdict (Synthesis) */}
                                <div className="mb-10">
                                    <h5 className="text-white/40 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Lightbulb className="w-4 h-4" /> Executive Synthesis
                                    </h5>
                                    <p className="text-white/90 text-lg font-light leading-relaxed border-l-2 border-purple-500/50 pl-6 italic">
                                        "{interview.analytics.synthesis}"
                                    </p>
                                </div>

                                {/* 2. Behavioral Grid */}
                                {interview.analytics.behavioral_profile && Object.keys(interview.analytics.behavioral_profile).length > 0 && (
                                    <div className="mb-10">
                                        <h5 className="text-white/40 text-xs font-bold uppercase tracking-widest mb-4">Behavioral DNA</h5>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                            {Object.entries(interview.analytics.behavioral_profile).map(([trait, score]) => (
                                                <div key={trait} className="bg-white/5 rounded-xl p-4 text-center border border-white/5 hover:bg-white/10 transition-colors">
                                                    <div className="relative inline-flex items-center justify-center mb-2">
                                                        <svg className="w-16 h-16 transform -rotate-90">
                                                            <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/5" />
                                                            <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-purple-500" strokeDasharray={175.9} strokeDashoffset={175.9 - (175.9 * (score as number)) / 10} />
                                                        </svg>
                                                        <span className="absolute text-xl font-medium text-white">{score as number}</span>
                                                    </div>
                                                    <div className="text-xs text-white/50 font-medium capitalize truncate">{trait.replace('_', ' ')}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* 3. Key Questions */}
                                    <div>
                                        <h5 className="text-white/40 text-xs font-bold uppercase tracking-widest mb-4">Q&A Analysis</h5>
                                        <div className="space-y-3">
                                            {interview.analytics.question_analytics?.slice(0, 4).map((qa, i) => (
                                                <div key={i} className="group p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all">
                                                    <div className="flex justify-between items-start gap-4 mb-2">
                                                        <p className="text-sm text-white/90 font-medium leading-snug">"{qa.question}"</p>
                                                        <span className={`text-xs font-bold px-2 py-1 rounded bg-black/30 ${qa.quality_score && qa.quality_score >= 80 ? 'text-green-400' : 'text-yellow-400'}`}>
                                                            {qa.quality_score}
                                                        </span>
                                                    </div>
                                                    {qa.topic && (
                                                        <span className="text-[10px] text-white/40 uppercase tracking-wider">{qa.topic}</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 4. Skills & Topics */}
                                    <div className="space-y-8">
                                        {interview.analytics.skill_evidence && interview.analytics.skill_evidence.length > 0 && (
                                            <div>
                                                <h5 className="text-white/40 text-xs font-bold uppercase tracking-widest mb-4">Skill Evidence</h5>
                                                <div className="space-y-2">
                                                    {interview.analytics.skill_evidence.slice(0, 3).map((skill: any, i: number) => (
                                                        <div key={i} className="flex justify-between items-center p-3 rounded-lg border border-b border-t-0 border-r-0 border-l-0 border-white/10">
                                                            <span className="text-sm text-white/80">{skill.skill}</span>
                                                            <div className="flex gap-1">
                                                                {[1, 2, 3].map(bar => (
                                                                    <div key={bar} className={`w-1.5 h-4 rounded-full ${(skill.confidence === 'High' && bar <= 3) || (skill.confidence === 'Medium' && bar <= 2) ? 'bg-green-500' : 'bg-white/10'
                                                                        }`}></div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {interview.analytics.topics_to_probe && interview.analytics.topics_to_probe.length > 0 && (
                                            <div>
                                                <h5 className="text-white/40 text-xs font-bold uppercase tracking-widest mb-4">Deep Dive Areas</h5>
                                                <div className="flex flex-wrap gap-2">
                                                    {interview.analytics.topics_to_probe.map((topic, i) => (
                                                        <span key={i} className="px-3 py-1.5 bg-yellow-500/10 text-yellow-200 border border-yellow-500/20 text-xs rounded-lg">
                                                            → {topic}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* -------------------- ACTION BUTTON -------------------- */}
            <div className="pt-4">
                {data.next_stage && !data.all_stages_complete && (
                    <button
                        onClick={handleStartInterview}
                        disabled={startingInterview}
                        className="w-full group relative overflow-hidden rounded-2xl bg-white p-1 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-black"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-90 transition-all duration-300 group-hover:opacity-100"></div>
                        <div className="relative flex items-center justify-center gap-3 rounded-xl bg-black px-8 py-5 transition-all duration-300 group-hover:bg-transparent">
                            {startingInterview ? (
                                <Loader2 className="h-6 w-6 animate-spin text-white" />
                            ) : (
                                <PlayCircle className="h-6 w-6 text-white" />
                            )}
                            <span className="text-lg font-semibold text-white">Start {formatStageName(data.next_stage)} Session</span>
                        </div>
                    </button>
                )}

                {/* Final Decision UI */}
                {data.all_stages_complete && data.pipeline_status === 'decision_pending' && (
                    <div className="bg-gradient-to-b from-white/10 to-transparent p-1 rounded-3xl border border-white/20">
                        <div className="bg-black/80 backdrop-blur-xl rounded-[20px] p-8 text-center">
                            <h3 className="text-2xl font-semibold text-white mb-2">Process Complete</h3>
                            <p className="text-white/40 mb-8 max-w-md mx-auto">All interview stages have been completed. Please make your final hiring decision below.</p>

                            <div className="flex gap-4 max-w-lg mx-auto">
                                <button
                                    onClick={() => setShowDecisionModal(true)}
                                    className="flex-1 py-4 bg-white text-black rounded-xl font-bold hover:scale-105 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                                >
                                    Accept Candidate
                                </button>
                                <button
                                    onClick={() => handleDecision('rejected')}
                                    disabled={submittingDecision}
                                    className="flex-1 py-4 bg-white/5 text-white rounded-xl font-bold hover:bg-white/10 transition-colors border border-white/10"
                                >
                                    Reject
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Decision Result */}
                {(data.pipeline_status === 'accepted' || data.pipeline_status === 'rejected') && (
                    <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-up">
                        <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-2xl ${data.pipeline_status === 'accepted' ? 'bg-green-500 text-black shadow-green-900/50' : 'bg-red-500 text-white shadow-red-900/50'
                            }`}>
                            {data.pipeline_status === 'accepted' ? <CheckCircle className="w-12 h-12" /> : <ThumbsDown className="w-12 h-12" />}
                        </div>
                        <h2 className="text-4xl font-bold text-white mb-2">Candidate {data.pipeline_status === 'accepted' ? 'Accepted' : 'Rejected'}</h2>
                        <p className="text-white/40">Decision recorded in system</p>
                    </div>
                )}
            </div>

            {/* Decision Modal (Refined) */}
            {showDecisionModal && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
                    <div className="bg-[#121212] rounded-3xl p-8 max-w-lg w-full mx-4 border border-white/10 shadow-2xl scale-100 animate-scale-in">
                        <h3 className="text-2xl font-semibold text-white mb-2">Confirm Hiring Decision</h3>
                        <p className="text-white/40 mb-6">You are about to accept {candidateName}. This action will trigger the offer workflow.</p>

                        <div className="space-y-4">
                            <textarea
                                placeholder="Add optional decision notes..."
                                value={decisionNotes}
                                onChange={(e) => setDecisionNotes(e.target.value)}
                                className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white/90 text-sm focus:outline-none focus:border-white/30 transition-colors resize-none"
                                rows={4}
                            />

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button
                                    onClick={() => setShowDecisionModal(false)}
                                    className="py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDecision('accepted')}
                                    disabled={submittingDecision}
                                    className="py-3 bg-white text-black hover:bg-gray-200 rounded-xl font-bold transition-colors"
                                >
                                    {submittingDecision ? 'Processing...' : 'Confirm Accept'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
