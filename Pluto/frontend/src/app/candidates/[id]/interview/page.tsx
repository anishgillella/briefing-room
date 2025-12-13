"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
    ArrowLeft,
    Mic,
    MicOff,
    PhoneOff,
    Loader2,
    MessageSquare,
    Send,
    AlertTriangle,
    Volume2,
    User,
    X,
    FileText,
    TrendingUp,
    AlertCircle,
    CheckCircle,
    Clock,
    Lightbulb,
    ChevronRight,
    Sparkles,
} from "lucide-react";

const API_URL = "http://localhost:8000";

interface Message {
    role: "user" | "assistant";
    content: string;
}

interface TranscriptItem {
    speaker: "interviewer" | "candidate";
    text: string;
    timestamp: Date;
}

interface Candidate {
    id: string;
    name: string;
    job_title: string;
    bio_summary: string;
    skills: string[];
    pros: string[];
    cons: string[];
    combined_score: number;
    tier: string;
    interview_questions: string[];
}

interface Analytics {
    overall_score?: number;
    recommendation?: string;
    strengths?: string[];
    areas_for_improvement?: string[];
    key_moments?: string[];
    summary?: string;
}

interface CoachSuggestion {
    last_question_type: string;
    answer_quality: "strong" | "adequate" | "weak" | "unclear";
    suggested_next_question: string;
    reasoning: string;
    should_change_topic: boolean;
    topic_suggestion: string | null;
}

export default function InterviewPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();

    const candidateId = params.id as string;
    const roomName = searchParams.get("room");

    // Core state
    const [candidate, setCandidate] = useState<Candidate | null>(null);
    const [candidateName, setCandidateName] = useState<string>("Candidate");
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [micEnabled, setMicEnabled] = useState(true);
    const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [aiSpeaking, setAiSpeaking] = useState(false);
    const [userSpeaking, setUserSpeaking] = useState(false);

    // UI state
    const [showProfilePopup, setShowProfilePopup] = useState(false);
    const [interviewEnded, setInterviewEnded] = useState(false);
    const [savingAnalytics, setSavingAnalytics] = useState(false);
    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [currentRoomName, setCurrentRoomName] = useState<string>("");
    const [interviewStartTime] = useState<number>(Date.now());

    // AI Chat state
    const [chatMessages, setChatMessages] = useState<Message[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [sendingChat, setSendingChat] = useState(false);

    // AI Suggestions state
    const [suggestions, setSuggestions] = useState<CoachSuggestion[]>([]);
    const [lastProcessedExchange, setLastProcessedExchange] = useState<string>("");
    const [loadingSuggestion, setLoadingSuggestion] = useState(false);

    // WebRTC Refs (same as Superposition)
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const dataChannelRef = useRef<RTCDataChannel | null>(null);
    const audioElementRef = useRef<HTMLAudioElement | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const transcriptRef = useRef<HTMLDivElement>(null);
    const hasStartedRef = useRef(false); // Prevent multiple starts

    useEffect(() => {
        if (hasStartedRef.current) return; // Prevent double initialization
        hasStartedRef.current = true;
        initializeInterview();
        return () => cleanup();
    }, [candidateId]);

    // Timer
    useEffect(() => {
        if (connected && !interviewEnded) {
            timerRef.current = setInterval(() => {
                setElapsedTime((prev) => prev + 1);
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [connected, interviewEnded]);

    // Auto-scroll transcript
    useEffect(() => {
        if (transcriptRef.current) {
            transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
        }
    }, [transcript]);

    // Coach Mode: Get AI suggestions after candidate answers
    useEffect(() => {
        if (transcript.length < 2 || !connected) return;

        const lastExchange = extractLastExchange();
        if (!lastExchange || lastExchange === lastProcessedExchange) return;

        const fetchSuggestion = async () => {
            setLoadingSuggestion(true);
            const elapsedMinutes = Math.floor((Date.now() - interviewStartTime) / 60000);

            const fullTranscript = transcript
                .map(item => `${item.speaker === "interviewer" ? "Interviewer" : candidateName}: ${item.text}`)
                .join("\n");

            try {
                const res = await fetch(`${API_URL}/api/coach/suggest`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        last_exchange: lastExchange,
                        full_transcript: fullTranscript,
                        elapsed_minutes: elapsedMinutes,
                        briefing_context: candidate ? `Role: ${candidate.job_title}. ${candidate.bio_summary}` : null
                    }),
                });

                if (res.ok) {
                    const suggestion = await res.json();
                    setSuggestions(prev => [suggestion, ...prev].slice(0, 5));
                    setLastProcessedExchange(lastExchange);
                }
            } catch (e) {
                console.error("Coach suggestion error:", e);
            } finally {
                setLoadingSuggestion(false);
            }
        };

        const timer = setTimeout(fetchSuggestion, 800);
        return () => clearTimeout(timer);
    }, [transcript, connected, lastProcessedExchange, interviewStartTime, candidateName, candidate]);

    const extractLastExchange = (): string | null => {
        if (transcript.length < 2) return null;

        let lastInterviewerIdx = -1;
        let lastCandidateIdx = -1;

        for (let i = transcript.length - 1; i >= 0; i--) {
            if (transcript[i].speaker === "candidate" && lastCandidateIdx === -1) {
                lastCandidateIdx = i;
            }
            if (transcript[i].speaker === "interviewer" && lastCandidateIdx !== -1 && lastInterviewerIdx === -1) {
                lastInterviewerIdx = i;
                break;
            }
        }

        if (lastInterviewerIdx !== -1 && lastCandidateIdx !== -1) {
            return `Interviewer: ${transcript[lastInterviewerIdx].text}\nCandidate: ${transcript[lastCandidateIdx].text}`;
        }
        return null;
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    // Handle WebRTC events from data channel
    const handleRealtimeEvent = useCallback((event: any) => {
        const type = event.type;

        // Log all events for debugging
        if (!type.includes("delta") && !type.includes("audio")) {
            console.log("[Realtime] Handling event:", type);
        }

        switch (type) {
            case "session.created":
                console.log("[Realtime] Session created by OpenAI");
                break;
            case "session.updated":
                console.log("[Realtime] Session updated");
                break;
            case "response.created":
                console.log("[Realtime] Response started");
                break;
            case "response.audio.delta":
                setAiSpeaking(true);
                break;
            case "response.audio.done":
                setAiSpeaking(false);
                break;
            case "response.audio_transcript.done":
                // AI finished speaking
                if (event.transcript) {
                    console.log("[Realtime] AI said:", event.transcript.slice(0, 50) + "...");
                    setTranscript(prev => [...prev, {
                        speaker: "candidate",
                        text: event.transcript,
                        timestamp: new Date()
                    }]);
                }
                break;
            case "input_audio_buffer.speech_started":
                console.log("[Realtime] User started speaking");
                setUserSpeaking(true);
                break;
            case "input_audio_buffer.speech_stopped":
                console.log("[Realtime] User stopped speaking");
                setUserSpeaking(false);
                break;
            case "conversation.item.input_audio_transcription.completed":
                // User finished speaking
                if (event.transcript) {
                    console.log("[Realtime] User said:", event.transcript.slice(0, 50) + "...");
                    setTranscript(prev => [...prev, {
                        speaker: "interviewer",
                        text: event.transcript,
                        timestamp: new Date()
                    }]);
                }
                break;
            case "response.done":
                setAiSpeaking(false);
                // Log response details to debug why no audio
                if (event.response) {
                    console.log("[Realtime] Response done - status:", event.response.status, "output:", event.response.output?.length || 0, "items");
                }
                break;
            case "conversation.item.input_audio_transcription.failed":
                console.error("[Realtime] Transcription FAILED:", JSON.stringify(event.error || event));
                break;
            case "error":
                console.error("[Realtime] Error from OpenAI:", event.error);
                setError(JSON.stringify(event.error));
                break;
        }
    }, []);

    const initializeInterview = async () => {
        try {
            setConnecting(true);

            // 1. Get candidate data
            const candidateRes = await fetch(`${API_URL}/api/pluto/candidates/${candidateId}`);
            if (!candidateRes.ok) throw new Error("Failed to fetch candidate");
            const candidateData = await candidateRes.json();
            setCandidate(candidateData);
            setCandidateName(candidateData.name);

            // 2. Get ephemeral token from /api/realtime/session (same as Superposition)
            const sessionRes = await fetch(`${API_URL}/api/realtime/session`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    candidate_name: candidateData.name,
                    role: candidateData.job_title || "this position",
                    resume: candidateData.bio_summary || "",
                    job_description: "",
                }),
            });

            if (!sessionRes.ok) {
                const errorText = await sessionRes.text();
                throw new Error(`Failed to create realtime session: ${errorText}`);
            }

            const { client_secret: ephemeralKey } = await sessionRes.json();
            console.log("[Realtime] Got ephemeral key");

            // 3. Create WebRTC connection (same as Superposition)
            const pc = new RTCPeerConnection({
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
            });
            peerConnectionRef.current = pc;

            pc.onconnectionstatechange = () => {
                console.log("[Realtime] Connection state:", pc.connectionState);
                if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
                    setError(`Connection ${pc.connectionState}`);
                    setConnected(false);
                }
            };

            // 4. Set up audio playback - CRITICAL for AI voice
            const audioEl = document.createElement("audio");
            audioEl.autoplay = true;
            audioElementRef.current = audioEl;
            // Keep as reference, don't need to add to DOM

            pc.ontrack = (event) => {
                console.log("[Realtime] Got audio track from server - streams:", event.streams.length);
                if (event.streams.length > 0) {
                    audioEl.srcObject = event.streams[0];
                    // Try to play and handle autoplay restrictions
                    audioEl.play()
                        .then(() => console.log("[Realtime] Audio playback started"))
                        .catch((e) => {
                            console.warn("[Realtime] Autoplay blocked, will play on interaction:", e);
                            // If autoplay blocked, try to unmute after a user gesture
                            const resumeAudio = () => {
                                audioEl.play();
                                document.removeEventListener('click', resumeAudio);
                            };
                            document.addEventListener('click', resumeAudio);
                        });
                } else {
                    console.warn("[Realtime] No streams in track event!");
                }
            };

            // 5. Get user microphone with proper settings
            console.log("[Realtime] Requesting microphone...");
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            mediaStreamRef.current = mediaStream;
            console.log("[Realtime] Got microphone access");

            // Add audio track to peer connection
            mediaStream.getTracks().forEach((track) => {
                pc.addTrack(track, mediaStream);
            });

            // 6. Create data channel for events
            const dataChannel = pc.createDataChannel("oai-events");
            dataChannelRef.current = dataChannel;

            dataChannel.onopen = () => {
                console.log("[Realtime] Data channel open - readyState:", dataChannel.readyState);
                setConnected(true);
                setConnecting(false);

                // Set initial chat message
                setChatMessages([{
                    role: "assistant",
                    content: "I'm here to help during the interview. Ask me for question suggestions!"
                }]);

                // Trigger initial AI greeting after a short delay
                setTimeout(() => {
                    if (dataChannel.readyState === "open") {
                        console.log("[Realtime] Sending response.create to trigger AI greeting");
                        dataChannel.send(JSON.stringify({
                            type: "response.create",
                            response: { modalities: ["audio", "text"] },
                        }));
                    } else {
                        console.warn("[Realtime] Data channel not open when trying to send response.create");
                    }
                }, 1000); // Increased delay
            };

            dataChannel.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log("[Realtime] Event received:", data.type);
                    handleRealtimeEvent(data);
                } catch (e) {
                    console.error("[Realtime] Parse error:", e);
                }
            };

            dataChannel.onerror = (event) => {
                console.error("[Realtime] Data channel error:", event);
                setError("Data channel error");
            };

            dataChannel.onclose = () => {
                console.log("[Realtime] Data channel closed");
                // Only set disconnected if we're not in cleanup
                if (peerConnectionRef.current) {
                    setConnected(false);
                }
            };

            // 7. Create and set local description
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            // 8. Send offer to OpenAI Realtime API
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
            await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

            console.log("[Realtime] WebRTC connection established!");
            setLoading(false);

        } catch (e: any) {
            console.error("Interview init error:", e);
            setError(e.message);
            setLoading(false);
            setConnecting(false);
        }
    };

    const cleanup = () => {
        console.log("[Cleanup] Cleaning up WebRTC resources...");

        // Stop all media tracks
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => {
                track.stop();
                console.log("[Cleanup] Stopped track:", track.kind);
            });
            mediaStreamRef.current = null;
        }

        // Close data channel
        if (dataChannelRef.current) {
            dataChannelRef.current.close();
            dataChannelRef.current = null;
        }

        // Close peer connection
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        // Remove audio element
        if (audioElementRef.current) {
            audioElementRef.current.pause();
            audioElementRef.current.srcObject = null;
            audioElementRef.current = null;
        }

        // Clear timer
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        setConnected(false);
        setAiSpeaking(false);
        console.log("[Cleanup] Done");
    };

    const toggleMic = () => {
        setMicEnabled(!micEnabled);
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getAudioTracks().forEach(track => {
                track.enabled = !micEnabled;
            });
        }
    };

    const handleEndInterview = async () => {
        cleanup();
        setInterviewEnded(true);
        setSavingAnalytics(true);

        const fullTranscript = transcript
            .map(item => `${item.speaker === "interviewer" ? "Interviewer" : candidateName}: ${item.text}`)
            .join("\n\n");

        try {
            const res = await fetch(`${API_URL}/api/pluto/candidates/${candidateId}/analytics`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ transcript: fullTranscript }),
            });

            if (res.ok) {
                const data = await res.json();
                setAnalytics(data.analytics || {
                    overall_score: data.interview_score,
                    recommendation: data.recommendation,
                    summary: "Interview completed. Analytics generated.",
                });
            }
        } catch (e) {
            console.error("Failed to save analytics:", e);
            setAnalytics({ summary: "Failed to generate analytics. Transcript saved." });
        } finally {
            setSavingAnalytics(false);
        }
    };

    const handleSendChat = async () => {
        if (!chatInput.trim() || sendingChat) return;
        const userMessage = chatInput.trim();
        setChatInput("");
        setChatMessages((prev) => [...prev, { role: "user", content: userMessage }]);
        setSendingChat(true);

        const candidateContext = candidate ? `
Candidate: ${candidate.name}
Role: ${candidate.job_title || "N/A"}
Score: ${candidate.combined_score}/100 (${candidate.tier})
Strengths: ${candidate.pros?.slice(0, 3).join(", ") || "N/A"}
Concerns: ${candidate.cons?.slice(0, 3).join(", ") || "N/A"}
        `.trim() : `Interviewing ${candidateName}`;

        try {
            const res = await fetch(`${API_URL}/api/rooms/${currentRoomName || candidateId}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMessage,
                    context: candidateContext,
                    history: chatMessages
                }),
            });
            if (res.ok) {
                const data = await res.json();
                setChatMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
            } else {
                setChatMessages((prev) => [...prev, { role: "assistant", content: "Sorry, couldn't get a response." }]);
            }
        } catch (e) {
            console.error("Chat error:", e);
            setChatMessages((prev) => [...prev, { role: "assistant", content: "Connection error." }]);
        } finally {
            setSendingChat(false);
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
                <div className="text-center text-white">
                    <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-purple-400" />
                    <p className="text-white/60">{connecting ? "Connecting to AI candidate..." : "Initializing interview..."}</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-white">
                <div className="text-center max-w-md">
                    <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <h1 className="text-xl font-bold mb-2">Connection Failed</h1>
                    <p className="text-white/60 mb-4">{error}</p>
                    <div className="flex gap-3 justify-center">
                        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition">Try Again</button>
                        <button onClick={() => router.push(`/candidates/${candidateId}`)} className="px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition">Back to Candidate</button>
                    </div>
                </div>
            </div>
        );
    }

    // Post-interview analytics view
    if (interviewEnded) {
        return (
            <div className="min-h-screen bg-[#0A0A0A] text-white p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-8">
                        <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                        <h1 className="text-3xl font-bold mb-2">Interview Complete</h1>
                        <p className="text-white/60">Interview with {candidateName} • Duration: {formatTime(elapsedTime)}</p>
                    </div>

                    {savingAnalytics ? (
                        <div className="text-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-400" />
                            <p className="text-white/60">Generating interview analytics...</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {analytics && (
                                <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                        <TrendingUp className="w-5 h-5 text-purple-400" />
                                        Interview Analytics
                                    </h2>
                                    {analytics.overall_score && (
                                        <div className="mb-4 p-4 bg-purple-500/10 rounded-xl">
                                            <p className="text-sm text-white/60 mb-1">Overall Score</p>
                                            <p className="text-4xl font-bold text-purple-400">{analytics.overall_score}/100</p>
                                        </div>
                                    )}
                                    {analytics.recommendation && (
                                        <div className="mb-4">
                                            <p className="text-sm text-white/60 mb-1">Recommendation</p>
                                            <p className="text-lg">{analytics.recommendation}</p>
                                        </div>
                                    )}
                                    {analytics.summary && <p className="text-white/70">{analytics.summary}</p>}
                                </div>
                            )}

                            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-blue-400" />
                                    Interview Transcript
                                </h2>
                                <div className="max-h-96 overflow-y-auto space-y-3">
                                    {transcript.map((item, i) => (
                                        <div key={i} className={`p-3 rounded-lg ${item.speaker === "interviewer" ? "bg-blue-500/10 ml-8" : "bg-purple-500/10 mr-8"}`}>
                                            <p className="text-xs text-white/40 mb-1">{item.speaker === "interviewer" ? "You" : candidateName}</p>
                                            <p className="text-white/80">{item.text}</p>
                                        </div>
                                    ))}
                                    {transcript.length === 0 && <p className="text-white/40 text-center py-4">No transcript recorded</p>}
                                </div>
                            </div>

                            <div className="flex gap-4 justify-center">
                                <button onClick={() => router.push(`/candidates/${candidateId}`)} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-semibold transition">
                                    Back to Candidate Profile
                                </button>
                                <button onClick={() => router.push("/")} className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-semibold transition">
                                    Return to Dashboard
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Main interview view
    return (
        <div className="h-screen bg-[#0A0A0A] text-white flex flex-col overflow-hidden">
            {/* Header */}
            <header className="h-14 border-b border-white/10 bg-[#0A0A0A] flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push(`/candidates/${candidateId}`)} className="text-white/60 hover:text-white transition">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="font-semibold">Interview: {candidateName}</h1>
                        <p className="text-xs text-white/40">WebRTC Connected</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className={`px-3 py-1 rounded-full text-sm flex items-center gap-2 ${connected ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                        <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
                        {connected ? "Live" : "Disconnected"}
                    </div>
                    <div className="font-mono text-white/60 flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatTime(elapsedTime)}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Interview Area */}
                <div className="flex-1 flex flex-col">
                    {/* Video/Audio Area */}
                    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-purple-900/20 to-blue-900/20 relative">
                        <div className="text-center">
                            <div className={`w-36 h-36 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 transition-all duration-300 ${aiSpeaking ? "scale-110 shadow-2xl shadow-purple-500/50" : ""}`}>
                                {aiSpeaking ? <Volume2 className="w-16 h-16 text-white animate-pulse" /> : <Mic className="w-16 h-16 text-white" />}
                            </div>
                            <h2 className="text-2xl font-bold mb-2">{candidateName}</h2>
                            <p className={`transition-colors ${aiSpeaking ? "text-purple-400" : "text-white/60"}`}>
                                {aiSpeaking ? "Speaking..." : userSpeaking ? "Listening to you..." : "Waiting..."}
                            </p>
                        </div>
                        {userSpeaking && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-green-500/20 text-green-400 px-4 py-2 rounded-full flex items-center gap-2">
                                <Mic className="w-4 h-4 animate-pulse" />
                                <span className="text-sm">You are speaking...</span>
                            </div>
                        )}
                    </div>

                    {/* Transcript (hidden by default, shows only at end) */}
                    <div ref={transcriptRef} className="h-32 border-t border-white/10 p-4 overflow-y-auto bg-black/30">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-white/40">Transcript ({transcript.length} entries)</h3>
                        </div>
                        <div className="space-y-2">
                            {transcript.slice(-3).map((item, i) => (
                                <div key={i} className={`text-sm ${item.speaker === "interviewer" ? "text-blue-300" : "text-purple-300"}`}>
                                    <span className="text-white/40">{item.speaker === "interviewer" ? "You" : candidateName}: </span>
                                    {item.text.slice(0, 100)}{item.text.length > 100 ? "..." : ""}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="h-20 border-t border-white/10 flex items-center justify-center gap-4 bg-[#0A0A0A]">
                        <button onClick={toggleMic} className={`w-14 h-14 rounded-full flex items-center justify-center transition ${micEnabled ? "bg-white/10 hover:bg-white/20" : "bg-red-500/20 text-red-400 hover:bg-red-500/30"}`}>
                            {micEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                        </button>
                        <button onClick={() => setShowProfilePopup(true)} className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-full flex items-center gap-2 transition">
                            <User className="w-5 h-5" />
                            Profile
                        </button>
                        <button onClick={handleEndInterview} className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-full flex items-center gap-2 font-semibold transition shadow-lg shadow-red-500/25">
                            <PhoneOff className="w-5 h-5" />
                            End Interview
                        </button>
                    </div>
                </div>

                {/* Right: AI Sidebar */}
                <div className="w-96 border-l border-white/10 flex flex-col bg-[#0A0A0A]">
                    {/* AI Suggestions */}
                    <div className="flex-1 flex flex-col border-b border-white/10 overflow-hidden">
                        <div className="p-3 border-b border-white/10 bg-gradient-to-r from-violet-500/10 to-purple-500/10">
                            <h3 className="font-semibold flex items-center gap-2 text-sm">
                                <Lightbulb className="w-4 h-4 text-amber-400" />
                                Live Suggestions
                                {loadingSuggestion && <Loader2 className="w-3 h-3 animate-spin ml-auto text-white/40" />}
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-3">
                            {suggestions.length === 0 ? (
                                <div className="text-center py-8 text-white/30">
                                    <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">Listening to interview...</p>
                                    <p className="text-xs mt-1">Suggestions appear after candidate answers</p>
                                </div>
                            ) : (
                                suggestions.map((suggestion, i) => (
                                    <div key={i} className={`p-3 rounded-xl border ${i === 0 ? "bg-white/5 border-purple-500/30" : "bg-white/[0.02] border-white/5 opacity-70"}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase ${suggestion.answer_quality === "strong" ? "bg-green-500/20 text-green-300" :
                                                suggestion.answer_quality === "adequate" ? "bg-blue-500/20 text-blue-300" :
                                                    "bg-amber-500/20 text-amber-300"
                                                }`}>
                                                {suggestion.answer_quality}
                                            </span>
                                        </div>
                                        <p className="text-sm font-medium text-white/90 mb-2">&ldquo;{suggestion.suggested_next_question}&rdquo;</p>
                                        <p className="text-xs text-white/50">{suggestion.reasoning}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Chat */}
                    <div className="h-72 flex flex-col">
                        <div className="p-3 border-b border-white/10">
                            <h3 className="font-semibold flex items-center gap-2 text-sm">
                                <MessageSquare className="w-4 h-4 text-purple-400" />
                                AI Assistant
                            </h3>
                        </div>
                        <div className="flex-1 p-3 overflow-y-auto space-y-2">
                            {chatMessages.map((msg, i) => (
                                <div key={i} className={`p-2 rounded-lg text-xs ${msg.role === "user" ? "bg-purple-500/20 ml-4" : "bg-white/5 mr-4"}`}>
                                    {msg.content}
                                </div>
                            ))}
                        </div>
                        <div className="p-3 border-t border-white/10">
                            <div className="flex gap-2">
                                <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSendChat()} placeholder="Ask for help..." className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-purple-500" />
                                <button onClick={handleSendChat} disabled={sendingChat || !chatInput.trim()} className="p-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition disabled:opacity-50">
                                    {sendingChat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Profile Popup */}
            {showProfilePopup && candidate && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowProfilePopup(false)}>
                    <div className="bg-[#1A1A1A] rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-white/10" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-white/10 flex justify-between items-start sticky top-0 bg-[#1A1A1A]">
                            <div>
                                <h2 className="text-2xl font-bold">{candidate.name}</h2>
                                <p className="text-white/60">{candidate.job_title}</p>
                            </div>
                            <button onClick={() => setShowProfilePopup(false)} className="p-2 hover:bg-white/10 rounded-lg transition">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <h3 className="font-semibold mb-2">Summary</h3>
                                <p className="text-white/60 text-sm">{candidate.bio_summary}</p>
                            </div>
                            <div>
                                <h3 className="font-semibold mb-2 text-green-400">Strengths</h3>
                                <ul className="space-y-1">
                                    {candidate.pros?.slice(0, 4).map((pro, i) => (
                                        <li key={i} className="text-white/60 text-sm flex items-start gap-2">
                                            <ChevronRight className="w-4 h-4 text-green-400 mt-0.5" />{pro}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <h3 className="font-semibold mb-2 text-amber-400">Concerns</h3>
                                <ul className="space-y-1">
                                    {candidate.cons?.slice(0, 4).map((con, i) => (
                                        <li key={i} className="text-white/60 text-sm flex items-start gap-2">
                                            <ChevronRight className="w-4 h-4 text-amber-400 mt-0.5" />{con}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            {candidate.interview_questions?.length > 0 && (
                                <div>
                                    <h3 className="font-semibold mb-2 text-purple-400">Suggested Questions</h3>
                                    <ul className="space-y-2">
                                        {candidate.interview_questions.map((q, i) => (
                                            <li key={i} className="text-white/70 text-sm bg-white/5 p-3 rounded-lg">{q}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
