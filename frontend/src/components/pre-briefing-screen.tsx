"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Vapi from "@vapi-ai/web";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getBriefing } from "@/lib/api";

interface PreBriefingScreenProps {
    roomName: string;
    participantName: string;
    onStartInterview: () => void;
}

interface Message {
    role: "assistant" | "user";
    content: string;
}

export default function PreBriefingScreen({
    roomName,
    participantName,
    onStartInterview
}: PreBriefingScreenProps) {
    const vapiRef = useRef<Vapi | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [transcript, setTranscript] = useState<Message[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [briefingContext, setBriefingContext] = useState<string | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const hasStartedRef = useRef(false);

    // Fetch briefing from Python backend
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

    // Initialize Vapi and start agent
    useEffect(() => {
        const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;

        if (!publicKey) {
            setError("Vapi public key not configured. Add NEXT_PUBLIC_VAPI_PUBLIC_KEY to .env.local");
            return;
        }

        if (briefingContext === null || hasStartedRef.current) return;

        hasStartedRef.current = true;
        setIsStarting(true);

        const vapi = new Vapi(publicKey);
        vapiRef.current = vapi;

        // Event handlers
        vapi.on("call-start", () => {
            setIsConnected(true);
            setIsStarting(false);
            setError(null);
        });

        vapi.on("call-end", () => {
            setIsConnected(false);
            setIsSpeaking(false);
        });

        vapi.on("speech-start", () => {
            setIsSpeaking(true);
        });

        vapi.on("speech-end", () => {
            setIsSpeaking(false);
        });

        vapi.on("message", (message) => {
            if (message.type === "transcript" && message.transcriptType === "final") {
                setTranscript((prev) => [
                    ...prev,
                    { role: message.role, content: message.transcript },
                ]);
            }
        });

        vapi.on("error", (e) => {
            console.error("Vapi error:", JSON.stringify(e, null, 2));
            const errorObj = e as { error?: { message?: string } };
            setError(errorObj?.error?.message || "Agent connection error");
            setIsStarting(false);
        });

        // Start the agent
        const startAgent = async () => {
            try {
                console.log("[PreBriefing] Starting with context:", {
                    participantName,
                    briefingContextLength: briefingContext?.length || 0,
                });

                // Use saved assistant ID with dynamic context overrides
                await vapi.start("1d5854df-2a62-47c1-94db-81d8bdf28255", {
                    variableValues: {
                        participantName: participantName,
                        briefingContext: briefingContext || "No specific candidate information provided.",
                    },
                });

                console.log("[PreBriefing] vapi.start() completed successfully");
            } catch (err) {
                console.error("[PreBriefing] Failed to start Vapi:", err);
                setError(err instanceof Error ? err.message : "Failed to start agent");
                setIsStarting(false);
            }
        };

        startAgent();

        return () => {
            vapi.stop();
        };
    }, [briefingContext, participantName]);

    const handleStartInterview = useCallback(() => {
        // Stop Vapi agent
        vapiRef.current?.stop();
        // Transition to video room
        onStartInterview();
    }, [onStartInterview]);

    const handleSkipBriefing = useCallback(() => {
        vapiRef.current?.stop();
        onStartInterview();
    }, [onStartInterview]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-violet-950 via-slate-900 to-slate-950 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-white/10">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-semibold text-white">Pre-Interview Briefing</h1>
                        <p className="text-sm text-white/60">Room: {roomName}</p>
                    </div>
                    <Button
                        onClick={handleStartInterview}
                        size="lg"
                        className="bg-green-600 hover:bg-green-700 text-white"
                    >
                        🎬 Start Interview
                    </Button>
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="max-w-2xl w-full space-y-6">
                    {/* Agent status card */}
                    <Card className="bg-white/5 border-white/10 backdrop-blur">
                        <CardContent className="p-6">
                            {error ? (
                                <div className="text-center space-y-4">
                                    <div className="text-red-400">⚠️ {error}</div>
                                    <Button variant="outline" onClick={handleSkipBriefing}>
                                        Skip Briefing & Start Interview
                                    </Button>
                                </div>
                            ) : isStarting ? (
                                <div className="flex items-center justify-center gap-3 text-white/70">
                                    <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                                    <span>Connecting to briefing assistant...</span>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Status indicator */}
                                    <div className="flex items-center justify-center gap-3">
                                        <div className={`w-4 h-4 rounded-full ${isSpeaking ? "bg-green-500 animate-pulse" : isConnected ? "bg-green-500" : "bg-yellow-500"}`} />
                                        <span className="text-lg text-white">
                                            {isSpeaking ? "🗣️ Agent Speaking" : isConnected ? "🎧 Listening..." : "Connecting..."}
                                        </span>
                                    </div>

                                    {/* Transcript */}
                                    {transcript.length > 0 && (
                                        <div className="mt-4 max-h-64 overflow-y-auto space-y-3 p-4 bg-black/20 rounded-lg">
                                            {transcript.map((msg, i) => (
                                                <div
                                                    key={i}
                                                    className={`text-sm ${msg.role === "assistant" ? "text-violet-300" : "text-white"}`}
                                                >
                                                    <span className="font-medium">
                                                        {msg.role === "assistant" ? "🤖 Agent: " : "👤 You: "}
                                                    </span>
                                                    {msg.content}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Instructions */}
                    <div className="text-center text-white/50 text-sm space-y-2">
                        <p>💡 Ask the assistant anything about the upcoming interview.</p>
                        <p>Click <strong>"Start Interview"</strong> when you're ready to begin the video call.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
