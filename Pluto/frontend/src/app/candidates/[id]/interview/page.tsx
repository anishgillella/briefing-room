"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
    Room,
    RoomEvent,
    Track,
    RemoteParticipant,
    RemoteTrackPublication,
    DataPacket_Kind,
} from "livekit-client";
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
import CandidateProfile from "@/components/CandidateProfile";
import { Candidate, PreBrief } from "@/types";

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

interface CoachSuggestion {
    suggestion: string;
    category: string;
    issue_type?: string;
    reasoning?: string;
    // Legacy fields if needed for older code
    last_question_type?: string;
    answer_quality?: "strong" | "adequate" | "weak" | "unclear";
    suggested_next_question?: string;
    should_change_topic?: boolean;
    topic_suggestion?: string | null;
}




interface SkillEvidence {
    skill: string;
    quote: string;
    confidence: string;
}

interface BehavioralProfile {
    leadership: number;
    resilience: number;
    communication: number;
    problem_solving: number;
    coachability: number;
}

interface CommunicationMetrics {
    speaking_pace_wpm: number;
    filler_word_frequency: string;
    listen_to_talk_ratio: number;
}

interface Analytics {
    // Core metrics
    overall_score?: number;
    recommendation?: "Strong Hire" | "Hire" | "No Hire" | string;
    overall_synthesis?: string;

    // Deep Analytics
    question_analytics?: {
        question: string;
        answer_summary: string;
        quality_score: number;
        key_insight: string;
        topic: string;
        relevance_score?: number;
        clarity_score?: number;
        depth_score?: number;
    }[];
    skill_evidence?: SkillEvidence[];
    behavioral_profile?: BehavioralProfile;
    communication_metrics?: CommunicationMetrics;
    topics_to_probe?: string[];

    // Legacy / Backward Compat
    summary?: string;
    strengths?: string[];
    areas_for_improvement?: string[];
    key_moments?: string[];
}


// Radar Chart Component
const RadarChart = ({ data }: { data: BehavioralProfile }) => {
    const size = 300;
    const center = size / 2;
    const radius = size * 0.35; // Leave room for labels

    // Axes: Leadership, Resilience, Communication, Problem Solving, Coachability
    const axes = [
        { label: "Leadership", value: data.leadership },
        { label: "Resilience", value: data.resilience },
        { label: "Communication", value: data.communication },
        { label: "Problem Solving", value: data.problem_solving },
        { label: "Coachability", value: data.coachability }
    ];

    const angleSlice = (Math.PI * 2) / 5;

    // Helper to calculate coordinates
    const getCoordinates = (value: number, index: number, max: number = 10) => {
        const angle = index * angleSlice - Math.PI / 2; // Start at top
        const r = (value / max) * radius;
        return {
            x: center + r * Math.cos(angle),
            y: center + r * Math.sin(angle)
        };
    };

    // Generate polygon points
    const points = axes.map((axis, i) => {
        const { x, y } = getCoordinates(axis.value, i);
        return `${x},${y}`;
    }).join(" ");

    // Generate grid levels (2, 4, 6, 8, 10)
    const gridLevels = [2, 4, 6, 8, 10];

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
            {/* Soft Glow */}
            <defs>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Spider Web Grid (Subtle) */}
            {gridLevels.map(level => {
                const levelPoints = axes.map((_, i) => {
                    const { x, y } = getCoordinates(level, i);
                    return `${x},${y}`;
                }).join(" ");
                return (
                    <polygon
                        key={level}
                        points={levelPoints}
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.05)"
                        strokeWidth="1"
                    />
                );
            })}

            {/* Axes Lines */}
            {axes.map((_, i) => {
                const { x, y } = getCoordinates(10, i);
                return (
                    <line
                        key={i}
                        x1={center}
                        y1={center}
                        x2={x}
                        y2={y}
                        stroke="rgba(255, 255, 255, 0.05)"
                        strokeWidth="1"
                    />
                );
            })}

            {/* Data Polygon with Gradient Fill */}
            <polygon
                points={points}
                fill="rgba(124, 58, 237, 0.2)"
                stroke="#A78BFA"
                strokeWidth="2"
                filter="url(#glow)"
                className="drop-shadow-lg"
            />

            {/* Data Points */}
            {axes.map((axis, i) => {
                const { x, y } = getCoordinates(axis.value, i);
                return (
                    <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r="4"
                        fill="#ddd6fe"
                        className="animate-pulse-ring"
                    />
                );
            })}

            {/* Labels */}
            {axes.map((axis, i) => {
                const angle = i * angleSlice - Math.PI / 2;
                const labelRadius = radius + 35; // Push labels out further
                const x = center + labelRadius * Math.cos(angle);
                const y = center + labelRadius * Math.sin(angle);

                return (
                    <text
                        key={i}
                        x={x}
                        y={y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#94a3b8"
                        fontSize="11"
                        fontWeight="500"
                        className="uppercase tracking-wider"
                    >
                        {axis.label}
                    </text>
                );
            })}
        </svg>
    );
};

export default function InterviewPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();

    const candidateId = params.id as string;
    const roomName = searchParams.get("room");

    // Core state
    const [candidate, setCandidate] = useState<Candidate | null>(null);
    const [prebrief, setPrebrief] = useState<PreBrief | null>(null);
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
    const [activeTab, setActiveTab] = useState<'analysis' | 'transcript'>('analysis');
    const [currentRoomName, setCurrentRoomName] = useState<string>("");
    const [interviewStartTime] = useState<number>(Date.now());
    const [livekitUrl, setLivekitUrl] = useState<string>("");
    const [usingLiveKit, setUsingLiveKit] = useState(false);

    // AI Chat state
    const [chatMessages, setChatMessages] = useState<Message[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const [showChatBot, setShowChatBot] = useState(false);

    // AI Suggestions state
    const [aiSuggestions, setAiSuggestions] = useState<CoachSuggestion[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(true);

    // Refs
    const roomRef = useRef<Room | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const transcriptEndRef = useRef<HTMLDivElement>(null);
    const hasStartedRef = useRef(false);

    // Timer effect
    useEffect(() => {
        if (connected && !interviewEnded) {
            timerRef.current = setInterval(() => {
                setElapsedTime((prev) => prev + 1);
            }, 1000);
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [connected, interviewEnded]);

    // Auto-scroll transcripts
    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [transcript]);

    // Format time helper
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    // Handle data messages from LiveKit agent
    const handleDataMessage = useCallback((data: Uint8Array) => {
        try {
            const message = JSON.parse(new TextDecoder().decode(data));
            console.log("[LiveKit] Data message:", message.type);

            switch (message.type) {
                case "TRANSCRIPT_UPDATE":
                    if (message.entry) {
                        setTranscript(prev => [...prev, {
                            speaker: message.entry.speaker,
                            text: message.entry.text,
                            timestamp: new Date(message.entry.timestamp)
                        }]);
                    }
                    break;

                case "AI_SUGGESTION":
                    setAiSuggestions(prev => [{
                        suggestion: message.suggestion, // New field
                        category: message.category || "general", // New field
                        issue_type: message.issue_type || "none",
                        reasoning: message.reasoning || "AI Copilot Analysis",

                        // Legacy mapping for backward compatibility if needed
                        last_question_type: message.category || "general",
                        answer_quality: message.category === "adequate" ? "strong" : "weak",
                        suggested_next_question: message.suggestion,
                        should_change_topic: message.category === "adequate",
                        topic_suggestion: null,
                    }, ...prev.slice(0, 4)]);
                    break;

                case "AI_SPEAKING":
                    setAiSpeaking(message.speaking);
                    break;
            }
        } catch (e) {
            console.error("[LiveKit] Failed to parse data message:", e);
        }
    }, []);

    // Initialize interview with LiveKit
    const initializeLiveKitInterview = async () => {
        try {
            setConnecting(true);

            // 1. Get candidate data
            const candidateRes = await fetch(`${API_URL}/api/pluto/candidates/${candidateId}`);
            if (!candidateRes.ok) throw new Error("Failed to fetch candidate");
            const candidateData = await candidateRes.json();
            setCandidate(candidateData);
            setCandidateName(candidateData.name);

            // Fetch Prebrief
            try {
                const prebriefRes = await fetch(`${API_URL}/api/pluto/prebrief/${candidateId}`);
                if (prebriefRes.ok) {
                    const prebriefData = await prebriefRes.json();
                    setPrebrief(prebriefData);
                }
            } catch (pErr) {
                console.warn("Failed to fetch prebrief:", pErr);
            }

            // 2. Start interview (creates LiveKit room) 
            const startRes = await fetch(`${API_URL}/api/pluto/candidates/${candidateId}/interview/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });

            if (!startRes.ok) {
                const errorText = await startRes.text();
                throw new Error(`Failed to start interview: ${errorText}`);
            }

            const { room_name, token, livekit_url } = await startRes.json();
            setCurrentRoomName(room_name);

            // 3. Check if LiveKit is configured
            if (!livekit_url) {
                console.log("[Interview] LiveKit not configured, falling back to OpenAI...");
                setUsingLiveKit(false);
                // Fall back to original OpenAI Realtime implementation
                await initializeOpenAIInterview(candidateData);
                return;
            }

            setUsingLiveKit(true);
            setLivekitUrl(livekit_url);
            console.log(`[LiveKit] Connecting to room: ${room_name}`);

            // 4. Create LiveKit Room
            const room = new Room({
                adaptiveStream: true,
                dynacast: true,
            });
            roomRef.current = room;

            // 5. Set up event handlers
            room.on(RoomEvent.Connected, () => {
                console.log("[LiveKit] Connected to room");
                setConnected(true);
                setConnecting(false);
            });

            room.on(RoomEvent.Disconnected, () => {
                console.log("[LiveKit] Disconnected from room");
                setConnected(false);
            });

            room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
                console.log("[LiveKit] Track subscribed:", track.kind);
                if (track.kind === Track.Kind.Audio) {
                    // Create audio element for agent's voice
                    const audioEl = document.createElement("audio");
                    audioEl.autoplay = true;
                    track.attach(audioEl);
                    audioRef.current = audioEl;
                    setAiSpeaking(true);
                }
            });

            room.on(RoomEvent.TrackUnsubscribed, (track) => {
                console.log("[LiveKit] Track unsubscribed:", track.kind);
                if (track.kind === Track.Kind.Audio) {
                    setAiSpeaking(false);
                }
            });

            room.on(RoomEvent.DataReceived, (payload, participant, kind) => {
                handleDataMessage(payload);
            });

            room.on(RoomEvent.ParticipantConnected, (participant) => {
                console.log("[LiveKit] Participant connected:", participant.identity);
            });

            // 6. Connect to room
            await room.connect(livekit_url, token);

            // 7. Enable microphone
            await room.localParticipant.setMicrophoneEnabled(true);
            setMicEnabled(true);

            console.log("[LiveKit] Interview ready with LiveKit Agent");

        } catch (err: any) {
            console.error("[LiveKit] Failed to initialize:", err);
            setError(err.message || "Failed to start interview");
            setConnecting(false);
        }
    };

    // Fallback: Initialize with OpenAI Realtime (existing implementation)
    const initializeOpenAIInterview = async (candidateData: Candidate) => {
        try {
            // Get ephemeral token from /api/realtime/session
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
                throw new Error(`Failed to create realtime session`);
            }

            const { client_secret: ephemeralKey } = await sessionRes.json();
            console.log("[OpenAI] Got ephemeral key, using WebRTC fallback");

            // ... (WebRTC setup would go here, but we'll just show an error for now)
            setError("LiveKit not configured. Please configure LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET.");
            setConnecting(false);

        } catch (err: any) {
            console.error("[OpenAI] Failed:", err);
            setError(err.message);
            setConnecting(false);
        }
    };

    // Cleanup
    const cleanup = useCallback(() => {
        console.log("[Interview] Cleaning up...");

        if (roomRef.current) {
            roomRef.current.disconnect();
            roomRef.current = null;
        }

        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }

        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        setConnected(false);
    }, []);

    // Initialize on mount
    useEffect(() => {
        if (candidateId && !hasStartedRef.current) {
            hasStartedRef.current = true;
            setLoading(false);
            initializeLiveKitInterview();
        }

        return () => {
            cleanup();
        };
    }, [candidateId, cleanup]);

    // Toggle microphone
    const toggleMic = async () => {
        if (roomRef.current) {
            const newState = !micEnabled;
            await roomRef.current.localParticipant.setMicrophoneEnabled(newState);
            setMicEnabled(newState);
        }
    };

    // End interview
    const endInterview = async () => {
        setInterviewEnded(true);
        cleanup();

        // Save analytics
        if (transcript.length > 0) {
            setSavingAnalytics(true);
            try {
                const transcriptText = transcript
                    .map(t => `${t.speaker}: ${t.text}`)
                    .join("\n");

                const res = await fetch(`${API_URL}/api/pluto/candidates/${candidateId}/analytics`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ transcript: transcriptText }),
                });

                if (res.ok) {
                    const data = await res.json();
                    setAnalytics(data.analytics);
                }
            } catch (err) {
                console.error("Failed to save analytics:", err);
            }
            setSavingAnalytics(false);
        }
    };

    // Chat with AI assistant
    const sendChatMessage = async () => {
        if (!chatInput.trim()) return;

        const userMessage = chatInput;
        setChatInput("");
        setChatMessages(prev => [...prev, { role: "user", content: userMessage }]);
        setChatLoading(true);

        try {
            const context = candidate ? `You are helping interview ${candidate.name} for ${candidate.job_title}. Their background: ${candidate.bio_summary}` : "";

            const res = await fetch(`${API_URL}/api/coach/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [...chatMessages, { role: "user", content: userMessage }],
                    context,
                    room_name: currentRoomName,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setChatMessages(prev => [...prev, { role: "assistant", content: data.response }]);
            }
        } catch (err) {
            console.error("Chat error:", err);
        }
        setChatLoading(false);
    };

    // Get latest transcript for suggestions
    const getLatestExchange = () => {
        if (transcript.length < 2) return null;

        let lastInterviewerIdx = -1;
        let lastCandidateIdx = -1;

        for (let i = transcript.length - 1; i >= 0; i--) {
            if (transcript[i].speaker === "interviewer" && lastInterviewerIdx === -1) {
                lastInterviewerIdx = i;
            }
            if (transcript[i].speaker === "candidate" && lastCandidateIdx === -1) {
                lastCandidateIdx = i;
            }
            if (lastInterviewerIdx !== -1 && lastCandidateIdx !== -1) break;
        }

        if (lastInterviewerIdx !== -1 && lastCandidateIdx !== -1) {
            return `Interviewer: ${transcript[lastInterviewerIdx].text}\nCandidate: ${transcript[lastCandidateIdx].text}`;
        }
        return null;
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    // Error state
    if (error && !connected) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
                <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-gray-700 p-8 max-w-md text-center">
                    <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-white mb-2">Connection Error</h2>
                    <p className="text-gray-400 mb-6">{error}</p>
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={() => router.back()}
                            className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600"
                        >
                            Go Back
                        </button>
                        <button
                            onClick={() => {
                                setError(null);
                                hasStartedRef.current = false;
                                initializeLiveKitInterview();
                            }}
                            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Interview ended state
    if (interviewEnded) {
        return (
            <div className="min-h-screen bg-[#000000] text-white font-sans selection:bg-purple-500/30 overflow-y-auto">
                <style jsx global>{`
                    .glass-panel {
                        background: rgba(255, 255, 255, 0.03);
                        backdrop-filter: blur(20px);
                        border: 1px solid rgba(255, 255, 255, 0.08);
                    }
                    .neon-text {
                        text-shadow: 0 0 20px rgba(124, 58, 237, 0.5);
                    }
                `}</style>

                <div className="max-w-6xl mx-auto px-6 py-12 animate-fadeIn">

                    {/* Header */}
                    <div className="flex items-center justify-between mb-12">
                        <div>
                            <h1 className="text-3xl font-light tracking-tight text-white mb-2">
                                Interview Analysis
                            </h1>
                            <p className="text-gray-400 font-light flex items-center gap-2">
                                {candidateName} <span className="text-gray-700">•</span> {formatTime(elapsedTime)}
                            </p>
                        </div>
                        {usingLiveKit && (
                            <div className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs flex items-center gap-2">
                                <Sparkles className="w-3 h-3" />
                                <span>AI Powered</span>
                            </div>
                        )}
                    </div>

                    {savingAnalytics ? (
                        <div className="flex flex-col items-center justify-center h-[60vh] gap-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-purple-500 blur-xl opacity-20 animate-pulse"></div>
                                <Loader2 className="w-12 h-12 animate-spin text-white relative z-10" />
                            </div>
                            <div className="text-center">
                                <p className="text-xl font-light text-white mb-2">Generating Intelligence</p>
                                <p className="text-gray-500 text-sm">Synthesizing transcript and scoring dimensions...</p>
                            </div>
                        </div>
                    ) : analytics ? (
                        <div className="space-y-6">

                            {/* TAB NAVIGATION */}
                            <div className="flex gap-8 mb-8 border-b border-gray-800">
                                <button
                                    onClick={() => setActiveTab('analysis')}
                                    className={`pb-4 text-sm font-medium transition-colors relative ${activeTab === 'analysis' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    Analysis
                                    {activeTab === 'analysis' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('transcript')}
                                    className={`pb-4 text-sm font-medium transition-colors relative ${activeTab === 'transcript' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    Transcript
                                    {activeTab === 'transcript' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                                    )}
                                </button>
                            </div>

                            {/* TAB: ANALYSIS */}
                            {activeTab === 'analysis' && (
                                <div className="space-y-8 animate-fadeIn">

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

                                        {/* 1. Overall Score (Large) */}
                                        <div className="col-span-1 md:col-span-2 row-span-2 glass-panel rounded-3xl p-8 relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity duration-700">
                                                <TrendingUp className="w-48 h-48 text-white" />
                                            </div>
                                            <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase mb-8">Overall Match Score</h3>
                                            <div className="flex items-end gap-4">
                                                <span className="text-8xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-400">
                                                    {analytics.overall_score || 0}
                                                </span>
                                                <span className="text-2xl text-gray-500 font-light mb-4">/100</span>
                                            </div>
                                            <div className="mt-8 flex gap-2">
                                                {analytics.recommendation === "Strong Hire" && (
                                                    <span className="px-4 py-2 rounded-full bg-green-500/20 text-green-300 border border-green-500/30 text-sm font-medium">Strong Hire</span>
                                                )}
                                                {analytics.recommendation === "Hire" && (
                                                    <span className="px-4 py-2 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-sm font-medium">Hire</span>
                                                )}
                                                {analytics.recommendation === "No Hire" && (
                                                    <span className="px-4 py-2 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-sm font-medium">No Hire</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* 2. Behavioral Radar */}
                                        <div className="col-span-1 md:col-span-2 row-span-2 glass-panel rounded-3xl p-6 flex flex-col items-center justify-center relative">
                                            <div className="absolute top-6 left-6 text-gray-400 text-sm font-medium tracking-wider uppercase">Soft Skills Profile</div>
                                            {analytics.behavioral_profile ? (
                                                <div className="mt-8 transform scale-110 hover:scale-115 transition-transform duration-500">
                                                    <RadarChart data={analytics.behavioral_profile} />
                                                </div>
                                            ) : (
                                                <p className="text-gray-600">No profile data</p>
                                            )}
                                        </div>

                                        {/* 3. Executive Synthesis */}
                                        <div className="col-span-1 md:col-span-3 glass-panel rounded-3xl p-8">
                                            <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase mb-4 flex items-center gap-2">
                                                <Sparkles className="w-4 h-4 text-purple-400" /> Executive Synthesis
                                            </h3>
                                            <p className="text-lg text-gray-200 font-light leading-relaxed">
                                                {analytics.overall_synthesis || analytics.summary}
                                            </p>
                                        </div>

                                        {/* 4. Communication Stats */}
                                        <div className="col-span-1 glass-panel rounded-3xl p-6 flex flex-col justify-between">
                                            <div>
                                                <h3 className="text-gray-400 text-xs font-medium tracking-wider uppercase mb-1">Speaking Pace</h3>
                                                <div className="text-3xl font-light text-white">
                                                    {analytics.communication_metrics?.speaking_pace_wpm || 0} <span className="text-sm text-gray-500">wpm</span>
                                                </div>
                                            </div>
                                            <div className="mt-4">
                                                <h3 className="text-gray-400 text-xs font-medium tracking-wider uppercase mb-1">Filler Words</h3>
                                                <div className="text-xl font-light text-white">
                                                    {analytics.communication_metrics?.filler_word_frequency || "N/A"}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* SKILL EVIDENCE & TIMELINE */}
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12">

                                        {/* Left Column: Skills */}
                                        <div className="col-span-1 space-y-6">
                                            <h2 className="text-2xl font-light text-white mb-6">Verified Skills</h2>
                                            <div className="max-h-[400px] overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                                {analytics.skill_evidence?.map((evidence, i) => (
                                                    <div key={i} className="glass-panel p-5 rounded-2xl group hover:bg-white/5 transition-colors">
                                                        <div className="flex justify-between items-start mb-3">
                                                            <span className="text-blue-300 font-medium">{evidence.skill}</span>
                                                            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide border ${evidence.confidence === 'High' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                                                                {evidence.confidence}
                                                            </span>
                                                        </div>
                                                        <p className="text-gray-400 text-sm font-light italic border-l-2 border-gray-700 pl-3 group-hover:border-blue-500/50 transition-colors">
                                                            "{evidence.quote}"
                                                        </p>
                                                    </div>
                                                ))}
                                                {(!analytics.skill_evidence || analytics.skill_evidence.length === 0) && (
                                                    <p className="text-gray-600 italic">No specific skills verified.</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right Column: Q&A Timeline */}
                                        <div className="col-span-1 lg:col-span-2">
                                            <h2 className="text-2xl font-light text-white mb-6">Conversation Analysis</h2>
                                            <div className="relative border-l border-gray-800 ml-4 space-y-12">
                                                {analytics.question_analytics?.map((qa, i) => (
                                                    <div key={i} className="relative pl-8">
                                                        {/* Timeline Dot */}
                                                        <div className="absolute -left-1.5 top-2 w-3 h-3 rounded-full bg-gray-800 border border-gray-600"></div>

                                                        <div className="glass-panel rounded-2xl p-6 hover:bg-white/5 transition-colors group">
                                                            {/* Header */}
                                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-gray-300">
                                                                        {qa.topic}
                                                                    </span>
                                                                    <h4 className="text-lg font-medium text-white">{qa.question}</h4>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="text-right">
                                                                        <div className="text-xs text-gray-500 uppercase tracking-widest">Quality</div>
                                                                        <div className={`text-xl font-bold ${qa.quality_score >= 80 ? 'text-green-400' : qa.quality_score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                                            {qa.quality_score}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <p className="text-gray-400 text-sm font-light leading-relaxed mb-6">
                                                                {qa.answer_summary}
                                                            </p>

                                                            {/* Metrics Grid */}
                                                            <div className="grid grid-cols-3 gap-4 border-t border-white/5 pt-4">
                                                                <div>
                                                                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Relevance</div>
                                                                    <div className="flex items-end gap-2">
                                                                        <div className="h-1.5 flex-1 bg-gray-800 rounded-full overflow-hidden">
                                                                            <div className="h-full bg-indigo-500" style={{ width: `${(qa.relevance_score || 0) * 10}%` }}></div>
                                                                        </div>
                                                                        <span className="text-xs text-indigo-300 font-mono">{qa.relevance_score}/10</span>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Clarity</div>
                                                                    <div className="flex items-end gap-2">
                                                                        <div className="h-1.5 flex-1 bg-gray-800 rounded-full overflow-hidden">
                                                                            <div className="h-full bg-cyan-500" style={{ width: `${(qa.clarity_score || 0) * 10}%` }}></div>
                                                                        </div>
                                                                        <span className="text-xs text-cyan-300 font-mono">{qa.clarity_score}/10</span>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Depth</div>
                                                                    <div className="flex items-end gap-2">
                                                                        <div className="h-1.5 flex-1 bg-gray-800 rounded-full overflow-hidden">
                                                                            <div className="h-full bg-purple-500" style={{ width: `${(qa.depth_score || 0) * 10}%` }}></div>
                                                                        </div>
                                                                        <span className="text-xs text-purple-300 font-mono">{qa.depth_score}/10</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB: TRANSCRIPT */}
                            {activeTab === 'transcript' && (
                                <div className="space-y-6 max-w-4xl mx-auto animate-fadeIn pb-20">
                                    {transcript.length === 0 ? (
                                        <div className="text-center py-20 text-gray-500 font-light">
                                            No transcript available for this session.
                                        </div>
                                    ) : (
                                        transcript.map((item, i) => (
                                            <div key={i} className={`flex gap-4 ${item.speaker === 'interviewer' ? 'flex-row-reverse' : ''}`}>
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border uppercase text-xs ${item.speaker === 'interviewer' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                                                    }`}>
                                                    {item.speaker === 'interviewer' ? 'I' : 'C'}
                                                </div>
                                                <div className={`glass-panel p-5 rounded-2xl max-w-[85%] ${item.speaker === 'interviewer' ? 'border-l-0 border-r-2 border-r-blue-500/30' : 'border-r-0 border-l-2 border-l-purple-500/30'
                                                    }`}>
                                                    <div className={`flex items-center gap-2 mb-2 ${item.speaker === 'interviewer' ? 'justify-end' : ''}`}>
                                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${item.speaker === 'interviewer' ? 'text-blue-400' : 'text-purple-400'
                                                            }`}>
                                                            {item.speaker === 'interviewer' ? 'Interviewer' : candidateName}
                                                        </span>
                                                        <span className="text-gray-600 text-[10px]">•</span>
                                                        <span className="text-gray-600 text-[10px]">{item.timestamp.toLocaleTimeString()}</span>
                                                    </div>
                                                    <p className="text-gray-200 font-light leading-relaxed whitespace-pre-wrap text-sm">
                                                        {item.text}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                        </div>
                    ) : (

                        <div className="flex flex-col items-center justify-center h-[50vh] text-center">
                            <p className="text-gray-500 font-light mb-6">Analytics data unavailable.</p>
                            <button
                                onClick={() => router.push("/")}
                                className="px-8 py-3 rounded-full bg-white text-black font-medium hover:bg-gray-200 transition"
                            >
                                Return to Dashboard
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Main interview UI
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 text-white font-sans selection:bg-purple-500/30 overflow-hidden flex flex-col">
            <style jsx global>{`
                @keyframes pulse-ring {
                    0% { transform: scale(0.8); opacity: 0.5; }
                    100% { transform: scale(2); opacity: 0; }
                }
                .animate-pulse-ring {
                    animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
            `}</style>
            {/* Header */}
            <header className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur-md border-b border-gray-700/50">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-lg font-semibold text-white">
                                Interview: {candidateName}
                            </h1>
                            <p className="text-sm text-gray-400">
                                {candidate?.job_title || "Candidate"}
                                {usingLiveKit && (
                                    <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs">
                                        <Sparkles className="w-3 h-3" />
                                        LiveKit
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300">
                            <Clock className="w-4 h-4" />
                            <span className="font-mono">{formatTime(elapsedTime)}</span>
                        </div>

                        {/* Connection status */}
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${connected ? "bg-green-500/20 text-green-400" :
                            connecting ? "bg-yellow-500/20 text-yellow-400" :
                                "bg-red-500/20 text-red-400"
                            }`}>
                            <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" :
                                connecting ? "bg-yellow-400 animate-pulse" :
                                    "bg-red-400"
                                }`} />
                            {connected ? "Connected" : connecting ? "Connecting..." : "Disconnected"}
                        </div>

                        {/* View Profile Button */}
                        <button
                            onClick={() => setShowProfilePopup(true)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition"
                        >
                            <User className="w-4 h-4" />
                            View Profile
                        </button>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Voice Interface */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Voice status card */}
                    <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-gray-700 p-6">
                        <div className="flex items-center justify-center mb-6">
                            <div className={`relative w-32 h-32 flex items-center justify-center rounded-full ${aiSpeaking ? "bg-blue-500/20" : "bg-gray-700/50"
                                }`}>
                                <Volume2 className={`w-16 h-16 ${aiSpeaking ? "text-blue-500 animate-pulse" : "text-gray-500"
                                    }`} />
                                {aiSpeaking && (
                                    <div className="absolute inset-0 rounded-full border-4 border-blue-500/50 animate-pulse-ring" />
                                )}
                            </div>
                        </div>

                        <div className="text-center mb-6">
                            <p className="text-lg text-gray-300">
                                {aiSpeaking ? `${candidateName} is speaking...` :
                                    userSpeaking ? "Listening to you..." :
                                        connected ? "Waiting for conversation..." :
                                            "Connecting..."}
                            </p>
                        </div>

                        {/* Controls */}
                        <div className="flex justify-center gap-4">
                            <button
                                onClick={toggleMic}
                                disabled={!connected}
                                className={`p-4 rounded-full transition ${micEnabled
                                    ? "bg-gray-700 text-white hover:bg-gray-600"
                                    : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                    } disabled:opacity-50`}
                            >
                                {micEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                            </button>

                            <button
                                onClick={endInterview}
                                className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600 transition"
                            >
                                <PhoneOff className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Transcript */}
                    <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-gray-700 p-4">
                        <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Live Transcript
                        </h3>
                        <div className="h-64 overflow-y-auto space-y-3 pr-2">
                            {transcript.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">
                                    Transcript will appear here as you speak...
                                </p>
                            ) : (
                                transcript.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className={`p-3 rounded-lg ${item.speaker === "interviewer"
                                            ? "bg-blue-500/10 border-l-2 border-blue-500"
                                            : "bg-purple-500/10 border-l-2 border-purple-500"
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                                            <span className="font-medium">
                                                {item.speaker === "interviewer" ? "You" : candidateName}
                                            </span>
                                            <span>•</span>
                                            <span>{item.timestamp.toLocaleTimeString()}</span>
                                        </div>
                                        <p className="text-gray-300">{item.text}</p>
                                    </div>
                                ))
                            )}
                            <div ref={transcriptEndRef} />
                        </div>
                    </div>
                </div>

                {/* Right: AI Suggestions & Chat */}
                <div className="space-y-6">
                    {/* AI Suggestions */}
                    <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-gray-700 p-4">
                        <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-yellow-500" />
                            AI Suggestions
                        </h3>

                        <div className="h-[300px] overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            {aiSuggestions.length === 0 ? (
                                <p className="text-gray-500 text-sm text-center py-4">
                                    AI insights will appear here as you interview...
                                </p>
                            ) : (
                                aiSuggestions.map((suggestion, idx) => {
                                    const isAdequate = suggestion.last_question_type === "adequate";
                                    // Determine colors/icons based on issue type
                                    let borderColor = isAdequate ? "border-blue-500/30" : "border-amber-500/30";
                                    let bgColor = isAdequate ? "bg-blue-500/10" : "bg-amber-500/10";
                                    let iconColor = isAdequate ? "text-blue-400" : "text-amber-400";
                                    let BadgeIcon = isAdequate ? Sparkles : AlertCircle;
                                    let title = isAdequate ? "Suggested Next Topic" : "Probing Suggested";

                                    // Special handling for specific issues
                                    if (suggestion.issue_type === "resume_contradiction") {
                                        borderColor = "border-red-500/30";
                                        bgColor = "bg-red-500/10";
                                        iconColor = "text-red-400";
                                        BadgeIcon = AlertTriangle; // Assuming AlertTriangle is imported from lucide-react
                                        title = "Resume Discrepancy";
                                    } else if (suggestion.issue_type === "missing_star") {
                                        title = "Missing STAR Result";
                                    } else if (suggestion.issue_type === "rambling") {
                                        title = "Rambling Detected";
                                    }

                                    return (
                                        <div key={idx} className={`p-4 rounded-xl border ${borderColor} ${bgColor} backdrop-blur-sm transition-all animate-slide-in`}>
                                            <div className="flex items-start gap-3">
                                                <div className={`mt-1 ${iconColor}`}>
                                                    <BadgeIcon className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h4 className={`text-sm font-medium mb-1 ${iconColor}`}>
                                                        {title}
                                                    </h4>
                                                    <p className="text-white text-sm mb-2">
                                                        "{suggestion.suggested_next_question}"
                                                    </p>
                                                    {suggestion.reasoning && (
                                                        <p className="text-gray-400 text-xs italic">
                                                            {suggestion.reasoning}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                    </div>

                    {/* Chat Bot */}
                    <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-gray-700 p-4">
                        <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-blue-500" />
                            AI Assistant
                        </h3>

                        <div className="h-48 overflow-y-auto space-y-2 mb-3">
                            {chatMessages.length === 0 ? (
                                <p className="text-gray-500 text-sm text-center py-4">
                                    Ask anything about the candidate or interview...
                                </p>
                            ) : (
                                chatMessages.map((msg, idx) => (
                                    <div
                                        key={idx}
                                        className={`p-2 rounded-lg text-sm ${msg.role === "user"
                                            ? "bg-blue-500/20 text-blue-200 ml-4"
                                            : "bg-gray-700 text-gray-300 mr-4"
                                            }`}
                                    >
                                        {msg.content}
                                    </div>
                                ))
                            )}
                            {chatLoading && (
                                <div className="flex items-center gap-2 text-gray-400">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="text-sm">Thinking...</span>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyPress={(e) => e.key === "Enter" && sendChatMessage()}
                                placeholder="Ask a question..."
                                className="flex-1 px-3 py-2 rounded-lg bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:outline-none focus:border-blue-500"
                            />
                            <button
                                onClick={sendChatMessage}
                                disabled={chatLoading || !chatInput.trim()}
                                className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Profile Popup */}
            {showProfilePopup && candidate && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-slate-900/90 border border-white/10 w-full max-w-5xl h-[90vh] rounded-2xl overflow-hidden flex flex-col relative shadow-2xl backdrop-blur-xl">
                        <button
                            onClick={() => setShowProfilePopup(false)}
                            className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-black/80 rounded-full text-white/60 hover:text-white transition"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <div className="flex-1 overflow-y-auto">
                            <CandidateProfile
                                candidate={candidate}
                                prebrief={prebrief}
                                isModal={true}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
