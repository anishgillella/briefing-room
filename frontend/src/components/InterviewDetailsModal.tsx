"use client";

import { useState, useEffect } from "react";
import { Loader2, X, FileText, User, MessageSquare, Award, CheckCircle } from "lucide-react";
import { getFullInterviewDetails, FullInterviewDetails } from "@/lib/interviewerApi";
import TranscriptTab from "./TranscriptTab";
import InterviewerAnalyticsTab from "./InterviewerAnalyticsTab";

interface Props {
    interviewId: string;
    onClose: () => void;
}

type Tab = 'transcript' | 'interviewer_analytics' | 'candidate_analytics';

export default function InterviewDetailsModal({ interviewId, onClose }: Props) {
    const [details, setDetails] = useState<FullInterviewDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('interviewer_analytics');

    useEffect(() => {
        loadDetails();
        // Lock body scroll
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [interviewId]);

    const loadDetails = async () => {
        try {
            setLoading(true);
            const data = await getFullInterviewDetails(interviewId);
            setDetails(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load details");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
                <Loader2 className="w-8 h-8 animate-spin text-white" />
            </div>
        );
    }

    if (!details) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
            <div className="relative w-full max-w-6xl max-h-[90vh] bg-[#1a1a1a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col">

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-start justify-between bg-white/5">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-2xl font-bold text-white">{details.candidate.name}</h2>
                            <span className="px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-white/60 tracking-wider uppercase">
                                {details.interview.stage || 'Interview'}
                            </span>
                        </div>
                        <p className="text-white/40 text-sm">
                            {details.candidate.job_title} at {details.candidate.current_company || 'Unknown Company'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6 text-white/60" />
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-white/5 px-6">
                    <button
                        onClick={() => setActiveTab('interviewer_analytics')}
                        className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'interviewer_analytics'
                                ? 'border-purple-500 text-purple-400'
                                : 'border-transparent text-white/40 hover:text-white/60'
                            }`}
                    >
                        <User className="w-4 h-4" /> Interviewer Analytics
                    </button>
                    <button
                        onClick={() => setActiveTab('candidate_analytics')}
                        className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'candidate_analytics'
                                ? 'border-blue-500 text-blue-400'
                                : 'border-transparent text-white/40 hover:text-white/60'
                            }`}
                    >
                        <Award className="w-4 h-4" /> Candidate Results
                    </button>
                    <button
                        onClick={() => setActiveTab('transcript')}
                        className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'transcript'
                                ? 'border-white text-white'
                                : 'border-transparent text-white/40 hover:text-white/60'
                            }`}
                    >
                        <FileText className="w-4 h-4" /> Transcript
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-black/20">
                    {activeTab === 'interviewer_analytics' && (
                        <InterviewerAnalyticsTab
                            analyticsData={details.interviewer_analytics}
                        />
                    )}

                    {activeTab === 'candidate_analytics' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="glass-panel rounded-3xl p-8 border border-blue-500/20 bg-blue-500/5">
                                <h3 className="text-blue-400 text-sm font-bold tracking-wider uppercase mb-6 flex items-center gap-2">
                                    <Award className="w-4 h-4" /> Assessment Outcome
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                                    <div>
                                        <div className="text-6xl font-bold text-white mb-2">
                                            {details.candidate_analytics?.overall_score || details.interview.score || 0}
                                        </div>
                                        <div className="text-white/40 text-sm mb-6">Overall Score / 100</div>
                                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white font-medium">
                                            <CheckCircle className="w-4 h-4 text-green-400" />
                                            {details.candidate_analytics?.recommendation || 'Evaluation Completed'}
                                        </div>
                                    </div>
                                    <div className="bg-black/20 rounded-xl p-6 border border-white/5">
                                        <h4 className="text-white font-medium mb-3">Synthesis</h4>
                                        <p className="text-white/60 text-sm leading-relaxed">
                                            {details.candidate_analytics?.synthesis || "No automated synthesis available for this session."}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'transcript' && (
                        <TranscriptTab
                            transcript={details.transcript.turns.map(t => ({
                                speaker: t.speaker as "interviewer" | "candidate",
                                text: t.text,
                                timestamp: t.timestamp ? new Date(t.timestamp * 1000) : undefined // Map seconds to Date (relative to epoch is fine for rendering time string)
                            }))}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
