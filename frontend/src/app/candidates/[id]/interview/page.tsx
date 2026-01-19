"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
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
    Flag,
    Star,
    Target,
    Heart,
    Zap,
    Users,
    ThumbsUp,
    HelpCircle,
} from "lucide-react";
import CandidateProfile from "@/components/CandidateProfile";
import InterviewerSelector from "@/components/InterviewerSelector";
import InterviewerAnalyticsTab from "@/components/InterviewerAnalyticsTab";
import TranscriptTab from "@/components/TranscriptTab";
import RoleSelector, { InterviewRole } from "@/components/RoleSelector";
import { Candidate, PreBrief } from "@/types";
import { getSelectedInterviewerId, triggerInterviewAnalysis } from "@/lib/interviewerApi";

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
    category: string; // This now maps to 'verdict' from backend
    issue_type?: string;
    reasoning?: string;
    question_type?: string;     // technical/behavioral/etc
    probe_recommendation?: string; // stay_on_topic/probe_deeper
    prior_round?: string; // Prior interview round reference
    prior_quote?: string; // Quote from prior interview round
    current_quote?: string; // Quote from current interview

    // Legacy mapping (kept for safety)
    last_question_type?: string;
    answer_quality?: "strong" | "adequate" | "weak" | "unclear";
    suggested_next_question?: string;
    should_change_topic?: boolean;
    topic_suggestion?: string | null;
}




interface SkillEvidence {
    skill: string;
    quote: string;
    confidence: "High" | "Medium" | "Low" | string;
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
    filler_word_frequency: "Low" | "Medium" | "High" | string;
    listen_to_talk_ratio: number;
}

interface RedFlag {
    concern: string;
    severity: "High" | "Medium" | "Low";
    evidence: string;
}

interface Highlight {
    moment: string;
    quote: string;
    why_notable: string;
}

interface RoleCompetency {
    competency: string;
    score: number;
    evidence_quote: string;
    assessment: string;
}

interface CulturalFitIndicators {
    values_alignment: number;
    work_style: string;
    motivation_drivers: string[];
    team_fit_notes: string;
}

interface EnthusiasmIndicators {
    overall_enthusiasm: number;
    role_interest: number;
    company_interest: number;
    questions_asked: string[];
    engagement_notes: string;
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

    // New Job-Agnostic Metrics
    red_flags?: RedFlag[];
    highlights?: Highlight[];
    role_competencies?: RoleCompetency[];
    cultural_fit?: CulturalFitIndicators;
    enthusiasm?: EnthusiasmIndicators;

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

function InterviewPageContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();

    const candidateId = params.id as string;
    const roomName = searchParams.get("room");
    const roleFromUrl = searchParams.get("role") as InterviewRole | null;

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
    const [activeTab, setActiveTab] = useState<'analysis' | 'interviewer' | 'transcript'>('analysis');
    const [currentRoomName, setCurrentRoomName] = useState<string>("");
    const [interviewStartTime] = useState<number>(Date.now());
    const [livekitUrl, setLivekitUrl] = useState<string>("");
    const [usingLiveKit, setUsingLiveKit] = useState(false);

    // Interview phase: controls the UI flow
    // - "role-select": Show role selection screen
    // - "connecting": Connecting to LiveKit room
    // - "interview": Active interview
    // - "ended": Interview ended, showing analytics
    const [interviewPhase, setInterviewPhase] = useState<'role-select' | 'connecting' | 'interview' | 'ended'>('role-select');

    // Selected role determines which AI agent joins and UI presentation
    const [selectedRole, setSelectedRole] = useState<InterviewRole>('interviewer');

    // View mode: "interviewer" (recruiter conducting interview) vs "candidate" (candidate being interviewed)
    const [viewMode, setViewMode] = useState<'interviewer' | 'candidate'>('interviewer');

    // AI Chat state
    const [chatMessages, setChatMessages] = useState<Message[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const [showChatBot, setShowChatBot] = useState(false);

    // AI Suggestions state
    const [aiSuggestions, setAiSuggestions] = useState<CoachSuggestion[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(true);

    // Interviewer state
    const [interviewerId, setInterviewerId] = useState<string | null>(null);
    const [currentInterviewId, setCurrentInterviewId] = useState<string | null>(null);
    const [interviewerAnalytics, setInterviewerAnalytics] = useState<Record<string, unknown> | null>(null);
    const [showInterviewerSelector, setShowInterviewerSelector] = useState(false);

    // Refs
    const roomRef = useRef<Room | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const transcriptEndRef = useRef<HTMLDivElement>(null);
    const hasStartedRef = useRef(false);

    const renderInline = (text: string) => {
        const parts: Array<string | React.ReactNode> = [];
        let lastIndex = 0;
        let matchIndex = 0;
        const regex = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(text.slice(lastIndex, match.index));
            }
            if (match[2]) {
                parts.push(
                    <strong key={`bold-${matchIndex++}`} className="font-semibold text-white">
                        {match[2]}
                    </strong>
                );
            } else if (match[3]) {
                parts.push(
                    <code
                        key={`code-${matchIndex++}`}
                        className="px-1 py-0.5 rounded bg-black/30 text-blue-200 text-[11px]"
                    >
                        {match[3]}
                    </code>
                );
            }
            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < text.length) {
            parts.push(text.slice(lastIndex));
        }

        return parts;
    };

    const renderLines = (text: string) => {
        const lines = text.split(/\r?\n/);
        const blocks: React.ReactNode[] = [];
        let unorderedItems: string[] = [];
        let orderedItems: string[] = [];
        let paragraphBuffer: string[] = [];

        const flushParagraph = () => {
            if (!paragraphBuffer.length) return;
            const paragraphText = paragraphBuffer.join(" ").trim();
            paragraphBuffer = [];
            if (!paragraphText) return;
            blocks.push(
                <p key={`para-${blocks.length}`} className="text-xs text-white/85 leading-relaxed">
                    {renderInline(paragraphText)}
                </p>
            );
        };

        const flushUnordered = () => {
            if (!unorderedItems.length) return;
            blocks.push(
                <ul key={`ul-${blocks.length}`} className="list-disc pl-4 space-y-1 text-xs text-white/85 leading-relaxed">
                    {unorderedItems.map((item, idx) => (
                        <li key={`ul-item-${blocks.length}-${idx}`}>{renderInline(item)}</li>
                    ))}
                </ul>
            );
            unorderedItems = [];
        };

        const flushOrdered = () => {
            if (!orderedItems.length) return;
            blocks.push(
                <ol key={`ol-${blocks.length}`} className="list-decimal pl-4 space-y-1 text-xs text-white/85 leading-relaxed">
                    {orderedItems.map((item, idx) => (
                        <li key={`ol-item-${blocks.length}-${idx}`}>{renderInline(item)}</li>
                    ))}
                </ol>
            );
            orderedItems = [];
        };

        lines.forEach((rawLine) => {
            const line = rawLine.trim();
            if (!line) {
                flushParagraph();
                flushUnordered();
                flushOrdered();
                return;
            }

            const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
            if (headingMatch) {
                flushParagraph();
                flushUnordered();
                flushOrdered();
                const level = headingMatch[1].length;
                const headingText = headingMatch[2].trim();
                const headingClass =
                    level === 1
                        ? "text-sm font-semibold text-white"
                        : level === 2
                            ? "text-xs font-semibold text-white"
                            : "text-xs font-medium text-white/80 uppercase tracking-wider";
                blocks.push(
                    <div key={`h-${blocks.length}`} className={headingClass}>
                        {renderInline(headingText)}
                    </div>
                );
                return;
            }

            if (/^>\s?/.test(line)) {
                flushParagraph();
                flushUnordered();
                flushOrdered();
                const quoteText = line.replace(/^>\s?/, "");
                blocks.push(
                    <div
                        key={`quote-${blocks.length}`}
                        className="border-l-2 border-white/20 pl-3 text-xs text-white/70 italic leading-relaxed"
                    >
                        {renderInline(quoteText)}
                    </div>
                );
                return;
            }

            if (/^[-*•]\s+/.test(line)) {
                flushParagraph();
                flushOrdered();
                unorderedItems.push(line.replace(/^[-*•]\s+/, "").trim());
                return;
            }

            if (/^\d+\.\s+/.test(line)) {
                flushParagraph();
                flushUnordered();
                orderedItems.push(line.replace(/^\d+\.\s+/, "").trim());
                return;
            }

            paragraphBuffer.push(line);
        });

        flushParagraph();
        flushUnordered();
        flushOrdered();

        return blocks;
    };

    const renderAssistantMessage = (content: string) => {
        const sections = content
            .split(/(\bSuggestion for the interviewer:|\bFollow-up Question:)/i)
            .filter(Boolean);

        const blocks: React.ReactNode[] = [];
        let i = 0;

        while (i < sections.length) {
            const segment = sections[i];
            if (/^Suggestion for the interviewer:$/i.test(segment) || /^Follow-up Question:$/i.test(segment)) {
                const label = segment.replace(/:$/, "");
                const body = sections[i + 1] || "";
                blocks.push(
                    <div key={`label-${i}`} className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wider text-white/50">
                            {label}
                        </div>
                        <div className="space-y-2">
                            {renderLines(body.trim())}
                        </div>
                    </div>
                );
                i += 2;
                continue;
            }

            const text = segment.trim();
            if (!text) {
                i += 1;
                continue;
            }

            const numberedMatches = text.match(/\b\d+\.\s+/g);
            if (numberedMatches && numberedMatches.length >= 2) {
                const firstIndex = text.search(/\b\d+\.\s+/);
                const intro = text.slice(0, firstIndex).trim();
                const listText = text.slice(firstIndex).trim();
                const items = listText.split(/\s(?=\d+\.\s+)/).map((item) =>
                    item.replace(/^\d+\.\s+/, "").trim()
                );

                blocks.push(
                    <div key={`list-${i}`} className="space-y-2">
                        {intro && (
                            <p className="text-xs text-white/85 leading-relaxed">
                                {renderInline(intro)}
                            </p>
                        )}
                        <ol className="list-decimal pl-4 space-y-1 text-xs text-white/85 leading-relaxed">
                            {items.map((item, idx) => (
                                <li key={`item-${i}-${idx}`}>{renderInline(item)}</li>
                            ))}
                        </ol>
                    </div>
                );
            } else {
                const rendered = renderLines(text);
                blocks.push(
                    <div key={`para-${i}`} className="space-y-2">
                        {rendered}
                    </div>
                );
            }

            i += 1;
        }

        return <div className="space-y-3">{blocks}</div>;
    };

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
                        prior_round: message.prior_round,
                        prior_quote: message.prior_quote,
                        current_quote: message.current_quote,

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

    // Fetch candidate data (called on mount for role selection screen)
    const fetchCandidateData = async () => {
        try {
            const candidateRes = await fetch(`${API_URL}/api/pluto/candidates/${candidateId}`);
            if (!candidateRes.ok) throw new Error("Failed to fetch candidate");
            const candidateData = await candidateRes.json();
            setCandidate(candidateData);
            setCandidateName(candidateData.name);

            // Fetch Prebrief
            try {
                const prebriefRes = await fetch(`${API_URL}/api/pluto/candidates/${candidateId}/prebrief`);
                if (prebriefRes.ok) {
                    const prebriefData = await prebriefRes.json();
                    setPrebrief(prebriefData.prebrief || prebriefData);
                }
            } catch (pErr) {
                console.warn("Failed to fetch prebrief:", pErr);
            }

            setLoading(false);
        } catch (err: any) {
            console.error("Failed to fetch candidate:", err);
            setError(err.message || "Failed to load candidate");
            setLoading(false);
        }
    };

    // Initialize interview with LiveKit (called after role selection)
    const initializeLiveKitInterview = async (role: InterviewRole) => {
        try {
            setConnecting(true);
            setInterviewPhase('connecting');
            setSelectedRole(role);
            setViewMode(role); // Sync viewMode with selected role

            // Start interview (creates LiveKit room) with role parameter
            const startRes = await fetch(`${API_URL}/api/pluto/candidates/${candidateId}/interview/start?role=${role}`, {
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
                if (candidate) {
                    await initializeOpenAIInterview(candidate);
                }
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
                setInterviewPhase('interview'); // Transition to interview phase
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
            setInterviewPhase('role-select'); // Go back to role selection on error
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

    const [backUrl, setBackUrl] = useState("/");

    // Get back URL (rankings session) on mount
    useEffect(() => {
        const sessionId = sessionStorage.getItem("currentSessionId");
        if (sessionId) {
            setBackUrl(`/rankings/${sessionId}`);
        }
    }, []);

    // Fetch candidate data on mount (for role selection screen)
    // If role is provided in URL, auto-start with that role
    useEffect(() => {
        const init = async () => {
            if (candidateId && !hasStartedRef.current) {
                hasStartedRef.current = true;
                await fetchCandidateData();

                // If role is provided in URL, auto-start the interview with that role
                if (roleFromUrl && (roleFromUrl === 'interviewer' || roleFromUrl === 'candidate')) {
                    initializeLiveKitInterview(roleFromUrl);
                }
            }
        };

        init();

        return () => {
            cleanup();
        };
    }, [candidateId, cleanup, roleFromUrl]);

    // Handle role selection - starts the interview with the selected role
    const handleRoleSelect = (role: InterviewRole) => {
        initializeLiveKitInterview(role);
    };

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
        setInterviewPhase('ended');
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

                    // Store interview ID for InterviewerAnalyticsTab
                    if (data.interview_id) {
                        setCurrentInterviewId(data.interview_id);
                    }

                    // Store interviewer analytics if returned
                    if (data.interviewer_analytics) {
                        setInterviewerAnalytics(data.interviewer_analytics);
                        console.log("[Analytics] Interviewer analytics received");
                    } else {
                        // Trigger interviewer analytics if an interviewer was selected and not already generated
                        const selectedInterviewerId = getSelectedInterviewerId();
                        if (selectedInterviewerId && data.interview_id) {
                            try {
                                await triggerInterviewAnalysis(data.interview_id);
                                console.log("[Analytics] Interviewer analysis triggered");
                            } catch (err) {
                                console.error("Failed to trigger interviewer analysis:", err);
                            }
                        }
                    }
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
                                setInterviewPhase('role-select');
                            }}
                            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Role selection state - show before starting interview
    if (interviewPhase === 'role-select') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span>Back</span>
                    </button>
                </div>

                {/* Role Selector */}
                <div className="flex-1 flex items-center justify-center">
                    <RoleSelector
                        candidateName={candidateName}
                        jobTitle={candidate?.job_title || "this position"}
                        onSelectRole={handleRoleSelect}
                        isLoading={connecting}
                    />
                </div>
            </div>
        );
    }

    // Connecting state
    if (interviewPhase === 'connecting') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-white mb-2">
                        {selectedRole === 'candidate' ? 'Connecting to AI Interviewer...' : 'Connecting to AI Candidate...'}
                    </h2>
                    <p className="text-gray-400">
                        {selectedRole === 'candidate'
                            ? 'The AI interviewer will ask you questions'
                            : 'The AI candidate will answer your questions'
                        }
                    </p>
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
                                    className={`pb-4 text-sm font-medium transition-colors relative ${activeTab === 'analysis' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    Analysis
                                    {activeTab === 'analysis' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('transcript')}
                                    className={`pb-4 text-sm font-medium transition-colors relative ${activeTab === 'transcript' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    Transcript
                                    {activeTab === 'transcript' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('interviewer')}
                                    className={`pb-4 text-sm font-medium transition-colors relative ${activeTab === 'interviewer' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    Interviewer
                                    {activeTab === 'interviewer' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]"></div>
                                    )}
                                </button>

                                {/* Back to Rankings - Always visible */}
                                <div className="ml-auto">
                                    <button
                                        onClick={() => router.push(backUrl)}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 hover:text-indigo-300 transition-colors"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        Back to Rankings
                                    </button>
                                </div>
                            </div>

                            {/* TAB: ANALYSIS */}
                            {activeTab === 'analysis' && (
                                <div className="space-y-8 animate-fadeIn">
                                    {/* Executive Summary Card */}
                                    <div className="glass-panel rounded-3xl p-8">
                                        <div className="flex justify-between items-start mb-4">
                                            <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase">Executive Summary</h3>
                                            <button
                                                onClick={() => router.push(backUrl)}
                                                className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors text-sm font-medium"
                                            >
                                                <ArrowLeft className="w-4 h-4" />
                                                Back to Rankings
                                            </button>
                                        </div>
                                        <p className="text-lg text-gray-200 font-light leading-relaxed">
                                            {analytics.overall_synthesis || analytics.summary}
                                        </p>
                                        <div className="mt-8 flex items-center gap-8">
                                            <div className="flex items-center gap-4">
                                                <div className="text-6xl font-bold text-white">{analytics.overall_score || 0}</div>
                                                <div className="text-gray-400">/ 100 Match Score</div>
                                            </div>
                                            {analytics.recommendation && (
                                                <div className={`px-4 py-2 rounded-full text-sm font-semibold ${analytics.recommendation.includes('Strong Hire') || analytics.recommendation.includes('Hire')
                                                    ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                                    : analytics.recommendation.includes('No Hire')
                                                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                                        : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                                                    }`}>
                                                    {analytics.recommendation}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Question-by-Question Analysis */}
                                    {analytics.question_analytics && analytics.question_analytics.length > 0 && (
                                        <div className="glass-panel rounded-3xl p-8">
                                            <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase mb-6 flex items-center gap-2">
                                                <MessageSquare className="w-4 h-4" /> Question Analysis
                                            </h3>
                                            <div className="space-y-6">
                                                {analytics.question_analytics.map((qa, i) => (
                                                    <div key={i} className="group relative p-8 rounded-3xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all duration-500 ease-out">
                                                        {/* Decorative Gradient Glow */}
                                                        <div className={`absolute -inset-0.5 rounded-3xl opacity-0 group-hover:opacity-100 transition duration-500 blur-2xl ${qa.quality_score >= 80 ? 'bg-green-500/10' : qa.quality_score >= 50 ? 'bg-yellow-500/10' : 'bg-red-500/10'
                                                            }`} />

                                                        <div className="relative">
                                                            {/* Header Section */}
                                                            <div className="flex justify-between items-start gap-6 mb-6">
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/40">
                                                                            {(qa.topic && qa.topic.toLowerCase() !== "none") ? qa.topic : "General"}
                                                                        </span>
                                                                        <div className="h-px w-8 bg-white/10" />
                                                                    </div>
                                                                    <h4 className="text-xl font-medium text-white leading-snug tracking-tight">
                                                                        {qa.question}
                                                                    </h4>
                                                                </div>

                                                                {/* Big Score Badge */}
                                                                <div className="flex flex-col items-center">
                                                                    <div className={`text-4xl font-light tracking-tighter ${qa.quality_score >= 80 ? 'text-green-400' :
                                                                        qa.quality_score >= 50 ? 'text-yellow-400' : 'text-red-400'
                                                                        }`}>
                                                                        {qa.quality_score}
                                                                    </div>
                                                                    <div className="text-[10px] font-medium uppercase tracking-widest text-white/30 mt-1">
                                                                        Match
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Answer Summary */}
                                                            <div className="mb-8">
                                                                <p className="text-base text-gray-300 font-light leading-relaxed">
                                                                    {qa.answer_summary}
                                                                </p>
                                                            </div>

                                                            {/* Footer Grid: Metrics & Insight */}
                                                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                                                                {/* Granular Metrics (3 cols) */}
                                                                <div className="lg:col-span-3 flex justify-between items-center py-4 px-6 rounded-2xl bg-black/20 border border-white/5">
                                                                    {[
                                                                        { label: "Relevance", value: qa.relevance_score },
                                                                        { label: "Clarity", value: qa.clarity_score },
                                                                        { label: "Depth", value: qa.depth_score }
                                                                    ].map((metric, idx) => (
                                                                        <div key={idx} className="flex flex-col items-center w-full px-2">
                                                                            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">
                                                                                {metric.label}
                                                                            </span>
                                                                            <div className="flex items-baseline gap-0.5">
                                                                                <span className={`text-xl font-medium ${(metric.value ?? 0) >= 8 ? 'text-white' : 'text-white/70'
                                                                                    }`}>
                                                                                    {metric.value ?? '-'}
                                                                                </span>
                                                                                <span className="text-xs text-white/20">/10</span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>

                                                                {/* Key Insight (2 cols) */}
                                                                {qa.key_insight && (
                                                                    <div className="lg:col-span-2 flex items-center p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
                                                                        <div className="flex gap-3">
                                                                            <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0 mt-1" />
                                                                            <p className="text-xs text-blue-200/90 leading-relaxed font-medium">
                                                                                {qa.key_insight}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Skill Evidence & Behavioral Profile */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Skill Evidence */}
                                        {analytics.skill_evidence && analytics.skill_evidence.length > 0 && (
                                            <div className="glass-panel rounded-3xl p-6">
                                                <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase mb-4 flex items-center gap-2">
                                                    <CheckCircle className="w-4 h-4 text-green-400" /> Verified Skills
                                                </h3>
                                                <div className="space-y-3">
                                                    {analytics.skill_evidence.map((skill, i) => (
                                                        <div key={i} className="p-3 rounded-xl bg-green-500/5 border border-green-500/10">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-sm font-medium text-green-300">{skill.skill}</span>
                                                                <span className={`text-xs px-2 py-0.5 rounded ${skill.confidence === 'High' ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'
                                                                    }`}>{skill.confidence}</span>
                                                            </div>
                                                            <p className="text-xs text-gray-400 italic">&ldquo;{skill.quote}&rdquo;</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Behavioral Profile */}
                                        {analytics.behavioral_profile && (
                                            <div className="glass-panel rounded-3xl p-6">
                                                <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase mb-4 flex items-center gap-2">
                                                    <TrendingUp className="w-4 h-4 text-purple-400" /> Behavioral Profile
                                                </h3>
                                                <div className="flex justify-center">
                                                    <RadarChart data={analytics.behavioral_profile} />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Red Flags & Highlights */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Red Flags */}
                                        {analytics.red_flags && analytics.red_flags.length > 0 && (
                                            <div className="glass-panel rounded-3xl p-6">
                                                <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase mb-4 flex items-center gap-2">
                                                    <Flag className="w-4 h-4 text-red-400" /> Concerns & Red Flags
                                                </h3>
                                                <div className="space-y-3">
                                                    {analytics.red_flags.map((flag, i) => (
                                                        <div key={i} className={`p-3 rounded-xl border ${
                                                            flag.severity === 'High' ? 'bg-red-500/10 border-red-500/20' :
                                                            flag.severity === 'Medium' ? 'bg-yellow-500/10 border-yellow-500/20' :
                                                            'bg-orange-500/10 border-orange-500/20'
                                                        }`}>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className={`text-sm font-medium ${
                                                                    flag.severity === 'High' ? 'text-red-300' :
                                                                    flag.severity === 'Medium' ? 'text-yellow-300' :
                                                                    'text-orange-300'
                                                                }`}>{flag.concern}</span>
                                                                <span className={`text-xs px-2 py-0.5 rounded ${
                                                                    flag.severity === 'High' ? 'bg-red-500/20 text-red-300' :
                                                                    flag.severity === 'Medium' ? 'bg-yellow-500/20 text-yellow-300' :
                                                                    'bg-orange-500/20 text-orange-300'
                                                                }`}>{flag.severity}</span>
                                                            </div>
                                                            <p className="text-xs text-gray-400 italic">&ldquo;{flag.evidence}&rdquo;</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Highlights */}
                                        {analytics.highlights && analytics.highlights.length > 0 && (
                                            <div className="glass-panel rounded-3xl p-6">
                                                <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase mb-4 flex items-center gap-2">
                                                    <Star className="w-4 h-4 text-yellow-400" /> Standout Moments
                                                </h3>
                                                <div className="space-y-3">
                                                    {analytics.highlights.map((highlight, i) => (
                                                        <div key={i} className="p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                                                            <div className="flex items-start gap-2 mb-2">
                                                                <Sparkles className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                                                                <span className="text-sm font-medium text-yellow-300">{highlight.moment}</span>
                                                            </div>
                                                            <p className="text-xs text-gray-300 italic mb-2">&ldquo;{highlight.quote}&rdquo;</p>
                                                            <p className="text-xs text-gray-500">{highlight.why_notable}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Role Competencies */}
                                    {analytics.role_competencies && analytics.role_competencies.length > 0 && (
                                        <div className="glass-panel rounded-3xl p-6">
                                            <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase mb-4 flex items-center gap-2">
                                                <Target className="w-4 h-4 text-cyan-400" /> Role-Specific Competencies
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {analytics.role_competencies.map((comp, i) => (
                                                    <div key={i} className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <span className="text-sm font-medium text-cyan-300">{comp.competency}</span>
                                                            <div className={`text-2xl font-light ${
                                                                comp.score >= 8 ? 'text-green-400' :
                                                                comp.score >= 6 ? 'text-yellow-400' :
                                                                'text-red-400'
                                                            }`}>
                                                                {comp.score}<span className="text-xs text-gray-500">/10</span>
                                                            </div>
                                                        </div>
                                                        <p className="text-xs text-gray-400 italic mb-2">&ldquo;{comp.evidence_quote}&rdquo;</p>
                                                        <p className="text-xs text-gray-500">{comp.assessment}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Cultural Fit & Enthusiasm */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Cultural Fit */}
                                        {analytics.cultural_fit && (
                                            <div className="glass-panel rounded-3xl p-6">
                                                <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase mb-4 flex items-center gap-2">
                                                    <Users className="w-4 h-4 text-pink-400" /> Cultural Fit
                                                </h3>
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm text-gray-400">Values Alignment</span>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full ${
                                                                        analytics.cultural_fit.values_alignment >= 8 ? 'bg-green-500' :
                                                                        analytics.cultural_fit.values_alignment >= 6 ? 'bg-yellow-500' :
                                                                        'bg-red-500'
                                                                    }`}
                                                                    style={{ width: `${analytics.cultural_fit.values_alignment * 10}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-white font-medium text-sm">{analytics.cultural_fit.values_alignment}/10</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-gray-500 uppercase tracking-wider">Work Style</span>
                                                        <p className="text-sm text-gray-300 mt-1">{analytics.cultural_fit.work_style}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-gray-500 uppercase tracking-wider">What Motivates Them</span>
                                                        <div className="flex flex-wrap gap-2 mt-2">
                                                            {analytics.cultural_fit.motivation_drivers.map((driver, i) => (
                                                                <span key={i} className="px-2 py-1 text-xs rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/20">
                                                                    {driver}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-gray-500 uppercase tracking-wider">Team Fit Notes</span>
                                                        <p className="text-xs text-gray-400 mt-1">{analytics.cultural_fit.team_fit_notes}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Enthusiasm */}
                                        {analytics.enthusiasm && (
                                            <div className="glass-panel rounded-3xl p-6">
                                                <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase mb-4 flex items-center gap-2">
                                                    <Zap className="w-4 h-4 text-amber-400" /> Enthusiasm & Engagement
                                                </h3>
                                                <div className="space-y-4">
                                                    <div className="grid grid-cols-3 gap-3">
                                                        <div className="text-center p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                                                            <div className={`text-2xl font-light ${
                                                                analytics.enthusiasm.overall_enthusiasm >= 8 ? 'text-green-400' :
                                                                analytics.enthusiasm.overall_enthusiasm >= 6 ? 'text-yellow-400' :
                                                                'text-red-400'
                                                            }`}>{analytics.enthusiasm.overall_enthusiasm}</div>
                                                            <div className="text-[10px] text-gray-500 uppercase mt-1">Overall</div>
                                                        </div>
                                                        <div className="text-center p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                                                            <div className={`text-2xl font-light ${
                                                                analytics.enthusiasm.role_interest >= 8 ? 'text-green-400' :
                                                                analytics.enthusiasm.role_interest >= 6 ? 'text-yellow-400' :
                                                                'text-red-400'
                                                            }`}>{analytics.enthusiasm.role_interest}</div>
                                                            <div className="text-[10px] text-gray-500 uppercase mt-1">Role Interest</div>
                                                        </div>
                                                        <div className="text-center p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                                                            <div className={`text-2xl font-light ${
                                                                analytics.enthusiasm.company_interest >= 8 ? 'text-green-400' :
                                                                analytics.enthusiasm.company_interest >= 6 ? 'text-yellow-400' :
                                                                'text-red-400'
                                                            }`}>{analytics.enthusiasm.company_interest}</div>
                                                            <div className="text-[10px] text-gray-500 uppercase mt-1">Company</div>
                                                        </div>
                                                    </div>
                                                    {analytics.enthusiasm.questions_asked && analytics.enthusiasm.questions_asked.length > 0 && (
                                                        <div>
                                                            <span className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                                                <HelpCircle className="w-3 h-3" /> Questions They Asked
                                                            </span>
                                                            <ul className="mt-2 space-y-1">
                                                                {analytics.enthusiasm.questions_asked.map((q, i) => (
                                                                    <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                                                                        <span className="text-amber-400 mt-0.5">•</span>
                                                                        {q}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <span className="text-xs text-gray-500 uppercase tracking-wider">Engagement Notes</span>
                                                        <p className="text-xs text-gray-400 mt-1">{analytics.enthusiasm.engagement_notes}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Communication Metrics & Topics to Probe */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Communication Metrics */}
                                        {analytics.communication_metrics && (
                                            <div className="glass-panel rounded-3xl p-6">
                                                <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase mb-4 flex items-center gap-2">
                                                    <Volume2 className="w-4 h-4 text-blue-400" /> Communication Metrics
                                                </h3>
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm text-gray-400">Speaking Pace</span>
                                                        <span className="text-white font-medium">{analytics.communication_metrics.speaking_pace_wpm} WPM</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm text-gray-400">Filler Words</span>
                                                        <span className={`font-medium ${analytics.communication_metrics.filler_word_frequency === 'Low' ? 'text-green-400' :
                                                            analytics.communication_metrics.filler_word_frequency === 'Medium' ? 'text-yellow-400' : 'text-red-400'
                                                            }`}>{analytics.communication_metrics.filler_word_frequency}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm text-gray-400">Listen/Talk Ratio</span>
                                                        <span className="text-white font-medium">{(analytics.communication_metrics.listen_to_talk_ratio * 100).toFixed(0)}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Topics to Probe */}
                                        {analytics.topics_to_probe && analytics.topics_to_probe.length > 0 && (
                                            <div className="glass-panel rounded-3xl p-6">
                                                <h3 className="text-gray-400 text-sm font-medium tracking-wider uppercase mb-4 flex items-center gap-2">
                                                    <ChevronRight className="w-4 h-4 text-orange-400" /> Follow-Up Topics
                                                </h3>
                                                <ul className="space-y-2">
                                                    {analytics.topics_to_probe.map((topic, i) => (
                                                        <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                                                            <span className="text-orange-400 mt-0.5">•</span>
                                                            {topic}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* TAB: INTERVIEWER ANALYTICS */}
                            {activeTab === 'interviewer' && (
                                <InterviewerAnalyticsTab
                                    interviewId={currentInterviewId || undefined}
                                    analyticsData={interviewerAnalytics as Parameters<typeof InterviewerAnalyticsTab>[0]['analyticsData']}
                                />
                            )}

                            {/* TAB: TRANSCRIPT */}
                            {activeTab === 'transcript' && (
                                <TranscriptTab transcript={transcript} />
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-24 text-gray-500">
                            <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>No analytics generated for this session.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // MAIN INTERVIEW UI
    return (
        <div className="min-h-screen bg-[#000000] text-white font-sans overflow-hidden relative selection:bg-purple-500/30">
            {/* Deep Space Background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-purple-900/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-900/10 rounded-full blur-[120px] animate-pulse delay-1000" />
                <div className="absolute inset-0 bg-[url(/grid.svg)] opacity-20" />
            </div>

            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-xl border-b border-white/5 h-16 flex items-center justify-between px-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push(backUrl)} className="text-white/50 hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-sm font-medium text-white tracking-wide">Interview: {candidateName}</h1>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-white/40">Live Session</span>
                            {usingLiveKit && (
                                <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-400 font-medium">
                                    AI Powered
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* View Mode Toggle */}
                    <div className="flex items-center rounded-lg bg-white/5 border border-white/10 p-0.5">
                        <button
                            onClick={() => setViewMode('interviewer')}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                                viewMode === 'interviewer'
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'text-white/50 hover:text-white/80'
                            }`}
                        >
                            Interviewer
                        </button>
                        <button
                            onClick={() => setViewMode('candidate')}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                                viewMode === 'candidate'
                                    ? 'bg-purple-600 text-white shadow-lg'
                                    : 'text-white/50 hover:text-white/80'
                            }`}
                        >
                            Candidate
                        </button>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                        <span className="text-xs font-mono text-white/60">{formatTime(elapsedTime)}</span>
                    </div>
                    <button
                        onClick={() => setShowProfilePopup(true)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-colors flex items-center gap-2"
                    >
                        <User className="w-4 h-4" />
                        View Profile
                    </button>
                    <button
                        onClick={toggleMic}
                        className={`px-4 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-2 ${micEnabled
                            ? 'bg-green-500/10 hover:bg-green-500/20 border-green-500/20 text-green-400'
                            : 'bg-red-500/10 hover:bg-red-500/20 border-red-500/20 text-red-400'
                            }`}
                    >
                        {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                        {micEnabled ? 'Mute' : 'Unmute'}
                    </button>
                    <button
                        onClick={endInterview}
                        className="px-4 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-xs font-medium text-red-400 transition-colors"
                    >
                        End Session
                    </button>
                </div>
            </header>

            {/* Main Bento Grid Layout */}
            <main className="relative z-10 pt-20 pb-6 px-6 h-screen grid grid-cols-12 gap-6">

                {/* LEFT COLUMN: Voice & Transcript (8 cols) */}
                <div className="col-span-8 flex flex-col gap-6 h-full min-h-0">

                    {/* Voice Interface (Top - Flex Grow) */}
                    <div className="flex-1 glass-card-premium rounded-3xl p-8 relative overflow-hidden flex flex-col items-center justify-center min-h-0 bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl">
                        {/* Audio Visualizer / Avatar */}
                        <div className="relative mb-8">
                            <div className={`w-32 h-32 rounded-full border border-white/10 flex items-center justify-center relative z-10 bg-black/50 backdrop-blur-md transition-all duration-300 ${aiSpeaking ? 'shadow-[0_0_50px_rgba(168,85,247,0.4)] border-purple-500/50' : ''}`}>
                                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                                    <Volume2 className={`w-10 h-10 ${aiSpeaking ? 'text-purple-400' : 'text-white/20'}`} />
                                </div>
                            </div>
                            {/* Ripple Effects during speech */}
                            {aiSpeaking && (
                                <>
                                    <div className="absolute inset-0 rounded-full border border-purple-500/30 animate-ping opacity-20" />
                                    <div className="absolute inset-[-20%] rounded-full border border-purple-500/10 animate-pulse delay-75" />
                                </>
                            )}
                        </div>

                        {/* Status Text */}
                        <div className="text-center">
                            <h2 className="text-2xl font-light text-white mb-2 tracking-tight">
                                {viewMode === 'interviewer'
                                    ? (aiSpeaking ? `${candidateName} is speaking...` : "Waiting for response...")
                                    : (aiSpeaking ? "Interviewer is speaking..." : "Your turn to speak...")
                                }
                            </h2>
                            <p className="text-white/40 text-sm font-light tracking-wide">
                                {connected ? "Live Session Active" : "Connecting..."}
                            </p>
                        </div>
                    </div>

                </div>

                {/* RIGHT COLUMN: Chat & Assistant (4 cols) */}
                <div className="col-span-4 flex flex-col gap-6 h-full min-h-0">

                    {/* Copilot Suggestions - Only show in Interviewer mode */}
                    {viewMode === 'interviewer' ? (
                    <div className="flex-1 glass-card-premium rounded-3xl p-6 relative flex flex-col min-h-0 bg-black/40 backdrop-blur-xl border border-white/10">
                        <h3 className="text-xs font-medium text-white/40 mb-4 uppercase tracking-wider flex items-center gap-2">
                            <Sparkles className="w-3 h-3 text-yellow-400" /> AI Coach Suggestions
                        </h3>
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                            {aiSuggestions.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-white/20 text-xs italic text-center px-4">
                                    AI suggestions will appear here after each interview exchange...
                                </div>
                            ) : (
                                aiSuggestions.map((suggestion, i) => {
                                    // Determine color based on verdict/category - only green or red
                                    const verdict = (suggestion.category || "ADEQUATE").toUpperCase();
                                    let colorClass: string;
                                    let titleColor: string;

                                    if (["STRONG", "ADEQUATE"].includes(verdict)) {
                                        // Positive assessments - green
                                        colorClass = "bg-green-500/10 border-green-500/20 text-green-300";
                                        titleColor = "text-green-300";
                                    } else {
                                        // Negative/needs work assessments (WEAK, INADEQUATE, NEEDS_PROBING, etc.) - red
                                        colorClass = "bg-red-500/10 border-red-500/20 text-red-300";
                                        titleColor = "text-red-300";
                                    }

                                    return (
                                        <div key={i} className={`p-4 rounded-xl space-y-3 border ${colorClass}`}>
                                            {/* Header: Verdict & Question Type */}
                                            <div className="flex justify-between items-start border-b border-white/5 pb-2">
                                                <div className={`text-xs font-bold uppercase tracking-wider ${titleColor}`}>
                                                    {verdict}
                                                </div>
                                                {suggestion.issue_type && suggestion.issue_type !== "none" && (
                                                    <div className="text-[10px] uppercase tracking-wider text-white/50 bg-white/5 px-2 py-0.5 rounded">
                                                        {suggestion.issue_type.replace(/_/g, " ")}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Main Suggestion */}
                                            <div>
                                                <p className="text-sm text-white/90 font-medium leading-relaxed">
                                                    "{suggestion.suggestion}"
                                                </p>
                                            </div>

                                            {/* Consistency Check */}
                                            {suggestion.issue_type === "prior_interview_contradiction" && (
                                                <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
                                                    <div className="text-[10px] uppercase tracking-wider text-white/50">
                                                        Consistency Check
                                                    </div>
                                                    {suggestion.prior_round && (
                                                        <div className="text-[10px] uppercase tracking-wider text-white/40">
                                                            Prior round: <span className="text-white/60">{suggestion.prior_round}</span>
                                                        </div>
                                                    )}
                                                    {suggestion.prior_quote && (
                                                        <blockquote className="text-xs text-white/70 italic border-l-2 border-white/20 pl-3">
                                                            &ldquo;{suggestion.prior_quote}&rdquo;
                                                        </blockquote>
                                                    )}
                                                    {suggestion.current_quote && (
                                                        <blockquote className="text-xs text-white/70 italic border-l-2 border-white/20 pl-3">
                                                            &ldquo;{suggestion.current_quote}&rdquo;
                                                        </blockquote>
                                                    )}
                                                </div>
                                            )}

                                            {/* Footer: Reasoning & Type */}
                                            {(suggestion.reasoning || suggestion.last_question_type) && (
                                                <div className="pt-2 border-t border-white/5 flex flex-col gap-1">
                                                    {suggestion.last_question_type && (
                                                        <div className="text-[10px] uppercase tracking-wider text-white/40">
                                                            Type: <span className="text-white/60">{suggestion.last_question_type}</span>
                                                        </div>
                                                    )}
                                                    {suggestion.reasoning && (
                                                        <p className="text-xs text-white/50 italic leading-snug">
                                                            {suggestion.reasoning}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                    ) : (
                    /* Candidate View - Interview Tips Panel */
                    <div className="flex-1 glass-card-premium rounded-3xl p-6 relative flex flex-col min-h-0 bg-black/40 backdrop-blur-xl border border-purple-500/20">
                        <h3 className="text-xs font-medium text-purple-400/80 mb-4 uppercase tracking-wider flex items-center gap-2">
                            <Sparkles className="w-3 h-3 text-purple-400" /> Candidate View
                        </h3>
                        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 space-y-4">
                            <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center">
                                <User className="w-8 h-8 text-purple-400" />
                            </div>
                            <div>
                                <h4 className="text-lg font-medium text-white mb-2">You are the Candidate</h4>
                                <p className="text-sm text-white/50 leading-relaxed">
                                    In this view, you're simulating the candidate experience. The AI is playing the interviewer role.
                                </p>
                            </div>
                            <div className="pt-4 border-t border-white/10 w-full">
                                <p className="text-xs text-white/40 italic">
                                    💡 Tip: Answer questions naturally. The AI will evaluate your responses and provide coaching feedback after the interview.
                                </p>
                            </div>
                        </div>
                    </div>
                    )}

                    {/* AI Assistant Chat */}
                    <div className="h-80 glass-card-premium rounded-3xl p-4 relative flex flex-col min-h-0 bg-black/40 backdrop-blur-xl border border-white/10">
                        <h3 className="text-xs font-medium text-white/40 mb-3 uppercase tracking-wider flex items-center gap-2 px-2">
                            <MessageSquare className="w-3 h-3" /> Assistant Chat
                        </h3>

                        {/* Chat Messages */}
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-3 custom-scrollbar px-2">
                            {chatMessages.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-white/20 text-xs italic text-center px-4">
                                    Ask the AI Assistant for help or quick facts...
                                </div>
                            ) : (
                                chatMessages.map((msg, i) => (
                                    <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                                        <div className={`py-2 px-3 rounded-xl max-w-[90%] text-xs ${msg.role === "user"
                                            ? "bg-blue-600 text-white"
                                            : "bg-white/10 text-white/80"
                                            }`}>
                                            {msg.role === "assistant" ? renderAssistantMessage(msg.content) : msg.content}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Chat Input */}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                                placeholder="Ask AI Assistant..."
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors"
                            />
                            <button
                                onClick={sendChatMessage}
                                disabled={chatLoading || !chatInput.trim()}
                                className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white transition-colors"
                            >
                                {chatLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </div>

            </main>

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
        </div>
    );
}

export default function InterviewPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
        }>
            <InterviewPageContent />
        </Suspense>
    );
}
