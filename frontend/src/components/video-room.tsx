"use client";

import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import Daily from "@daily-co/daily-js";
import {
    DailyProvider,
    useDaily,
    useLocalSessionId,
    useParticipantIds,
    useVideoTrack,
    useAudioTrack,
    DailyVideo,
    useDailyEvent,
} from "@daily-co/daily-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getBriefing, getPreInterviewBrief, PreInterviewBrief } from "@/lib/api";
import useOpenAIRealtimeAgent from "@/components/openai-realtime-agent";
import { ClipboardList } from "lucide-react";

// Dynamic import for AI sidebar
const AIChatSidebar = dynamic(() => import("@/components/ai-chat-sidebar"), {
    ssr: false,
    loading: () => null,
});

// Dynamic import for PreInterviewBriefComponent overlay (reuse existing)
const PreInterviewBriefComponent = dynamic(() => import("@/components/pre-interview-brief"), {
    ssr: false,
    loading: () => <div className="text-white">Loading Briefing...</div>
});

interface VideoRoomProps {
    roomUrl: string;
    roomName: string;
    token: string;
    participantType: "interviewer" | "candidate";
    participantName: string;
    onLeave?: () => void;
    onEndInterview?: (transcript?: string) => void;
    initialBrief?: PreInterviewBrief | null;
}

function VideoTile({ sessionId, isLocal, label }: { sessionId: string; isLocal: boolean; label: string }) {
    const videoState = useVideoTrack(sessionId);
    const audioState = useAudioTrack(sessionId);

    return (
        <Card className={`relative overflow-hidden ${isLocal ? "col-span-1" : "col-span-2"}`}>
            <CardContent className="p-0 aspect-video bg-muted flex items-center justify-center">
                {videoState.isOff ? (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-2xl">{label[0]?.toUpperCase()}</span>
                        </div>
                        <span>Camera off</span>
                    </div>
                ) : (
                    <DailyVideo
                        sessionId={sessionId}
                        type="video"
                        automirror
                        className="w-full h-full object-cover"
                    />
                )}

                {/* Label overlay */}
                <div className="absolute bottom-2 left-2 bg-black/60 text-white px-2 py-1 rounded text-sm flex items-center gap-2">
                    <span>{label}</span>
                    {isLocal && <span className="text-xs opacity-70">(You)</span>}
                    {audioState.isOff && (
                        <span className="text-red-400">🔇</span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

// AI Candidate tile with speaking indicator
function AICandidateTile({ isSpeaking, onRemove, candidateName }: { isSpeaking: boolean; onRemove: () => void; candidateName: string }) {
    const randomId = useState(() => Math.floor(Math.random() * 70) + 1)[0];

    return (
        <Card className={`relative overflow-hidden col-span-1 ${isSpeaking ? "ring-2 ring-green-500" : ""}`}>
            <CardContent className="p-0 aspect-video bg-muted flex items-center justify-center">
                <img
                    src={`https://i.pravatar.cc/400?img=${randomId}`}
                    alt="AI Candidate"
                    className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2 bg-black/60 text-white px-2 py-1 rounded text-sm flex items-center gap-2">
                    <span className={isSpeaking ? "animate-pulse" : ""}>
                        {isSpeaking ? "🗣️" : "🎧"} {candidateName} (AI)
                    </span>
                </div>
                <button
                    onClick={onRemove}
                    className="absolute top-2 right-2 bg-red-500/80 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
                >
                    ✕ End
                </button>
            </CardContent>
        </Card>
    );
}

function CallInterface({ roomUrl, roomName, token, participantType, participantName, onLeave, onEndInterview, initialBrief }: VideoRoomProps) {
    const daily = useDaily();
    const localSessionId = useLocalSessionId();
    const participantIds = useParticipantIds({ filter: "remote" });

    const [isCameraOn, setIsCameraOn] = useState(true);
    const [isMicOn, setIsMicOn] = useState(true);
    const [isJoining, setIsJoining] = useState(true);
    const [hasJoined, setHasJoined] = useState(false);
    const [showAICandidate, setShowAICandidate] = useState(false);
    const [candidateName, setCandidateName] = useState("Candidate");

    // Ref to track if we're ending interview (to prevent onLeave redirect)
    const isEndingInterviewRef = useRef(false);

    // AI sidebar state (only for interviewer)
    const [showAISidebar, setShowAISidebar] = useState(true);
    const [briefingContext, setBriefingContext] = useState<string | undefined>(undefined);

    // BRIEFING OVERLAY STATE
    const [showBriefingOverlay, setShowBriefingOverlay] = useState(false);
    // Initialize with cached brief if available
    const [fullBriefing, setFullBriefing] = useState<PreInterviewBrief | null>(initialBrief || null);

    // State for live transcript (from OpenAI Realtime)
    const [fullTranscript, setFullTranscript] = useState<string>("");
    // Track when interview started for coach mode elapsed time
    const [interviewStartTime] = useState<number>(Date.now());

    // Briefing data for AI candidate context
    const [briefingData, setBriefingData] = useState<{
        resume: string;
        role: string;
        jobDescription: string;
    }>({ resume: "", role: "", jobDescription: "" });

    // OpenAI Realtime Candidate Agent hook (replaces Vapi to avoid Daily conflict)
    const candidateAgent = useOpenAIRealtimeAgent({
        isActive: showAICandidate,
        roomName: roomName,
        candidateName: candidateName,
        role: briefingData.role,
        resume: briefingData.resume,
        jobDescription: briefingData.jobDescription,
        onStop: () => setShowAICandidate(false),
        onTranscriptUpdate: (transcript) => {
            // Convert transcript array to string for debrief
            const formatted = transcript.map(m => `${m.role === "user" ? "Interviewer" : "Candidate"}: ${m.content}`).join("\n");
            setFullTranscript(formatted);
        },
    });

    // Fetch briefing context for AI sidebar and candidate name
    useEffect(() => {
        if (participantType === "interviewer" && roomName) {
            // Use cached brief if available to set context immediately
            if (initialBrief) {
                setBriefingContext(initialBrief.tldr); // Use TLDR or similar as prompt fallback if needed
                setCandidateName(initialBrief.candidate_name);
                setBriefingData({
                    resume: "", // Full brief doesn't hold raw resume, consider adding if vital
                    role: initialBrief.current_role,
                    jobDescription: ""
                });
                // We still might want to fetch getBriefing for the specific prompt fields if they differ
            }

            getBriefing(roomName)
                .then(async (data) => {
                    setBriefingContext(data.briefing_prompt);

                    // Only fetch full visual pre-brief if NOT already provided via cache
                    if (!initialBrief && data.notes && data.resume_summary) {
                        try {
                            const brief = await getPreInterviewBrief(
                                roomName,
                                data.notes,
                                data.resume_summary
                            );
                            setFullBriefing(brief);
                        } catch (err) {
                            console.error("Failed to fetch full briefing for overlay:", err);
                        }
                    }

                    // Extract candidate name from briefing
                    if (data.candidate_name && data.candidate_name !== "the candidate") {
                        setCandidateName(data.candidate_name);
                    }
                    // Store briefing data for AI candidate context
                    setBriefingData({
                        resume: data.resume_summary || "",
                        role: data.role || "this position",
                        jobDescription: data.notes || "",
                    });
                })
                .catch(console.error);
        }
    }, [participantType, roomName, initialBrief]);

    // Join the call when component mounts
    useEffect(() => {
        if (!daily || hasJoined) return;

        const joinCall = async () => {
            try {
                setIsJoining(true);
                await daily.join({
                    url: roomUrl,
                    token: token,
                    userName: participantName,
                    startVideoOff: false,
                    startAudioOff: false,
                });
                setHasJoined(true);
            } catch (error) {
                console.error("Failed to join call:", error);
            } finally {
                setIsJoining(false);
            }
        };

        joinCall();
    }, [daily, roomUrl, token, participantName, hasJoined]);



    // Handle left-meeting event
    useDailyEvent("left-meeting", () => {
        setHasJoined(false);
        // Only call onLeave if we're NOT transitioning to debrief
        if (!isEndingInterviewRef.current) {
            onLeave?.();
        }
    });

    // Listen for transcription messages (handled as app-message for many integrations or transcription-message)
    // Daily's transcription often comes as 'app-message' from the bot or 'transcription-message' event.
    // We will listen for both to cover different Daily configuration modes.
    useDailyEvent("app-message", (ev) => {
        // Standard Daily AI transcription format often comes via app-message if not native
        // But native transcription is 'transcription-message'
        const data = ev?.data as any;
        if (data?.event === "transcription" || data?.type === "transcription") {
            const speaker = data.user_name || "Speaker";
            const text = data.text;
            if (text) {
                setFullTranscript(prev => prev + `\n${speaker}: ${text}`);
            }
        }
    });

    // Also try the native transcription event if supported by the hook version
    useDailyEvent("transcription-message" as any, (ev: any) => {
        const speaker = ev.participantId === localSessionId ? "Interviewer" : "Candidate";
        // Note: participantId needs to be mapped to name if possible, simplified here
        const text = ev.text;
        if (text) {
            setFullTranscript(prev => prev + `\n${speaker}: ${text}`);
        }
    });

    const toggleCamera = useCallback(() => {
        if (daily) {
            daily.setLocalVideo(!isCameraOn);
            setIsCameraOn(!isCameraOn);
        }
    }, [daily, isCameraOn]);

    const toggleMic = useCallback(() => {
        if (daily) {
            daily.setLocalAudio(!isMicOn);
            setIsMicOn(!isMicOn);
        }
    }, [daily, isMicOn]);

    const leaveCall = useCallback(() => {
        if (daily) {
            daily.leave();
        }
    }, [daily]);



    // Auto-hide AI candidate tile if real participant joins
    useEffect(() => {
        if (participantIds.length > 0) {
            setShowAICandidate(false);
        }
    }, [participantIds]);

    const hasRemoteParticipants = participantIds.length > 0 || showAICandidate;

    // Show loading while joining (Must occur AFTER all hooks to prevent React errors)
    if (isJoining) {
        return (
            <div className="flex flex-col h-full items-center justify-center">
                <div className="animate-spin text-4xl mb-4">⏳</div>
                <p className="text-muted-foreground">Joining call...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full relative overflow-hidden">
            {/* AI Chat Sidebar - only for interviewer */}
            {participantType === "interviewer" && (
                <AIChatSidebar
                    roomName={roomName}
                    briefingContext={briefingContext}
                    isOpen={showAISidebar}
                    onToggle={() => setShowAISidebar(!showAISidebar)}
                    transcript={fullTranscript}
                    interviewStartTime={interviewStartTime}
                />
            )}

            {/* Video grid container - Using min-h-0 to allow flexbox shrinking */}
            <div className={`flex-1 min-h-0 p-4 transition-all duration-300 ${showAISidebar ? "mr-80" : ""}`}>
                <div className="h-full w-full grid grid-cols-1 md:grid-cols-2 gap-4">

                    {localSessionId && (
                        <div className="relative w-full h-full min-h-[300px] overflow-hidden rounded-xl">
                            <VideoTile
                                sessionId={localSessionId}
                                isLocal={true}
                                label={`${participantName} (${participantType})`}
                            />
                        </div>
                    )}

                    {participantIds.map((id) => (
                        <div key={id} className="relative w-full h-full min-h-[300px] overflow-hidden rounded-xl">
                            <VideoTile
                                sessionId={id}
                                isLocal={false}
                                label="Participant"
                            />
                        </div>
                    ))}

                    {/* AI Candidate tile */}
                    {showAICandidate && (
                        <div className="relative w-full h-full min-h-[300px] overflow-hidden rounded-xl">
                            <AICandidateTile
                                isSpeaking={candidateAgent.isSpeaking}
                                onRemove={() => {
                                    candidateAgent.stop();
                                    setShowAICandidate(false);
                                }}
                                candidateName={candidateName}
                            />
                        </div>
                    )}

                    {/* Waiting placeholder */}
                    {!hasRemoteParticipants && (
                        <div className="relative w-full h-full min-h-[300px] overflow-hidden rounded-xl">
                            <Card className="h-full w-full bg-gradient-to-br from-slate-900 to-violet-950 border-white/10">
                                <CardContent className="h-full flex flex-col items-center justify-center p-8 gap-6">
                                    <div className="text-center">
                                        <p className="text-white/60 text-lg mb-2">
                                            Waiting for candidate to join...
                                        </p>
                                        <p className="text-white/40 text-sm">
                                            Or practice with an AI-simulated candidate
                                        </p>
                                    </div>

                                    {participantType === "interviewer" && (
                                        <Button
                                            size="lg"
                                            className="bg-violet-600 hover:bg-violet-700 text-white px-8 py-6 text-lg gap-3"
                                            onClick={() => setShowAICandidate(true)}
                                        >
                                            🎭 Connect to AI Candidate
                                        </Button>
                                    )}

                                    <p className="text-white/30 text-xs text-center max-w-xs">
                                        The AI candidate uses OpenAI Realtime API to simulate a job interview
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </div>

            {/* BRIEFING OVERLAY - Modal Pop-up */}
            {showBriefingOverlay && fullBriefing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4 md:p-8">
                    <div className="w-full max-w-6xl h-[90vh] bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200 flex flex-col relative">
                        <PreInterviewBriefComponent
                            brief={fullBriefing}
                            onClose={() => setShowBriefingOverlay(false)}
                            isOverlay={true}
                        // No voice activation needed for the overlay context
                        />
                    </div>
                </div>
            )}

            {/* Controls Bar - Fixed height, shrink-0 to prevent squash */}
            <div className={`shrink-0 p-4 border-t bg-card transition-all duration-300 ${showAISidebar ? "mr-80" : ""}`}>
                <div className="flex justify-center gap-4">
                    <Button
                        variant={isCameraOn ? "secondary" : "destructive"}
                        size="lg"
                        onClick={toggleCamera}
                    >
                        {isCameraOn ? "📹" : "📷"} Camera
                    </Button>

                    <Button
                        variant={isMicOn ? "secondary" : "destructive"}
                        size="lg"
                        onClick={toggleMic}
                    >
                        {isMicOn ? "🎙️" : "🔇"} Mic
                    </Button>

                    {/* NEW BRIEFING BUTTON */}
                    {participantType === "interviewer" && (
                        <Button
                            className="bg-slate-700 hover:bg-slate-600 text-white"
                            size="lg"
                            onClick={() => setShowBriefingOverlay(!showBriefingOverlay)}
                        >
                            <ClipboardList className="w-5 h-5 mr-2" />
                            Briefing
                        </Button>
                    )}

                    {participantType === "interviewer" ? (
                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white"
                            size="lg"
                            onClick={() => {
                                // Set flag BEFORE anything else to prevent onLeave redirect
                                isEndingInterviewRef.current = true;

                                // Stop the AI candidate agent if active
                                if (showAICandidate) {
                                    candidateAgent.stop();
                                    setShowAICandidate(false);
                                }

                                // FIRST: Trigger transition to debrief (before Daily leave)
                                if (onEndInterview) {
                                    onEndInterview(fullTranscript);
                                }

                                // THEN: Leave the Daily call (after parent state change)
                                if (daily) {
                                    daily.leave();
                                }
                            }}
                        >
                            End Interview
                        </Button>
                    ) : (
                        <Button
                            variant="destructive"
                            size="lg"
                            onClick={leaveCall}
                        >
                            Leave Call
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}


export default function VideoRoom({ roomUrl, roomName, token, participantType, participantName, onLeave, onEndInterview, initialBrief }: VideoRoomProps) {
    // Create callObject with allowMultipleCallInstances to avoid conflict with other Daily instances
    const callObject = useMemo(() => {
        return Daily.createCallObject({
            allowMultipleCallInstances: true,
        });
    }, []);

    return (
        <DailyProvider callObject={callObject}>
            <CallInterface
                roomUrl={roomUrl}
                roomName={roomName}
                token={token}
                participantType={participantType}
                participantName={participantName}
                onLeave={onLeave}
                onEndInterview={onEndInterview}
                initialBrief={initialBrief}
            />
        </DailyProvider>
    );
}
