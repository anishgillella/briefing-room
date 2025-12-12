"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    Upload,
    Check,
    ChevronRight,
    Mic,
    Sparkles,
    X,
    Activity,
    Trophy,
    Code,
    Briefcase,
    GraduationCap,
    AlertTriangle,
    ThumbsUp,
    ThumbsDown,
    HelpCircle,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000";

// --- Components ---

const ProgressBar = ({ step }: { step: string }) => {
    const steps = ["upload", "review", "voice", "complete"];
    const currentIndex = steps.indexOf(step);

    return (
        <div className="flex items-center gap-2 w-full max-w-md mx-auto mb-8">
            {steps.map((s, i) => (
                <div key={s} className="flex-1 flex items-center">
                    <div
                        className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= currentIndex ? "bg-white" : "bg-white/10"
                            }`}
                    />
                </div>
            ))}
        </div>
    );
};

const FieldCard = ({ label, value, icon }: { label: string; value: string | undefined; icon?: React.ReactNode }) => (
    <div className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
        <div className="flex items-center gap-2 mb-1">
            {icon && <span className="text-purple-400">{icon}</span>}
            <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
        </div>
        <span className="text-white font-medium">{value || "—"}</span>
    </div>
);

const ProjectCard = ({ project }: { project: any }) => (
    <div className="p-4 bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/10 rounded-xl">
        <h4 className="font-semibold text-white mb-2">{project.name || "Unnamed Project"}</h4>
        <p className="text-sm text-white/60 mb-3">{project.description || "No description"}</p>
        {project.technologies?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
                {project.technologies.slice(0, 5).map((tech: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 bg-white/10 text-white/70 text-xs rounded-full">
                        {tech}
                    </span>
                ))}
            </div>
        )}
    </div>
);

const WorkHistoryCard = ({ job }: { job: any }) => (
    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
        <div className="flex justify-between items-start mb-2">
            <div>
                <h4 className="font-semibold text-white">{job.title || "Unknown Title"}</h4>
                <p className="text-purple-400 text-sm">{job.company || "Unknown Company"}</p>
            </div>
            <span className="text-xs text-white/40">
                {job.start_date || "?"} - {job.end_date || "Present"}
            </span>
        </div>
        {job.key_achievements?.length > 0 && (
            <ul className="text-sm text-white/60 list-disc list-inside mt-2">
                {job.key_achievements.slice(0, 2).map((a: string, i: number) => (
                    <li key={i}>{a}</li>
                ))}
            </ul>
        )}
    </div>
);

const AnalysisSection = ({ analysis }: { analysis: any }) => {
    if (!analysis) return null;

    return (
        <section className="space-y-6 mt-8 pt-8 border-t border-white/10">
            <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" /> AI Analysis
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Strengths */}
                {analysis.strengths?.length > 0 && (
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                        <h4 className="text-green-400 font-semibold mb-3 flex items-center gap-2">
                            <ThumbsUp className="w-4 h-4" /> Strengths
                        </h4>
                        <ul className="space-y-1 text-sm text-white/70">
                            {analysis.strengths.map((s: string, i: number) => (
                                <li key={i}>• {s}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Weaknesses */}
                {analysis.weaknesses?.length > 0 && (
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                        <h4 className="text-yellow-400 font-semibold mb-3 flex items-center gap-2">
                            <ThumbsDown className="w-4 h-4" /> Areas to Probe
                        </h4>
                        <ul className="space-y-1 text-sm text-white/70">
                            {analysis.weaknesses.map((w: string, i: number) => (
                                <li key={i}>• {w}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Red Flags */}
                {analysis.red_flags?.length > 0 && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                        <h4 className="text-red-400 font-semibold mb-3 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" /> Red Flags
                        </h4>
                        <ul className="space-y-1 text-sm text-white/70">
                            {analysis.red_flags.map((r: string, i: number) => (
                                <li key={i}>• {r}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Why Consider */}
                {analysis.why_consider && (
                    <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                        <h4 className="text-purple-400 font-semibold mb-3 flex items-center gap-2">
                            <Trophy className="w-4 h-4" /> Why Consider
                        </h4>
                        <p className="text-sm text-white/70">{analysis.why_consider}</p>
                    </div>
                )}
            </div>

            {/* Suggested Questions */}
            {analysis.suggested_questions?.length > 0 && (
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <h4 className="text-white/60 font-semibold mb-3 flex items-center gap-2">
                        <HelpCircle className="w-4 h-4" /> Suggested Interview Questions
                    </h4>
                    <ul className="space-y-2 text-sm text-white/70">
                        {analysis.suggested_questions.map((q: string, i: number) => (
                            <li key={i} className="flex items-start gap-2">
                                <span className="text-purple-400">{i + 1}.</span>
                                <span>{q}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
};

// ============================================================================
// Main Page Component
// ============================================================================

export default function VoiceOnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState<"upload" | "review" | "voice" | "complete">("upload");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);

    const [candidateId, setCandidateId] = useState<string | null>(null);
    const [extracted, setExtracted] = useState<any>(null);
    const [gaps, setGaps] = useState<any>(null);
    const [voiceConfig, setVoiceConfig] = useState<any>(null);

    const [voiceActive, setVoiceActive] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [liveFields, setLiveFields] = useState<Record<string, any>>({});
    const [questions, setQuestions] = useState<string[]>([]);

    // LiveKit state
    const [livekitToken, setLivekitToken] = useState<string | null>(null);
    const [livekitUrl, setLivekitUrl] = useState<string | null>(null);
    const [roomName, setRoomName] = useState<string | null>(null);

    // Store Room instance to disconnect later
    const roomRef = useRef<any>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setFile(e.target.files[0]);
            setError(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch(`${API_URL}/api/resume/upload`, {
                method: "POST",
                body: formData,
            });

            if (!res.ok) throw new Error("Upload failed. Ensure backend is running.");

            const data = await res.json();
            setCandidateId(data.candidate_id);
            setExtracted(data.extracted_data);
            setGaps(data.gaps);
            setVoiceConfig(data.voice_session_config);
            setStep("review");
        } catch (e: any) {
            setError(e.message || "Failed to analyze resume.");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const startVoice = async () => {
        if (!candidateId) return;

        setLoading(true);
        setError(null);

        try {
            // Get LiveKit token from backend
            const res = await fetch(`${API_URL}/api/livekit/token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ candidate_id: candidateId }),
            });

            if (!res.ok) {
                throw new Error("Failed to get LiveKit token");
            }

            const data = await res.json();
            console.log("LiveKit token received:", data);

            setLivekitToken(data.token);
            setLivekitUrl(data.livekit_url);
            setRoomName(data.room_name);
            setQuestions(data.questions || []);

            // Import and set up LiveKit
            const { Room, RoomEvent, Track } = await import("livekit-client");

            const room = new Room();
            roomRef.current = room;

            // Set up event handlers for data channel
            room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
                try {
                    const message = JSON.parse(new TextDecoder().decode(payload));
                    console.log("LiveKit data received:", message);

                    if (message.type === "FIELD_UPDATE") {
                        setLiveFields(prev => ({
                            ...prev,
                            ...message.fields
                        }));
                    }
                } catch (e) {
                    console.error("Failed to parse LiveKit data:", e);
                }
            });

            // Handle when agent publishes audio track - THIS IS THE KEY FIX
            room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
                console.log("Track subscribed:", track.kind, "from", participant.identity);

                if (track.kind === Track.Kind.Audio) {
                    // Attach audio track to play the agent's voice
                    const audioElement = track.attach();
                    audioElement.id = "agent-audio";
                    document.body.appendChild(audioElement);
                    console.log("Agent audio attached and playing");
                }
            });

            // Handle track unsubscribed
            room.on(RoomEvent.TrackUnsubscribed, (track) => {
                console.log("Track unsubscribed:", track.kind);
                track.detach().forEach((el) => el.remove());
            });

            room.on(RoomEvent.Disconnected, () => {
                console.log("Disconnected from room");
                setVoiceActive(false);
                setStep("complete");
                // Clean up audio elements
                const audioEl = document.getElementById("agent-audio");
                if (audioEl) audioEl.remove();
            });

            room.on(RoomEvent.Connected, () => {
                console.log("Connected to room");
                setVoiceActive(true);
            });

            // Connect to room with audio enabled
            await room.connect(data.livekit_url, data.token);

            // Enable microphone so agent can hear us
            await room.localParticipant.setMicrophoneEnabled(true);
            console.log("Microphone enabled");

            setStep("voice");

        } catch (e: any) {
            console.error("LiveKit connection error:", e);
            setError(`Voice agent error: ${e?.message || "Check console for details"}`);
        } finally {
            setLoading(false);
        }
    };

    const stopVoice = () => {
        if (roomRef.current) {
            console.log("Disconnecting from room...");
            roomRef.current.disconnect();
            roomRef.current = null;
        }
        setVoiceActive(false);
        setStep("complete");
    };

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-white font-sans selection:bg-purple-500/30">
            {/* Header */}
            <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#0A0A0A]/80 backdrop-blur-xl">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <button onClick={() => router.push("/")} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                        <ArrowLeft className="w-5 h-5 text-white/50" />
                    </button>
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-400" />
                        <span className="font-semibold tracking-tight">Pluto Deep Analysis</span>
                    </div>
                    <div className="w-10" />
                </div>
            </header>

            {/* Main Content */}
            <main className="pt-24 pb-16 px-6">
                <div className="max-w-5xl mx-auto">
                    <ProgressBar step={step} />

                    {/* Error Display */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-center">
                            {error}
                        </div>
                    )}

                    {/* Step 1: Upload */}
                    {step === "upload" && (
                        <div className="max-w-xl mx-auto text-center animate-in fade-in duration-500">
                            <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10">
                                <Upload className="w-8 h-8 text-purple-400" />
                            </div>
                            <h1 className="text-4xl font-bold mb-4">Upload Resume</h1>
                            <p className="text-white/50 mb-8">
                                Upload a candidate's resume for AI-powered deep analysis and voice interview.
                            </p>

                            <label className="block p-8 border-2 border-dashed border-white/10 rounded-2xl hover:border-purple-500/50 hover:bg-white/5 transition-all cursor-pointer group">
                                <input type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" />
                                {file ? (
                                    <div className="flex items-center justify-center gap-3">
                                        <Check className="w-5 h-5 text-green-400" />
                                        <span className="text-white font-medium">{file.name}</span>
                                    </div>
                                ) : (
                                    <span className="text-white/40 group-hover:text-white/60 transition-colors">
                                        Click to select PDF resume
                                    </span>
                                )}
                            </label>

                            <button
                                onClick={handleUpload}
                                disabled={!file || loading}
                                className="mt-6 w-full py-4 bg-white text-black font-bold rounded-xl hover:scale-[1.01] transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    "Analyzing..."
                                ) : (
                                    <>
                                        Analyze Resume <ChevronRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Step 2: Review */}
                    {step === "review" && extracted && (
                        <div className="animate-in fade-in duration-500">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h1 className="text-3xl font-bold">{extracted.name || "Candidate"}</h1>
                                    <p className="text-white/50">{extracted.summary?.slice(0, 100)}...</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-4xl font-bold text-purple-400">
                                        {gaps?.completeness_score || 0}%
                                    </div>
                                    <div className="text-xs text-white/40 uppercase">Profile Score</div>
                                </div>
                            </div>

                            <div className="space-y-8">
                                {/* Basic Info */}
                                <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <FieldCard label="Location" value={extracted.location} icon={<Activity className="w-4 h-4" />} />
                                    <FieldCard label="Experience" value={extracted.years_experience ? `${extracted.years_experience} years` : undefined} />
                                    <FieldCard label="Email" value={extracted.email} />
                                    <FieldCard label="Phone" value={extracted.phone} />
                                </section>

                                {/* Skills */}
                                {(extracted.languages?.length > 0 || extracted.frameworks?.length > 0) && (
                                    <section>
                                        <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <Code className="w-4 h-4" /> Skills
                                        </h3>
                                        <div className="flex flex-wrap gap-2">
                                            {[...(extracted.languages || []), ...(extracted.frameworks || [])].map((skill: string, i: number) => (
                                                <span key={i} className="px-3 py-1.5 bg-purple-500/10 text-purple-300 rounded-full text-sm border border-purple-500/20">
                                                    {skill}
                                                </span>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {/* Work History */}
                                {extracted.work_history?.length > 0 && (
                                    <section>
                                        <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <Briefcase className="w-4 h-4" /> Work History
                                        </h3>
                                        <div className="space-y-3">
                                            {extracted.work_history.slice(0, 3).map((job: any, i: number) => (
                                                <WorkHistoryCard key={i} job={job} />
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {/* Education */}
                                {extracted.education?.length > 0 && (
                                    <section>
                                        <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <GraduationCap className="w-4 h-4" /> Education
                                        </h3>
                                        <div className="space-y-2">
                                            {extracted.education.map((edu: any, i: number) => (
                                                <div key={i} className="p-4 bg-white/5 border border-white/10 rounded-xl">
                                                    <div className="font-semibold text-white">{edu.degree || "Degree"}</div>
                                                    <div className="text-purple-400 text-sm">{edu.institution || "Institution"}</div>
                                                    {edu.graduation_date && <div className="text-white/40 text-xs mt-1">{edu.graduation_date}</div>}
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {/* Projects */}
                                {extracted.projects?.length > 0 && (
                                    <section>
                                        <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <Code className="w-4 h-4" /> Projects
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {extracted.projects.map((p: any, i: number) => (
                                                <ProjectCard key={i} project={p} />
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {/* Candidate Analysis */}
                                <AnalysisSection analysis={gaps?.candidate_analysis} />

                                {/* Start Interview Button */}
                                {(gaps?.missing_critical?.length > 0 || gaps?.suggested_deep_dive_questions?.length > 0) && (
                                    <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/20 rounded-2xl p-6">
                                        <h3 className="font-semibold text-purple-300 mb-2">Ready for Voice Interview?</h3>
                                        <p className="text-white/60 text-sm mb-4">
                                            Start a voice interview to dig deeper into the candidate's background.
                                        </p>
                                        <button
                                            onClick={startVoice}
                                            disabled={loading}
                                            className="w-full py-4 bg-white text-black font-bold rounded-xl hover:scale-[1.01] transition-transform flex items-center justify-center gap-2"
                                        >
                                            {loading ? "Connecting..." : <><Mic className="w-5 h-5" /> Start Interview</>}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Voice - Two Column Layout */}
                    {step === "voice" && (
                        <div className="animate-in fade-in duration-500">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h1 className="text-2xl font-bold">Interview in Progress</h1>
                                    <p className="text-white/40">Speaking with {extracted?.name?.split(" ")[0]}...</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse" />
                                    <button onClick={stopVoice} className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-all flex items-center gap-2">
                                        <X className="w-4 h-4" /> End
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Left: Questions & Live Answers */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider">Questions & Answers</h3>

                                    {questions.map((q: string, i: number) => {
                                        // Try to find a matching answer based on common field names
                                        // This is a heuristic until we pass strict field mappings
                                        let answer = null;
                                        const entries = Object.entries(liveFields);

                                        // If we have entries matching the question index (approximate)
                                        if (entries[i]) {
                                            answer = entries[i][1];
                                        }

                                        return (
                                            <div key={i} className="p-4 bg-white/5 border border-white/10 rounded-xl">
                                                <p className="text-sm text-purple-400 mb-2">Q{i + 1}: {q}</p>
                                                <div className="text-white/80">
                                                    {answer ? (
                                                        <span className="text-green-400 flex items-center gap-2">
                                                            <Check className="w-4 h-4" /> {Array.isArray(answer) ? answer.join(", ") : String(answer)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-white/30 italic">Waiting for answer...</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Live Extracted Fields - ALWAYS VISIBLE */}
                                    <div className="mt-6 p-4 bg-white/5 border border-white/10 rounded-xl">
                                        <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <Activity className="w-4 h-4" /> Live Data Stream
                                        </h3>
                                        {Object.keys(liveFields).length > 0 ? (
                                            <div className="space-y-2">
                                                {Object.entries(liveFields).map(([key, value]) => (
                                                    <div key={key} className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex justify-between items-center">
                                                        <span className="text-white/60 capitalize text-sm">{key.replace(/_/g, " ")}</span>
                                                        <span className="text-green-300 font-medium text-right ml-4">
                                                            {Array.isArray(value) ? value.join(", ") : String(value)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-white/30 text-sm italic">Listening for updates...</p>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Audio Visualizer */}
                                <div>
                                    <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4">Voice Connection</h3>
                                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10 min-h-[300px] flex flex-col items-center justify-center">
                                        <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center animate-pulse mb-6">
                                            <Mic className="w-10 h-10 text-white" />
                                        </div>
                                        <p className="text-white/60 text-center">
                                            {voiceActive ? "Connected to LiveKit voice agent" : "Connecting..."}
                                        </p>
                                        <p className="text-white/40 text-sm mt-2">
                                            Room: {roomName || "..."}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Complete */}
                    {step === "complete" && (
                        <div className="max-w-xl mx-auto text-center animate-in fade-in duration-500 py-12">
                            <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-green-400 border border-green-500/20">
                                <Check className="w-12 h-12" />
                            </div>
                            <h1 className="text-5xl font-bold mb-6">Analysis Complete</h1>
                            <p className="text-xl text-white/50 mb-12">
                                You've completed the deep analysis for {extracted?.name}.
                            </p>

                            {/* Show extracted fields from interview */}
                            {Object.keys(liveFields).length > 0 && (
                                <div className="mb-8 text-left">
                                    <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wider mb-3">Interview Insights</h3>
                                    <div className="space-y-2">
                                        {Object.entries(liveFields).map(([key, value]) => (
                                            <div key={key} className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex justify-between">
                                                <span className="text-white/60 capitalize">{key.replace(/_/g, " ")}</span>
                                                <span className="text-green-300 font-medium">
                                                    {Array.isArray(value) ? value.join(", ") : String(value)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={() => router.push("/")}
                                className="px-8 py-4 bg-white text-black font-bold rounded-xl hover:scale-[1.01] transition-transform"
                            >
                                Return to Dashboard
                            </button>
                        </div>
                    )}
                </div>
            </main >
        </div >
    );
}
