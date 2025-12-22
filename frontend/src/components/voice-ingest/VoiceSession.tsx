"use client";

import { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import { Mic, MicOff, PhoneOff, Volume2, VolumeX, Loader2, CheckCircle } from "lucide-react";

interface VoiceSessionProps {
    vapiPublicKey: string;
    assistantConfig?: {
        callId?: string;
        webCallUrl?: string;
        assistantId?: string;
        assistantOverrides?: {
            variableValues?: Record<string, string>;
            firstMessage?: string;
            metadata?: Record<string, any>;
        };
    };
    sessionId: string;
    onEnd?: () => void;
    onComplete?: () => void;
    isComplete?: boolean;
    onTranscript?: (speaker: 'user' | 'agent', text: string) => void;
}

export interface VoiceSessionRef {
    stopCall: () => void;
}

type ConnectionState = "connecting" | "connected" | "disconnected" | "failed";

const VoiceSession = forwardRef<VoiceSessionRef, VoiceSessionProps>(function VoiceSession({
    vapiPublicKey,
    assistantConfig,
    sessionId,
    onEnd,
    onComplete,
    isComplete = false,
    onTranscript,
}, ref) {
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
    const hasInitializedRef = useRef(false);
    const onTranscriptRef = useRef(onTranscript);

    // Keep ref updated
    useEffect(() => {
        onTranscriptRef.current = onTranscript;
    }, [onTranscript]);

    // Expose stopCall method to parent via ref
    useImperativeHandle(ref, () => ({
        stopCall: () => {
            console.log("[Vapi] stopCall called via ref");
            if (vapiRef.current) {
                try {
                    vapiRef.current.stop();
                    console.log("[Vapi] Call stopped via ref");
                } catch (err) {
                    console.error("[Vapi] Error stopping call via ref:", err);
                }
                vapiRef.current = null;
            }
            setConnectionState("disconnected");
            setIsAgentSpeaking(false);
        }
    }), []);

    // Memoize the assistant ID to prevent re-renders
    const assistantId = assistantConfig?.assistantId;

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

    // Initialize Vapi - only once
    useEffect(() => {
        // Prevent multiple initializations (React Strict Mode)
        if (hasInitializedRef.current || isConnectingRef.current) {
            console.log("[Vapi] Already initialized or connecting, skipping...");
            return;
        }

        if (!assistantId) {
            console.error("[Vapi] No assistant ID provided");
            setError("No assistant configuration provided");
            setConnectionState("failed");
            return;
        }

        const initVapi = async () => {
            isConnectingRef.current = true;
            hasInitializedRef.current = true;

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
                    setIsAgentSpeaking(true);
                });

                vapi.on("speech-end", () => {
                    setIsAgentSpeaking(false);
                });

                vapi.on("message", (message: any) => {
                    // Handle transcript messages
                    if (message.type === "transcript") {
                        const role = message.role === "assistant" ? "agent" : "user";
                        const text = message.transcript;

                        if (message.transcriptType === "final") {
                            setTranscript((prev) => [...prev, { role, text }]);
                            onTranscriptRef.current?.(role as 'user' | 'agent', text);
                        }
                    }
                });

                vapi.on("error", (err: any) => {
                    console.error("[Vapi] Error object:", err);
                    console.error("[Vapi] Error JSON:", JSON.stringify(err, null, 2));

                    // Extract error message safely - ensure it's always a string
                    let errorMsg = "Voice call error";
                    if (typeof err === "string") {
                        errorMsg = err;
                    } else if (typeof err?.message === "string") {
                        errorMsg = err.message;
                    } else if (typeof err?.error?.message === "string") {
                        errorMsg = err.error.message;
                    } else if (typeof err?.error === "string") {
                        errorMsg = err.error;
                    } else if (err?.statusCode) {
                        errorMsg = `Voice call error (status ${err.statusCode})`;
                    } else {
                        // If we can't find a standard message, stringify the whole thing
                        errorMsg = JSON.stringify(err);
                    }
                    setError(errorMsg);
                    setConnectionState("failed");
                });

                // Start the call with metadata containing sessionId
                console.log("[Vapi] Starting call with assistant:", assistantId, "sessionId:", sessionId);

                try {
                    // Build assistantOverrides - Vapi SDK expects this directly as second argument
                    // NOT wrapped in an object with metadata at root level
                    const assistantOverrides: any = {
                        metadata: {
                            sessionId: sessionId,
                        }
                    };

                    // Merge with provided overrides if any
                    if (assistantConfig?.assistantOverrides) {
                        // Copy all overrides
                        Object.assign(assistantOverrides, assistantConfig.assistantOverrides);
                        // Merge metadata (ensure sessionId is included)
                        assistantOverrides.metadata = {
                            ...assistantConfig.assistantOverrides.metadata,
                            sessionId: sessionId,
                        };
                    }

                    console.log("[Vapi] Assistant overrides:", JSON.stringify(assistantOverrides, null, 2));
                    // Pass assistantOverrides directly as second argument (NOT wrapped in options object)
                    await vapi.start(assistantId, assistantOverrides);
                    console.log("[Vapi] Call initiated successfully");
                } catch (startErr: any) {
                    console.error("[Vapi] Start failed:", startErr);
                    throw startErr;
                }

            } catch (err: any) {
                console.error("[Vapi] Initialization error:", err);
                // Extract error message safely - ensure it's always a string
                let errorMsg = "Failed to start voice call";
                if (typeof err === "string") {
                    errorMsg = err;
                } else if (typeof err?.message === "string") {
                    errorMsg = err.message;
                } else if (typeof err?.error?.message === "string") {
                    errorMsg = err.error.message;
                } else if (typeof err?.error === "string") {
                    errorMsg = err.error;
                }
                setError(errorMsg);
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
                    // Ignore cleanup errors
                }
                vapiRef.current = null;
            }
        };
    }, [vapiPublicKey, assistantId]); // Only depend on stable values

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
                            className={`w-32 h-32 rounded-full flex items-center justify-center mx-auto transition-all duration-300 ${isAgentSpeaking
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
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all cursor-pointer ${isMuted
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
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all cursor-pointer ${!isSpeakerOn
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
                            onClick={() => {
                                // Stop the voice call first
                                if (vapiRef.current) {
                                    try {
                                        vapiRef.current.stop();
                                        console.log("[Vapi] Call stopped on complete");
                                    } catch (err) {
                                        console.error("[Vapi] Error stopping call:", err);
                                    }
                                }
                                // Then trigger complete callback
                                onComplete();
                            }}
                            className="mt-8 w-full py-4 rounded-full bg-green-500 text-white font-semibold hover:bg-green-600 transition-all shadow-[0_0_30px_rgba(34,197,94,0.3)] flex items-center justify-center gap-2"
                        >
                            <CheckCircle className="w-5 h-5" />
                            Finish & Review
                        </button>
                    )}

                </div>
            )}

            {connectionState === "disconnected" && (
                <div className="text-center animate-fade-in">
                    <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-10 h-10 text-green-400" />
                    </div>
                    <h3 className="text-xl font-medium text-white mb-2">Session Ended</h3>
                    <p className="text-white/50 text-sm mb-6">Your voice session has been completed</p>

                    {/* Always show Finish & Review button when session ends */}
                    {onComplete && (
                        <button
                            onClick={onComplete}
                            className="px-8 py-4 rounded-full bg-green-500 text-white font-semibold hover:bg-green-600 transition-all shadow-[0_0_30px_rgba(34,197,94,0.3)] flex items-center justify-center gap-2 mx-auto"
                        >
                            <CheckCircle className="w-5 h-5" />
                            Finish & Review
                        </button>
                    )}

                    {/* Fallback if no onComplete handler */}
                    {!onComplete && onEnd && (
                        <button
                            onClick={onEnd}
                            className="px-8 py-4 rounded-full bg-white/10 text-white font-medium hover:bg-white/20 transition-all flex items-center justify-center gap-2 mx-auto"
                        >
                            Continue
                        </button>
                    )}
                </div>
            )}
        </div>
    );
});

export default VoiceSession;
