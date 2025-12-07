/**
 * OpenAI Realtime Agent Hook
 * 
 * Connects to OpenAI's Realtime API via WebRTC for AI candidate voice.
 * This DOES NOT use Daily.co internally, so it can run alongside the video room.
 */

"use client";

// Set to true for verbose logging during development
const DEBUG = false;

import { useState, useEffect, useRef, useCallback } from "react";

interface RealtimeAgentProps {
    isActive: boolean;
    roomName: string;
    candidateName?: string;
    role?: string;
    resume?: string;
    jobDescription?: string;
    onTranscriptUpdate?: (transcript: TranscriptMessage[]) => void;
    onStop?: () => void;
}

interface TranscriptMessage {
    role: "user" | "assistant";
    content: string;
    timestamp: number;
}

interface RealtimeAgentState {
    isConnected: boolean;
    isSpeaking: boolean;
    error: string | null;
    transcript: TranscriptMessage[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function useOpenAIRealtimeAgent({
    isActive,
    roomName,
    candidateName = "Candidate",
    role = "this position",
    resume = "",
    jobDescription = "",
    onTranscriptUpdate,
    onStop,
}: RealtimeAgentProps): RealtimeAgentState & { stop: () => void } {
    const [isConnected, setIsConnected] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);

    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const dataChannelRef = useRef<RTCDataChannel | null>(null);
    const audioElementRef = useRef<HTMLAudioElement | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const hasStartedRef = useRef(false);
    const isActiveRef = useRef(isActive);

    // Keep isActiveRef in sync
    useEffect(() => {
        isActiveRef.current = isActive;
    }, [isActive]);

    // Update parent with transcript
    useEffect(() => {
        if (onTranscriptUpdate && transcript.length > 0) {
            onTranscriptUpdate(transcript);
        }
    }, [transcript, onTranscriptUpdate]);

    // Handle realtime events - defined outside to avoid recreation
    const handleRealtimeEvent = useCallback((event: Record<string, unknown>) => {
        const type = event.type as string;

        // Log ALL events for debugging
        DEBUG && console.log("[RealtimeAgent] Event:", type, event);

        switch (type) {
            case "session.created":
                DEBUG && console.log("[RealtimeAgent] Session created by server");
                break;

            case "session.updated":
                DEBUG && console.log("[RealtimeAgent] Session config updated");
                break;

            case "response.created":
                DEBUG && console.log("[RealtimeAgent] Response started");
                break;

            case "response.audio.delta":
                setIsSpeaking(true);
                break;

            case "response.audio.done":
                setIsSpeaking(false);
                break;

            case "response.audio_transcript.delta":
                // Partial transcript - could show in UI
                break;

            case "response.audio_transcript.done":
                // AI finished speaking - add to transcript
                const aiText = event.transcript as string;
                if (aiText) {
                    DEBUG && console.log("[RealtimeAgent] AI said:", aiText);
                    setTranscript((prev) => [
                        ...prev,
                        { role: "assistant", content: aiText, timestamp: Date.now() },
                    ]);
                }
                break;

            case "input_audio_buffer.speech_started":
                DEBUG && console.log("[RealtimeAgent] User started speaking");
                break;

            case "input_audio_buffer.speech_stopped":
                DEBUG && console.log("[RealtimeAgent] User stopped speaking");
                break;

            case "conversation.item.input_audio_transcription.completed":
                // User finished speaking - add to transcript
                const userText = event.transcript as string;
                if (userText) {
                    DEBUG && console.log("[RealtimeAgent] User said:", userText);
                    setTranscript((prev) => [
                        ...prev,
                        { role: "user", content: userText, timestamp: Date.now() },
                    ]);
                }
                break;

            case "conversation.item.input_audio_transcription.failed":
                // Log the full error to understand why transcription failed
                console.error("[RealtimeAgent] Transcription FAILED:", JSON.stringify(event.error, null, 2));
                console.error("[RealtimeAgent] Failed item_id:", event.item_id);
                break;

            case "response.done":
                // Log the full response to see if it contains audio
                const response = event.response as Record<string, unknown>;
                DEBUG && console.log("[RealtimeAgent] Response completed, output:", response?.output);
                DEBUG && console.log("[RealtimeAgent] Response status:", response?.status);
                if (response?.status_details) {
                    DEBUG && console.log("[RealtimeAgent] Status details:", JSON.stringify(response.status_details, null, 2));
                }
                setIsSpeaking(false);
                break;

            case "error":
                console.error("[RealtimeAgent] Server error:", event.error);
                setError(JSON.stringify(event.error));
                break;

            default:
                // Log unknown events
                if (type && !type.startsWith("response.audio.delta")) {
                    DEBUG && console.log("[RealtimeAgent] Unhandled event:", type);
                }
        }
    }, []);

    // Stop the connection
    const stop = useCallback(() => {
        DEBUG && console.log("[RealtimeAgent] Stopping...");

        // Stop media tracks
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }

        if (dataChannelRef.current) {
            dataChannelRef.current.close();
            dataChannelRef.current = null;
        }

        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        if (audioElementRef.current) {
            audioElementRef.current.srcObject = null;
            audioElementRef.current = null;
        }

        setIsConnected(false);
        setIsSpeaking(false);
        hasStartedRef.current = false;

        if (onStop) {
            onStop();
        }
    }, [onStop]);

    // Main connection effect
    useEffect(() => {
        if (!isActive) {
            if (hasStartedRef.current) {
                stop();
            }
            return;
        }

        if (hasStartedRef.current) {
            return;
        }

        hasStartedRef.current = true;

        const startSession = async () => {
            try {
                DEBUG && console.log("[RealtimeAgent] Starting session...");
                setError(null);

                // 1. Get ephemeral token from our backend
                const tokenResponse = await fetch(`${API_URL}/api/realtime/session`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        candidate_name: candidateName,
                        role: role,
                        resume: resume,
                        job_description: jobDescription,
                    }),
                });

                if (!tokenResponse.ok) {
                    const errorText = await tokenResponse.text();
                    throw new Error(`Failed to get session token: ${errorText}`);
                }

                const { client_secret: ephemeralKey } = await tokenResponse.json();
                DEBUG && console.log("[RealtimeAgent] Got ephemeral key");

                // 2. Create peer connection with STUN servers
                const pc = new RTCPeerConnection({
                    iceServers: [
                        { urls: "stun:stun.l.google.com:19302" },
                    ],
                });
                peerConnectionRef.current = pc;

                // Monitor connection state
                pc.onconnectionstatechange = () => {
                    DEBUG && console.log("[RealtimeAgent] Connection state:", pc.connectionState);
                    if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
                        setError(`Connection ${pc.connectionState}`);
                        setIsConnected(false);
                    }
                };

                pc.oniceconnectionstatechange = () => {
                    DEBUG && console.log("[RealtimeAgent] ICE state:", pc.iceConnectionState);
                };

                // 3. Set up audio playback
                const audioEl = document.createElement("audio");
                audioEl.autoplay = true;
                audioElementRef.current = audioEl;
                document.body.appendChild(audioEl); // Append to DOM for autoplay

                pc.ontrack = (event) => {
                    DEBUG && console.log("[RealtimeAgent] Got audio track from server");
                    audioEl.srcObject = event.streams[0];
                };

                // 4. Get user microphone
                DEBUG && console.log("[RealtimeAgent] Requesting microphone...");
                const mediaStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                });
                mediaStreamRef.current = mediaStream;
                DEBUG && console.log("[RealtimeAgent] Got microphone access");

                // Add audio track to peer connection
                mediaStream.getTracks().forEach((track) => {
                    DEBUG && console.log("[RealtimeAgent] Adding audio track to peer connection");
                    pc.addTrack(track, mediaStream);
                });

                // 5. Create data channel for events
                const dataChannel = pc.createDataChannel("oai-events");
                dataChannelRef.current = dataChannel;

                dataChannel.onopen = () => {
                    DEBUG && console.log("[RealtimeAgent] Data channel open - sending initial message");
                    setIsConnected(true);

                    // Wait a moment then send initial response.create to start the conversation
                    setTimeout(() => {
                        if (dataChannel.readyState === "open") {
                            DEBUG && console.log("[RealtimeAgent] Sending response.create");
                            dataChannel.send(JSON.stringify({
                                type: "response.create",
                                response: {
                                    modalities: ["audio", "text"],
                                },
                            }));
                        }
                    }, 500);
                };

                dataChannel.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        handleRealtimeEvent(data);
                    } catch (e) {
                        console.error("[RealtimeAgent] Failed to parse event:", e);
                    }
                };

                dataChannel.onerror = (event) => {
                    console.error("[RealtimeAgent] Data channel error:", event);
                    setError("Data channel error");
                };

                dataChannel.onclose = () => {
                    DEBUG && console.log("[RealtimeAgent] Data channel closed");
                    // Only update state if we're still supposed to be active
                    if (isActiveRef.current) {
                        setIsConnected(false);
                    }
                };

                // 6. Create and set local description
                DEBUG && console.log("[RealtimeAgent] Creating offer...");
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                DEBUG && console.log("[RealtimeAgent] Local description set");

                // 7. Send offer to OpenAI Realtime API
                DEBUG && console.log("[RealtimeAgent] Sending offer to OpenAI...");
                const sdpResponse = await fetch(
                    "https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${ephemeralKey}`,
                            "Content-Type": "application/sdp",
                        },
                        body: offer.sdp,
                    }
                );

                if (!sdpResponse.ok) {
                    const errorText = await sdpResponse.text();
                    throw new Error(`OpenAI SDP error: ${errorText}`);
                }

                const answerSdp = await sdpResponse.text();
                DEBUG && console.log("[RealtimeAgent] Got answer SDP from OpenAI");

                await pc.setRemoteDescription({
                    type: "answer",
                    sdp: answerSdp,
                });

                DEBUG && console.log("[RealtimeAgent] WebRTC connection established!");

            } catch (err) {
                console.error("[RealtimeAgent] Error:", err);
                setError(err instanceof Error ? err.message : "Failed to start session");
                hasStartedRef.current = false;
            }
        };

        startSession();

        // Cleanup function - only runs when effect is cleaned up
        return () => {
            DEBUG && console.log("[RealtimeAgent] Effect cleanup");
        };
    }, [isActive, candidateName, role, resume, jobDescription, handleRealtimeEvent, stop]);

    return {
        isConnected,
        isSpeaking,
        error,
        transcript,
        stop,
    };
}
