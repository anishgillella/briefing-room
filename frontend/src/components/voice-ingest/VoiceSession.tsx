"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, PhoneOff, Volume2, VolumeX, Loader2, CheckCircle } from "lucide-react";

interface VoiceSessionProps {
    vapiPublicKey: string;
    assistantConfig?: {
        callId?: string;
        webCallUrl?: string;
        assistantId?: string;
    };
    sessionId: string;
    onEnd?: () => void;
    onComplete?: () => void;
    isComplete?: boolean;
    onTranscript?: (speaker: 'user' | 'agent', text: string) => void;
}

type ConnectionState = "connecting" | "connected" | "disconnected" | "failed";

export default function VoiceSession({
    vapiPublicKey,
    assistantConfig,
    sessionId,
    onEnd,
    onComplete,
    isComplete = false,
    onTranscript,
}: VoiceSessionProps) {
    const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
    const [isMuted, setIsMuted] = useState(false);
    const [isSpeakerOn, setIsSpeakerOn] = useState(true);
    const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
    const [duration, setDuration] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [transcript, setTranscript] = useState<Array<{ role: string; text: string }>>([]);

    const vapiRef = useRef<any>(null);
    const startTimeRef = useRef<number | null>(null);
    const isConnectingRef = useRef(false);

    // Duration timer
    useEffect(() => {
        if (connectionState !== "connected") return;

        startTimeRef.current = Date.now();
        const interval = setInterval(() => {
            if (startTimeRef.current) {
                setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [connectionState]);

    // Initialize Vapi
    useEffect(() => {
        if (isConnectingRef.current) {
            console.log("[Vapi] Already connecting, skipping...");
            return;
        }

        const initVapi = async () => {
            isConnectingRef.current = true;

            try {
                setConnectionState("connecting");
                setError(null);

                // Dynamically import Vapi Web SDK
                const VapiSDK = (await import("@vapi-ai/web")).default;

                // Create Vapi instance
                const vapi = new VapiSDK(vapiPublicKey);
                vapiRef.current = vapi;

                // Event handlers
                vapi.on("call-start", () => {
                    console.log("[Vapi] Call started");
                    setConnectionState("connected");
                });

                vapi.on("call-end", () => {
                    console.log("[Vapi] Call ended");
                    setConnectionState("disconnected");
                });

                vapi.on("speech-start", () => {
                    console.log("[Vapi] Agent speaking");
                    setIsAgentSpeaking(true);
                });

                vapi.on("speech-end", () => {
                    console.log("[Vapi] Agent stopped speaking");
                    setIsAgentSpeaking(false);
                });

                vapi.on("message", (message: any) => {
                    console.log("[Vapi] Message:", message);

                    // Handle transcript messages
                    if (message.type === "transcript") {
                        const role = message.role === "assistant" ? "agent" : "user";
                        const text = message.transcript;

                        if (message.transcriptType === "final") {
                            setTranscript((prev) => [...prev, { role, text }]);
                            onTranscript?.(role as 'user' | 'agent', text);
                        }
                    }

                    // Handle conversation updates
                    if (message.type === "conversation-update") {
                        console.log("[Vapi] Conversation update:", message.conversation);
                    }
                });

                vapi.on("error", (err: any) => {
                    console.error("[Vapi] Error:", err);
                    setError(err.message || "Voice call error");
                    setConnectionState("failed");
                });

                vapi.on("volume-level", (volume: number) => {
                    // Could use for visual feedback
                });

                // Start the call
                console.log("[Vapi] Starting call with config:", assistantConfig);

                if (assistantConfig?.webCallUrl) {
                    // If we have a web call URL, the call is already created
                    // Just need to join it - but Vapi Web SDK doesn't support this directly
                    // We'll start a new call with the assistant ID instead
                    if (assistantConfig.assistantId) {
                        await vapi.start(assistantConfig.assistantId);
                    } else {
                        // Start without assistant ID - will use the configured assistant
                        await vapi.start();
                    }
                } else if (assistantConfig?.assistantId) {
                    await vapi.start(assistantConfig.assistantId);
                } else {
                    // This means we need to pass assistant config inline
                    // The backend should have created the call with the context
                    throw new Error("No assistant configuration provided");
                }

                console.log("[Vapi] Call initiated");

            } catch (err) {
                console.error("[Vapi] Initialization error:", err);
                setError(err instanceof Error ? err.message : "Failed to start voice call");
                setConnectionState("failed");
            } finally {
                isConnectingRef.current = false;
            }
        };

        initVapi();

        return () => {
            console.log("[Vapi] Cleanup: stopping call");
            if (vapiRef.current) {
                try {
                    vapiRef.current.stop();
                } catch (e) {
                    console.warn("[Vapi] Error stopping call:", e);
                }
                vapiRef.current = null;
            }
            isConnectingRef.current = false;
        };
    }, [vapiPublicKey, assistantConfig, onTranscript]);

    // Toggle mute
    const toggleMute = useCallback(() => {
        console.log("[Vapi] Toggle mute clicked");
        if (!vapiRef.current) {
            console.warn("[Vapi] No Vapi instance for mute toggle");
            return;
        }

        const newMuted = !isMuted;
        vapiRef.current.setMuted(newMuted);
        setIsMuted(newMuted);
        console.log("[Vapi] Mute toggled:", newMuted);
    }, [isMuted]);

    // Toggle speaker (Vapi handles audio output automatically)
    const toggleSpeaker = useCallback(() => {
        console.log("[Vapi] Toggle speaker clicked");
        // Note: Vapi handles audio output automatically
        // This is more of a UI toggle for user feedback
        setIsSpeakerOn(!isSpeakerOn);
    }, [isSpeakerOn]);

    // End call
    const handleEndCall = useCallback(() => {
        console.log("[Vapi] End call clicked");
        if (vapiRef.current) {
            try {
                vapiRef.current.stop();
                console.log("[Vapi] Call stopped");
            } catch (err) {
                console.error("[Vapi] Error stopping call:", err);
            }
        }
        setConnectionState("disconnected");
        onEnd?.();
    }, [onEnd]);

    // Format duration
    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    return (
        <div className="flex flex-col items-center justify-center h-full py-12">
            {/* Connection State */}
            {connectionState === "connecting" && (
                <div className="text-center animate-fade-in">
                    <div className="w-24 h-24 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-6 animate-pulse">
                        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                    </div>
                    <h3 className="text-xl font-medium text-white mb-2">Connecting...</h3>
                    <p className="text-white/50 text-sm">Setting up your voice session</p>
                </div>
            )}

            {connectionState === "failed" && (
                <div className="text-center animate-fade-in">
                    <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                        <PhoneOff className="w-10 h-10 text-red-400" />
                    </div>
                    <h3 className="text-xl font-medium text-red-400 mb-2">Connection Failed</h3>
                    <p className="text-white/50 text-sm mb-6">{error || "Unable to establish voice connection"}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"
                    >
                        Try Again
                    </button>
                </div>
            )}

            {connectionState === "connected" && (
                <div className="text-center animate-fade-in w-full max-w-sm">
                    {/* Avatar with Speaking Indicator */}
                    <div className="relative mx-auto mb-8">
                        <div
                            className={`w-32 h-32 rounded-full flex items-center justify-center mx-auto transition-all duration-300 ${
                                isAgentSpeaking
                                    ? "bg-indigo-500 shadow-[0_0_60px_rgba(99,102,241,0.5)]"
                                    : "bg-indigo-500/20"
                            }`}
                        >
                            <span className="text-4xl">
                                {isAgentSpeaking ? "🗣️" : "🤖"}
                            </span>
                        </div>
                        {/* Speaking rings */}
                        {isAgentSpeaking && (
                            <>
                                <div className="absolute inset-0 rounded-full border-2 border-indigo-500/50 animate-ping" />
                                <div className="absolute inset-[-8px] rounded-full border border-indigo-500/30 animate-pulse" />
                            </>
                        )}
                    </div>

                    {/* Status */}
                    <div className="mb-8">
                        {isComplete ? (
                            <div className="flex items-center justify-center gap-2 text-green-400">
                                <CheckCircle className="w-5 h-5" />
                                <span className="font-medium">Profile Complete!</span>
                            </div>
                        ) : (
                            <div className="text-white/50 text-sm">
                                {isAgentSpeaking ? "AI is speaking..." : "Listening..."}
                            </div>
                        )}
                        <div className="text-white/30 text-xs mt-1 font-mono">
                            {formatDuration(duration)}
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-center gap-4">
                        {/* Mute Button */}
                        <button
                            type="button"
                            onClick={toggleMute}
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                                isMuted
                                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                    : "bg-white/10 text-white hover:bg-white/20"
                            }`}
                        >
                            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                        </button>

                        {/* End Call Button */}
                        <button
                            type="button"
                            onClick={handleEndCall}
                            className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all shadow-[0_0_30px_rgba(239,68,68,0.3)] cursor-pointer"
                        >
                            <PhoneOff className="w-7 h-7" />
                        </button>

                        {/* Speaker Button */}
                        <button
                            type="button"
                            onClick={toggleSpeaker}
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                                !isSpeakerOn
                                    ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                                    : "bg-white/10 text-white hover:bg-white/20"
                            }`}
                        >
                            {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                        </button>
                    </div>

                    {/* Complete Button */}
                    {isComplete && onComplete && (
                        <button
                            onClick={onComplete}
                            className="mt-8 w-full py-4 rounded-full bg-green-500 text-white font-semibold hover:bg-green-600 transition-all shadow-[0_0_30px_rgba(34,197,94,0.3)] flex items-center justify-center gap-2"
                        >
                            <CheckCircle className="w-5 h-5" />
                            Finish & Review
                        </button>
                    )}

                    {/* Transcript Preview */}
                    {transcript.length > 0 && (
                        <div className="mt-6 max-h-32 overflow-y-auto text-left bg-white/5 rounded-xl p-4">
                            {transcript.slice(-3).map((item, idx) => (
                                <div key={idx} className="text-sm mb-2">
                                    <span className={`font-medium ${item.role === 'agent' ? 'text-indigo-400' : 'text-green-400'}`}>
                                        {item.role === 'agent' ? 'AI' : 'You'}:
                                    </span>{' '}
                                    <span className="text-white/70">{item.text}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {connectionState === "disconnected" && (
                <div className="text-center animate-fade-in">
                    <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-6">
                        <PhoneOff className="w-10 h-10 text-white/40" />
                    </div>
                    <h3 className="text-xl font-medium text-white mb-2">Session Ended</h3>
                    <p className="text-white/50 text-sm">Your voice session has been completed</p>
                </div>
            )}
        </div>
    );
}
