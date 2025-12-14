"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Vapi from "@vapi-ai/web";
import {
    ArrowLeft,
    Sparkles,
    Mic,
    MicOff,
    Volume2,
    PlayCircle,
    Loader2,
    AlertTriangle
} from "lucide-react";
import CandidateProfile from "@/components/CandidateProfile";
import InterviewHistory from "@/components/InterviewHistory";
import { Candidate, PreBrief } from "@/types";

const API_URL = "http://localhost:8000";

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
    const [activeTab, setActiveTab] = useState<'profile' | 'history'>('profile');

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



    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 text-white">
            {/* Header */}
            <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <button
                        onClick={() => router.push("/")}
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

            {/* Tab Navigation */}
            <div className="max-w-7xl mx-auto px-6 pt-6">
                <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'profile'
                            ? 'bg-purple-600 text-white shadow-lg'
                            : 'text-white/60 hover:text-white hover:bg-white/10'
                            }`}
                    >
                        Profile & Pre-Brief
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'history'
                            ? 'bg-purple-600 text-white shadow-lg'
                            : 'text-white/60 hover:text-white hover:bg-white/10'
                            }`}
                    >
                        Interview History
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'profile' ? (
                <CandidateProfile
                    candidate={candidate}
                    prebrief={prebrief}
                    loadingPrebrief={prebriefLoading}
                    onStartInterview={handleStartInterview}
                    startingInterview={startingInterview}
                />
            ) : (
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <InterviewHistory
                        candidateId={candidateId}
                        candidateName={candidate.name}
                        onStartInterview={(roomUrl, token, stage) => {
                            // Navigate to interview room
                            router.push(`/candidates/${candidateId}/interview?room=live&stage=${stage}`);
                        }}
                    />
                </div>
            )}

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
