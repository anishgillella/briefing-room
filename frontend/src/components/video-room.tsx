"use client";

import { useCallback, useState, useEffect, useMemo } from "react";
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
import { getBriefing } from "@/lib/api";
import useOpenAIRealtimeAgent from "@/components/openai-realtime-agent";

// Dynamic import for AI sidebar
const AIChatSidebar = dynamic(() => import("@/components/ai-chat-sidebar"), {
    ssr: false,
    loading: () => null,
});

interface VideoRoomProps {
    roomUrl: string;
    roomName: string;
    token: string;
    participantType: "interviewer" | "candidate";
    participantName: string;
    onLeave?: () => void;
    onEndInterview?: (transcript?: string) => void;
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

function CallInterface({ roomUrl, roomName, token, participantType, participantName, onLeave, onEndInterview }: {
    roomUrl: string;
    roomName: string;
    token: string;
    participantType: "interviewer" | "candidate";
    participantName: string;
    onLeave?: () => void;
    onEndInterview?: (transcript?: string) => void;
}) {
    const daily = useDaily();
    const localSessionId = useLocalSessionId();
    const participantIds = useParticipantIds({ filter: "remote" });

    const [isCameraOn, setIsCameraOn] = useState(true);
    const [isMicOn, setIsMicOn] = useState(true);
    const [isJoining, setIsJoining] = useState(true);
    const [hasJoined, setHasJoined] = useState(false);
    const [showAICandidate, setShowAICandidate] = useState(false);
    const [candidateName, setCandidateName] = useState("Candidate");

    // AI sidebar state (only for interviewer)
    const [showAISidebar, setShowAISidebar] = useState(false);
    const [briefingContext, setBriefingContext] = useState<string | undefined>(undefined);

    // State for live transcript (from OpenAI Realtime)
    const [fullTranscript, setFullTranscript] = useState<string>("");

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
            getBriefing(roomName)
                .then((data) => {
                    setBriefingContext(data.briefing_prompt);
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
    }, [participantType, roomName]);

    // ... (rest of effects) ...



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
        onLeave?.();
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
        <div className="flex flex-col h-full">
            {/* AI Chat Sidebar - only for interviewer */}
            {participantType === "interviewer" && (
                <AIChatSidebar
                    roomName={roomName}
                    briefingContext={briefingContext}
                    isOpen={showAISidebar}
                    onToggle={() => setShowAISidebar(!showAISidebar)}
                />
            )}

            {/* Video grid */}
            <div className={`flex-1 p-4 grid grid-cols-2 gap-4 auto-rows-fr ${showAISidebar ? "mr-80" : ""}`}>
                {localSessionId && (
                    <VideoTile
                        sessionId={localSessionId}
                        isLocal={true}
                        label={`${participantName} (${participantType})`}
                    />
                )}

                {participantIds.map((id) => (
                    <VideoTile
                        key={id}
                        sessionId={id}
                        isLocal={false}
                        label="Participant"
                    />
                ))}

                {/* AI Candidate tile */}
                {showAICandidate && (
                    <AICandidateTile
                        isSpeaking={candidateAgent.isSpeaking}
                        onRemove={() => {
                            candidateAgent.stop();
                            setShowAICandidate(false);
                        }}
                        candidateName={candidateName}
                    />
                )}

                {/* Waiting placeholder */}
                {!hasRemoteParticipants && (
                    <Card className="col-span-1 bg-muted/50">
                        <CardContent className="h-full flex flex-col items-center justify-center p-4 gap-4">
                            <p className="text-muted-foreground text-center">
                                Waiting for {participantType === "interviewer" ? "candidate" : "interviewer"} to join...
                            </p>
                            {participantType === "interviewer" && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        console.log("[VideoRoom] Connect to AI Candidate clicked!");
                                        console.log("[VideoRoom] Current showAICandidate state:", showAICandidate);
                                        // Activate the Vapi candidate agent
                                        setShowAICandidate(true);
                                        console.log("[VideoRoom] setShowAICandidate(true) called");
                                    }}
                                >
                                    🎭 Connect to AI Candidate
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Controls */}
            <div className={`p-4 border-t bg-card ${showAISidebar ? "mr-80" : ""}`}>
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

                    {participantType === "interviewer" ? (
                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white"
                            size="lg"
                            onClick={() => {
                                // If end interview is provided (caller handles it), otherwise just leave
                                if (onEndInterview) {
                                    onEndInterview(fullTranscript);
                                } else if (onLeave) {
                                    onLeave();
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


export default function VideoRoom({ roomUrl, roomName, token, participantType, participantName, onLeave, onEndInterview }: VideoRoomProps) {
    // Create callObject with allowMultipleCallInstances to avoid conflict with Vapi's Daily instance
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
            />
        </DailyProvider>
    );
}
