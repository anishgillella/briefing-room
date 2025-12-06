"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Vapi from "@vapi-ai/web";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getBriefing } from "@/lib/api";

interface VapiAgentProps {
    isActive: boolean;
    onStop?: () => void;
    assistantId?: string;
    roomName?: string;
}

interface Message {
    role: "assistant" | "user";
    content: string;
}

export default function VapiAgent({
    isActive,
    onStop,
    assistantId,
    roomName
}: VapiAgentProps) {
    const vapiRef = useRef<Vapi | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [transcript, setTranscript] = useState<Message[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [briefingContext, setBriefingContext] = useState<string | null>(null);
    const hasStartedRef = useRef(false);

    // Fetch briefing from Python backend when roomName is available
    useEffect(() => {
        if (roomName && !briefingContext) {
            getBriefing(roomName)
                .then((data) => {
                    console.log("Fetched briefing from backend:", data);
                    setBriefingContext(data.briefing_prompt);
                })
                .catch((err) => {
                    console.error("Failed to fetch briefing:", err);
                    setBriefingContext("No specific candidate information was provided.");
                });
        }
    }, [roomName, briefingContext]);

    // Initialize Vapi instance only once
    useEffect(() => {
        const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;

        if (!publicKey) {
            setError("Vapi public key not configured");
            return;
        }

        // Only create one Vapi instance
        if (!vapiRef.current) {
            vapiRef.current = new Vapi(publicKey);
        }

        const vapi = vapiRef.current;

        // Event handlers
        const handleCallStart = () => {
            setIsConnected(true);
            setError(null);
        };

        const handleCallEnd = () => {
            setIsConnected(false);
            setIsSpeaking(false);
            hasStartedRef.current = false;
        };

        const handleSpeechStart = () => {
            setIsSpeaking(true);
        };

        const handleSpeechEnd = () => {
            setIsSpeaking(false);
        };

        const handleMessage = (message: { type: string; transcriptType?: string; role: "assistant" | "user"; transcript: string }) => {
            if (message.type === "transcript" && message.transcriptType === "final") {
                setTranscript((prev) => [
                    ...prev,
                    { role: message.role, content: message.transcript },
                ]);
            }
        };

        const handleError = (e: unknown) => {
            console.error("Vapi error (full):", JSON.stringify(e, null, 2));
            const errorObj = e as { message?: string; error?: { message?: string } };
            const message = errorObj?.message || errorObj?.error?.message || "Agent connection error";
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
    }, []);

    // Start/stop agent based on isActive
    useEffect(() => {
        const vapi = vapiRef.current;
        if (!vapi) return;

        if (isActive && !isConnected && briefingContext !== null && !hasStartedRef.current) {
            hasStartedRef.current = true;

            // Start the agent with briefing context from Python backend
            const startAgent = async () => {
                try {
                    // Use assistant ID if provided, otherwise use inline config
                    if (assistantId) {
                        await vapi.start(assistantId);
                    } else {
                        // Inline assistant configuration with all required fields
                        await vapi.start({
                            transcriber: {
                                provider: "deepgram",
                                model: "nova-2",
                                language: "en-US",
                            },
                            model: {
                                provider: "openai",
                                model: "gpt-4o-mini",
                                messages: [
                                    {
                                        role: "system",
                                        content: `You are a helpful pre-interview briefing assistant for interviewers. Your job is to help prepare the interviewer in the few minutes before the candidate joins.

${briefingContext}

Keep your responses concise and helpful. The candidate could join at any moment, so be efficient. When you're done briefing, let the interviewer know you'll automatically leave when the candidate arrives.

Start by introducing yourself briefly and asking how you can help prepare for the interview.`,
                                    },
                                ],
                            },
                            voice: {
                                provider: "11labs",
                                voiceId: "21m00Tcm4TlvDq8ikWAM",
                            },
                            firstMessage: "Hi! I'm your briefing assistant. I'm here to help you prepare before the candidate joins. What would you like to know?",
                        });
                    }
                } catch (err: unknown) {
                    console.error("Failed to start Vapi:", err);
                    const errorMessage = err instanceof Error ? err.message : "Failed to start agent";
                    setError(errorMessage);
                    hasStartedRef.current = false;
                }
            };
            startAgent();
        } else if (!isActive && isConnected) {
            // Stop the agent
            vapi.stop();
            onStop?.();
        }
    }, [isActive, isConnected, assistantId, briefingContext, onStop]);

    // Manual stop handler
    const handleStop = useCallback(() => {
        vapiRef.current?.stop();
        hasStartedRef.current = false;
        onStop?.();
    }, [onStop]);

    if (error) {
        return (
            <Card className="bg-destructive/10 border-destructive">
                <CardContent className="p-4">
                    <p className="text-sm text-destructive">{error}</p>
                    <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                            setError(null);
                            hasStartedRef.current = false;
                        }}
                    >
                        Retry
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (!isActive && !isConnected) {
        return null;
    }

    return (
        <Card className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-500/30">
            <CardContent className="p-4 space-y-3">
                {/* Header with status */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${isSpeaking ? "bg-green-500 animate-pulse" : isConnected ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`} />
                        <span className="text-sm font-medium">
                            {isSpeaking ? "🗣️ Agent Speaking" : isConnected ? "🎧 Agent Listening" : "⏳ Connecting..."}
                        </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleStop}>
                        End Briefing
                    </Button>
                </div>

                {/* Transcript */}
                {transcript.length > 0 && (
                    <div className="max-h-32 overflow-y-auto space-y-2 text-sm">
                        {transcript.slice(-3).map((msg, i) => (
                            <div key={i} className={`${msg.role === "assistant" ? "text-violet-600 dark:text-violet-400" : "text-foreground"}`}>
                                <span className="font-medium">{msg.role === "assistant" ? "Agent: " : "You: "}</span>
                                {msg.content}
                            </div>
                        ))}
                    </div>
                )}

                {/* Help text */}
                <p className="text-xs text-muted-foreground">
                    💡 The agent will automatically leave when the candidate joins.
                </p>
            </CardContent>
        </Card>
    );
}
