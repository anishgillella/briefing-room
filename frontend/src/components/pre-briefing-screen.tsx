"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Vapi from "@vapi-ai/web";
import { Button } from "@/components/ui/button";
import { getBriefing, getPreInterviewBrief, PreInterviewBrief } from "@/lib/api";
import PreInterviewBriefComponent from "@/components/pre-interview-brief";

interface PreBriefingScreenProps {
    roomName: string;
    participantName: string;
    onStartInterview: (brief?: PreInterviewBrief) => void;
}

export default function PreBriefingScreen({
    roomName,
    participantName,
    onStartInterview
}: PreBriefingScreenProps) {
    // Visual brief state
    const [preBrief, setPreBrief] = useState<PreInterviewBrief | null>(null);
    const [preBriefLoading, setPreBriefLoading] = useState(true);
    const [preBriefError, setPreBriefError] = useState<string | null>(null);

    // Voice agent state
    const [isVoiceActive, setIsVoiceActive] = useState(false);
    const [isVoiceConnecting, setIsVoiceConnecting] = useState(false);
    const vapiRef = useRef<Vapi | null>(null);
    const briefingContextRef = useRef<string>("");

    // Rotating facts state
    const [currentFactIndex, setCurrentFactIndex] = useState(0);
    const facts = [
        "Did you know? Top talent stays on the market for only 10 days.",
        "Structured interviews are 2x more predictive of job performance than unstructured ones.",
        "A bad hire can cost up to 30% of the employee's first-year earnings.",
        "73% of candidates are passive job seekers, open to new opportunities.",
        "Data-driven recruiting improves quality of hire by over 50%.",
        "Soft skills are cited by 92% of talent professionals as equally or more important than hard skills.",
        " Diverse companies are 35% more likely to outperform their competitors."
    ];

    useEffect(() => {
        if (preBriefLoading) {
            const interval = setInterval(() => {
                setCurrentFactIndex((prev) => (prev + 1) % facts.length);
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [preBriefLoading, facts.length]);

    // Fetch briefing data and pre-brief on mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                const briefingData = await getBriefing(roomName);
                briefingContextRef.current = briefingData.briefing_prompt || "";

                // Fetch visual pre-brief
                if (briefingData.notes && briefingData.resume_summary) {
                    const brief = await getPreInterviewBrief(
                        roomName,
                        briefingData.notes,
                        briefingData.resume_summary
                    );
                    setPreBrief(brief);
                    setPreBriefLoading(false);
                } else {
                    setPreBriefError("Missing job description or resume. Please go back and add them.");
                    setPreBriefLoading(false);
                }
            } catch (err) {
                console.error("Pre-brief error:", err);
                setPreBriefError(err instanceof Error ? err.message : "Failed to generate brief");
                setPreBriefLoading(false);
            }
        };

        fetchData();
    }, [roomName]);

    // Start voice agent
    const startVoiceAgent = useCallback(async () => {
        const vapiKey = process.env.NEXT_PUBLIC_VAPI_WEB_KEY;
        const assistantId = process.env.NEXT_PUBLIC_VAPI_BRIEFING_ASSISTANT_ID;

        if (!vapiKey) {
            alert("Voice AI not configured. Add NEXT_PUBLIC_VAPI_WEB_KEY to .env.local");
            return;
        }

        setIsVoiceConnecting(true);

        try {
            const vapi = new Vapi(vapiKey);
            vapiRef.current = vapi;

            vapi.on("call-start", () => {
                setIsVoiceConnecting(false);
                setIsVoiceActive(true);
            });
            vapi.on("call-end", () => {
                setIsVoiceActive(false);
            });
            vapi.on("error", (err) => {
                console.error("VAPI error:", err);
                setIsVoiceConnecting(false);
                setIsVoiceActive(false);
            });

            // Use assistantId if configured, otherwise use inline config
            if (assistantId) {
                await vapi.start(assistantId, {
                    variableValues: {
                        participantName,
                        briefingContext: briefingContextRef.current,
                        candidateName: preBrief?.candidate_name || "the candidate"
                    }
                });
            } else {
                // Fallback: inline assistant config
                await vapi.start({
                    model: {
                        provider: "openai",
                        model: "gpt-4o-mini",
                        messages: [
                            {
                                role: "system",
                                content: `You are a helpful interview preparation assistant helping ${participantName} prepare for an interview.

${briefingContextRef.current}

Help by:
- Answering questions about the candidate
- Suggesting interview questions
- Discussing areas to probe

Be concise. The interviewer has limited time.`
                            }
                        ]
                    },
                    voice: {
                        provider: "11labs",
                        voiceId: "21m00Tcm4TlvDq8ikWAM"
                    },
                    firstMessage: `Hi ${participantName}! Ready to discuss ${preBrief?.candidate_name || "the candidate"}. What would you like to know?`
                });
            }
        } catch (err) {
            console.error("Voice agent failed:", err);
            setIsVoiceConnecting(false);
            alert("Failed to start voice AI. Check console for details.");
        }
    }, [participantName, preBrief]);

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

    const handleStartClick = () => {
        onStartInterview(preBrief || undefined);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col">
            {/* Header */}
            <div className="shrink-0 p-4 border-b border-white/10 bg-slate-900/80 backdrop-blur-xl flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold">Pre-Interview Briefing</h1>
                    <p className="text-white/50 text-sm">Room: {roomName}</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Voice indicator */}
                    {isVoiceActive && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 border border-violet-500/30 rounded-full">
                            <span className="w-2 h-2 bg-violet-400 rounded-full animate-pulse"></span>
                            <span className="text-sm text-violet-300">AI Listening...</span>
                        </div>
                    )}
                    <Button
                        onClick={handleStartClick}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-6"
                        size="lg"
                    >
                        🎬 Start Interview
                    </Button>
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 overflow-hidden">
                {preBriefLoading ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center max-w-2xl mx-auto">
                        <div className="relative mb-4">
                            <div className="w-24 h-24 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-3xl">🤖</span>
                            </div>
                        </div>

                        <div className="space-y-2 h-24 transition-all duration-500">
                            <p className="text-violet-300 text-lg font-medium animate-pulse">Generating Candidate Intelligence...</p>
                            <p className="text-white/60 text-xl font-light italic">
                                "{facts[currentFactIndex]}"
                            </p>
                        </div>
                    </div>
                ) : preBriefError ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4 p-8">
                        <span className="text-5xl">⚠️</span>
                        <p className="text-white/80 text-lg">{preBriefError}</p>
                        <div className="flex gap-3">
                            <Button onClick={() => window.location.reload()} variant="outline" className="border-white/20">
                                🔄 Retry
                            </Button>
                            <Button onClick={() => onStartInterview(undefined)} className="bg-violet-600 hover:bg-violet-700">
                                Skip to Interview →
                            </Button>
                        </div>
                    </div>
                ) : preBrief ? (
                    <PreInterviewBriefComponent
                        brief={preBrief}
                        onActivateVoice={handleVoiceToggle}
                        isVoiceActive={isVoiceActive || isVoiceConnecting}
                    />
                ) : null}
            </div>

            {/* Footer hint */}
            {preBrief && (
                <div className="shrink-0 p-3 bg-slate-900/50 border-t border-white/5 text-center">
                    <p className="text-white/40 text-sm">
                        💡 Review the brief above, then click <strong className="text-emerald-400">Start Interview</strong> when ready
                    </p>
                </div>
            )}
        </div>
    );
}
