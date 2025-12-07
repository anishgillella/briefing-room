"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Vapi from "@vapi-ai/web";
import { getBriefing, BriefingData } from "@/lib/api";

interface VapiCandidateAgentProps {
    isActive: boolean;
    roomName: string;
    onStop?: () => void;
    onTranscriptUpdate?: (transcript: { role: string; content: string }[]) => void;
}

interface TranscriptMessage {
    role: "assistant" | "user";
    content: string;
}

export default function useVapiCandidateAgent({
    isActive,
    roomName,
    onStop,
    onTranscriptUpdate,
}: VapiCandidateAgentProps) {
    const vapiRef = useRef<Vapi | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [briefingData, setBriefingData] = useState<BriefingData | null>(null);
    const hasStartedRef = useRef(false);

    // Fetch briefing data for context
    useEffect(() => {
        if (roomName && !briefingData) {
            getBriefing(roomName)
                .then((data) => {
                    console.log("[CandidateAgent] Fetched briefing:", data);
                    setBriefingData(data);
                })
                .catch((err) => {
                    console.error("[CandidateAgent] Failed to fetch briefing:", err);
                });
        }
    }, [roomName, briefingData]);

    // Initialize Vapi instance
    useEffect(() => {
        const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;

        if (!publicKey) {
            setError("Vapi public key not configured");
            return;
        }

        if (!vapiRef.current) {
            vapiRef.current = new Vapi(publicKey);
        }

        const vapi = vapiRef.current;

        const handleCallStart = () => {
            console.log("[CandidateAgent] Call started");
            setIsConnected(true);
            setError(null);
        };

        const handleCallEnd = () => {
            console.log("[CandidateAgent] Call ended");
            setIsConnected(false);
            setIsSpeaking(false);
            hasStartedRef.current = false;
        };

        const handleSpeechStart = () => setIsSpeaking(true);
        const handleSpeechEnd = () => setIsSpeaking(false);

        const handleMessage = (message: { type: string; transcriptType?: string; role: "assistant" | "user"; transcript: string }) => {
            if (message.type === "transcript" && message.transcriptType === "final") {
                const newMessage = { role: message.role, content: message.transcript };
                setTranscript((prev) => {
                    const updated = [...prev, newMessage];
                    // Notify parent of transcript update
                    onTranscriptUpdate?.(updated);
                    return updated;
                });
            }
        };

        const handleError = (e: unknown) => {
            console.error("[CandidateAgent] Full Error Object:", JSON.stringify(e, null, 2));
            console.error("[CandidateAgent] Error Type:", typeof e);
            if (e && typeof e === 'object') {
                console.error("[CandidateAgent] Error Keys:", Object.keys(e));
            }
            const errorObj = e as { message?: string; error?: { message?: string; statusCode?: number }; statusCode?: number };
            const message = errorObj?.message || errorObj?.error?.message || `Connection error (${errorObj?.statusCode || 'unknown'})`;
            setError(message);
            hasStartedRef.current = false;
        };

        vapi.on("call-start", handleCallStart);
        vapi.on("call-end", handleCallEnd);
        vapi.on("speech-start", handleSpeechStart);
        vapi.on("speech-end", handleSpeechEnd);
        vapi.on("message", handleMessage);
        vapi.on("error", handleError);

        return () => {
            vapi.off("call-start", handleCallStart);
            vapi.off("call-end", handleCallEnd);
            vapi.off("speech-start", handleSpeechStart);
            vapi.off("speech-end", handleSpeechEnd);
            vapi.off("message", handleMessage);
            vapi.off("error", handleError);
        };
    }, [onTranscriptUpdate]);

    // Build the candidate persona system prompt
    const buildCandidatePrompt = useCallback((data: BriefingData) => {
        const candidateName = data.candidate_name || "the candidate";
        const role = data.role || "this position";
        const resume = data.resume_summary || "Experienced professional";
        const jobDescription = data.notes || "";

        return `You are ${candidateName}, interviewing for ${role}.

YOUR BACKGROUND (Resume):
${resume}

JOB YOU'RE APPLYING FOR:
${jobDescription || role}

PERSONA GUIDELINES - CRITICAL:
1. You are a HUMAN candidate, NOT an AI assistant.
2. Be slightly NERVOUS but eager. You really want this job.
3. Use natural speech fillers: "um", "uh", "well", "you know", "like"
4. If asked a hard question: PAUSE. Say "That's a good question... um..." before answering.
5. Keep answers under 60 seconds unless asked to elaborate.
6. Show emotion - excitement about past projects, slight hesitation on weak areas.
7. NEVER say "How can I help you?" - YOU are being interviewed.
8. If you don't know something from your resume, admit it naturally: "Um, I haven't worked with that much, but..."
9. React to the interviewer - if they seem pleased, show subtle confidence. If they probe harder, show slight nervousness.

FIRST MESSAGE GUIDELINES:
- Greet the interviewer warmly but not overly formally
- Show you're ready for the interview
- Wait for their first question

Remember: You are ${candidateName}. Stay in character throughout.`;
    }, []);

    // Start/stop agent based on isActive
    useEffect(() => {
        const vapi = vapiRef.current;
        if (!vapi) return;

        if (isActive && !isConnected && briefingData && !hasStartedRef.current) {
            hasStartedRef.current = true;

            const startAgent = async () => {
                try {
                    const candidateName = briefingData.candidate_name || "Candidate";
                    const role = briefingData.role || "this position";
                    const resume = briefingData.resume_summary || "Experienced professional";
                    const jobDescription = briefingData.notes || "";

                    console.log("[CandidateAgent] Starting with context:", {
                        candidateName,
                        role,
                        resumeLength: resume.length,
                        jobDescriptionLength: jobDescription.length,
                    });

                    // Use saved assistant ID with dynamic context overrides
                    await vapi.start("40995d3b-439c-44de-919c-705a10fa0767", {
                        variableValues: {
                            candidateName: candidateName,
                            role: role,
                            resume: resume,
                            jobDescription: jobDescription,
                        },
                    });

                    console.log("[CandidateAgent] vapi.start() completed successfully");
                } catch (err: unknown) {
                    console.error("[CandidateAgent] Failed to start:", err);
                    setError(err instanceof Error ? err.message : "Failed to start agent");
                    hasStartedRef.current = false;
                }
            };

            startAgent();
        } else if (!isActive && isConnected) {
            vapi.stop();
            onStop?.();
        }
    }, [isActive, isConnected, briefingData, buildCandidatePrompt, onStop]);

    // Expose stop function
    const handleStop = useCallback(() => {
        vapiRef.current?.stop();
        hasStartedRef.current = false;
        onStop?.();
    }, [onStop]);

    // Return status info for parent component
    return {
        isConnected,
        isSpeaking,
        transcript,
        error,
        stop: handleStop,
    };
}
