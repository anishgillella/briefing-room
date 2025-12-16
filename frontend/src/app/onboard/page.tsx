"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, CheckCircle, Building2, Sparkles } from "lucide-react";
import IntakeForm from "@/components/voice-ingest/IntakeForm";
import JDPastePanel from "@/components/voice-ingest/JDPastePanel";
import ProfileBuilder from "@/components/voice-ingest/ProfileBuilder";
import VoiceSession from "@/components/voice-ingest/VoiceSession";
import {
    startSession,
    getCompanyIntel,
    getProfile,
    parseJD,
    createVapiCall,
    createWebSocketConnection,
    WebSocketMessage,
    JobProfile,
    CompanyIntelligence,
    VapiCallResponse,
} from "@/lib/voiceIngestApi";

type FlowStep = "intake" | "research" | "jd" | "voice" | "complete";

export default function OnboardPage() {
    // Flow state
    const [step, setStep] = useState<FlowStep>("intake");
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Session data
    const [profile, setProfile] = useState<JobProfile | null>(null);
    const [companyIntel, setCompanyIntel] = useState<CompanyIntelligence | null>(null);
    const [completionPercentage, setCompletionPercentage] = useState(0);
    const [missingFields, setMissingFields] = useState<string[]>([]);

    // JD parsing state
    const [parseResult, setParseResult] = useState<{
        success: boolean;
        extraction_summary: string;
        completion_percentage: number;
        missing_required: string[];
        suggested_questions: string[];
    } | null>(null);

    // Voice session state (now using Vapi)
    const [vapiCall, setVapiCall] = useState<VapiCallResponse | null>(null);
    const [transcripts, setTranscripts] = useState<Array<{ speaker: "agent" | "user"; text: string }>>([]);

    // WebSocket ref
    const wsRef = useRef<WebSocket | null>(null);

    // Research polling state
    const [researchStatus, setResearchStatus] = useState<"pending" | "in_progress" | "complete" | "failed">("pending");

    // =============================================================================
    // Step 1: Intake Form Submit
    // =============================================================================
    const handleIntakeSubmit = async (data: {
        firstName: string;
        lastName: string;
        email: string;
        companyWebsite: string;
    }) => {
        setIsLoading(true);
        try {
            // Extract company name from website domain
            const domain = data.companyWebsite.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
            const companyName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);

            const response = await startSession({
                first_name: data.firstName,
                last_name: data.lastName,
                company_name: companyName,
                company_website: data.companyWebsite,
            });

            setSessionId(response.session_id);
            setStep("research");
        } finally {
            setIsLoading(false);
        }
    };

    // =============================================================================
    // Step 2: Poll Company Research
    // =============================================================================
    useEffect(() => {
        if (step !== "research" || !sessionId) return;

        let attempts = 0;
        const maxAttempts = 60; // 60 seconds max

        const pollResearch = async () => {
            try {
                const result = await getCompanyIntel(sessionId);
                setResearchStatus(result.status as any);

                if (result.status === "complete" || result.status === "partial") {
                    setCompanyIntel(result.company_intel || null);
                    // Move to JD step
                    setTimeout(() => setStep("jd"), 1000);
                    return true;
                }

                if (result.status === "failed") {
                    // Continue anyway with limited context
                    setTimeout(() => setStep("jd"), 500);
                    return true;
                }

                return false;
            } catch (err) {
                console.error("Research poll error:", err);
                return false;
            }
        };

        const interval = setInterval(async () => {
            attempts++;
            const done = await pollResearch();

            if (done || attempts >= maxAttempts) {
                clearInterval(interval);
                if (attempts >= maxAttempts) {
                    setStep("jd"); // Move on anyway
                }
            }
        }, 1000);

        // Initial poll
        pollResearch();

        return () => clearInterval(interval);
    }, [step, sessionId]);

    // =============================================================================
    // Step 3: JD Parsing
    // =============================================================================
    const handleParseJD = async (jdText: string) => {
        if (!sessionId) return;
        setIsLoading(true);

        try {
            const result = await parseJD(sessionId, jdText);
            setParseResult({
                success: result.success,
                extraction_summary: result.extraction_summary,
                completion_percentage: result.completion_percentage,
                missing_required: result.missing_required,
                suggested_questions: result.suggested_questions,
            });
            setCompletionPercentage(result.completion_percentage);
            setMissingFields(result.missing_required);

            // Refresh profile
            const profileData = await getProfile(sessionId);
            setProfile(profileData.profile);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSkipJD = () => {
        startVoiceSession();
    };

    // =============================================================================
    // Step 4: Voice Session (using Vapi)
    // =============================================================================
    const startVoiceSession = async () => {
        if (!sessionId) return;
        setIsLoading(true);

        try {
            // Create Vapi call with all context baked in
            const vapiResponse = await createVapiCall(sessionId);

            if (vapiResponse.error) {
                console.error("[Vapi] Error creating call:", vapiResponse.error);
                // Could show error UI here
            }

            setVapiCall(vapiResponse);

            // Connect WebSocket for real-time updates
            connectWebSocket();

            // Load current profile state
            const profileData = await getProfile(sessionId);
            setProfile(profileData.profile);
            setCompletionPercentage(profileData.completion_percentage);
            setMissingFields(profileData.missing_fields);

            setStep("voice");
        } catch (error) {
            console.error("[Vapi] Failed to start voice session:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // =============================================================================
    // WebSocket Connection
    // =============================================================================
    const connectWebSocket = useCallback(() => {
        if (!sessionId || wsRef.current) return;

        const ws = createWebSocketConnection(sessionId, {
            onMessage: handleWebSocketMessage,
            onOpen: () => {
                console.log("[WS] Connected");
            },
            onClose: () => {
                console.log("[WS] Disconnected");
                wsRef.current = null;
            },
            onError: (error) => {
                console.error("[WS] Error:", error);
            },
        });

        wsRef.current = ws;
    }, [sessionId]);

    const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
        console.log("[WS] Message:", message.type, message.data);

        switch (message.type) {
            case "connected":
            case "profile_refresh":
                if (message.data.profile) {
                    setProfile(message.data.profile as JobProfile);
                }
                if (typeof message.data.completion_percentage === "number") {
                    setCompletionPercentage(message.data.completion_percentage);
                }
                if (Array.isArray(message.data.missing_fields)) {
                    setMissingFields(message.data.missing_fields as string[]);
                }
                break;

            case "requirements":
            case "trait_created":
            case "trait_updated":
            case "trait_deleted":
            case "stage_created":
            case "stage_updated":
            case "stage_deleted":
            case "nuance_captured":
                // Refresh profile on any update
                if (sessionId) {
                    getProfile(sessionId).then((data) => {
                        setProfile(data.profile);
                        setCompletionPercentage(data.completion_percentage);
                        setMissingFields(data.missing_fields);
                    });
                }
                break;

            case "transcript":
                const transcript = message.data as { speaker: "agent" | "user"; text: string };
                setTranscripts((prev) => [...prev, transcript]);
                break;

            case "completion_update":
                const completion = message.data as {
                    completion_percentage: number;
                    missing_fields: string[];
                    is_complete: boolean;
                };
                setCompletionPercentage(completion.completion_percentage);
                setMissingFields(completion.missing_fields);
                break;

            case "onboarding_complete":
                setStep("complete");
                break;
        }
    }, [sessionId]);

    // Cleanup WebSocket on unmount
    useEffect(() => {
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);

    // =============================================================================
    // Voice Session End
    // =============================================================================
    const handleVoiceEnd = () => {
        // Voice session ended by user
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
    };

    const handleComplete = () => {
        setStep("complete");
    };

    // =============================================================================
    // Render
    // =============================================================================
    return (
        <main className="min-h-screen gradient-bg text-white">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#000000]/80 backdrop-blur-md border-b border-white/5 py-4">
                <div className="flex items-center justify-between max-w-7xl mx-auto px-6">
                    <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/10">
                            <span className="text-sm">⚛️</span>
                        </div>
                        <div>
                            <h1 className="text-lg font-light tracking-wide text-white">Superposition</h1>
                        </div>
                    </Link>

                    {/* Step Indicator */}
                    <div className="flex items-center gap-2">
                        {["intake", "research", "jd", "voice", "complete"].map((s, i) => (
                            <div
                                key={s}
                                className={`w-2 h-2 rounded-full transition-all ${
                                    step === s
                                        ? "w-6 bg-indigo-500"
                                        : ["intake", "research", "jd", "voice", "complete"].indexOf(step) > i
                                        ? "bg-green-500"
                                        : "bg-white/20"
                                }`}
                            />
                        ))}
                    </div>

                    {step !== "intake" && (
                        <Link
                            href="/"
                            className="px-4 py-2 rounded-full bg-white/5 text-white/60 text-sm hover:bg-white/10 hover:text-white transition-all flex items-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Exit
                        </Link>
                    )}
                </div>
            </header>

            {/* Content */}
            <div className="pt-24 min-h-screen">
                {/* Step 1: Intake Form */}
                {step === "intake" && (
                    <div className="px-6 py-12">
                        <IntakeForm onSubmit={handleIntakeSubmit} isLoading={isLoading} />
                    </div>
                )}

                {/* Step 2: Research Loading */}
                {step === "research" && (
                    <div className="px-6 py-12 flex items-center justify-center min-h-[60vh]">
                        <div className="text-center animate-fade-in">
                            <div className="w-24 h-24 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-8 relative">
                                <Building2 className="w-10 h-10 text-indigo-400" />
                                <div className="absolute inset-0 rounded-full border-2 border-indigo-500/30 animate-ping" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-3">Researching Company</h2>
                            <p className="text-white/50 max-w-md mx-auto mb-6">
                                We're gathering intelligence about your company to personalize the onboarding experience.
                            </p>
                            <div className="flex items-center justify-center gap-2 text-sm text-indigo-400">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>
                                    {researchStatus === "pending"
                                        ? "Starting research..."
                                        : researchStatus === "in_progress"
                                        ? "Analyzing company data..."
                                        : "Finalizing..."}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 3: JD Paste */}
                {step === "jd" && (
                    <div className="px-6 py-12">
                        <JDPastePanel
                            onParse={handleParseJD}
                            onSkip={handleSkipJD}
                            isLoading={isLoading}
                            parseResult={parseResult || undefined}
                            companyName={companyIntel?.name}
                        />
                    </div>
                )}

                {/* Step 4: Voice Session (using Vapi) */}
                {step === "voice" && vapiCall && profile && (
                    <div className="h-[calc(100vh-96px)] flex">
                        {/* Left: Voice Session */}
                        <div className="flex-1 flex items-center justify-center p-6">
                            <div className="w-full max-w-md">
                                <VoiceSession
                                    vapiPublicKey={vapiCall.vapi_public_key}
                                    assistantConfig={{
                                        callId: vapiCall.call_id,
                                        webCallUrl: vapiCall.web_call_url,
                                        assistantId: vapiCall.assistant_id,
                                    }}
                                    sessionId={sessionId!}
                                    onEnd={handleVoiceEnd}
                                    onComplete={handleComplete}
                                    isComplete={completionPercentage >= 100}
                                    onTranscript={(speaker, text) => {
                                        setTranscripts((prev) => [...prev, { speaker, text }]);
                                    }}
                                />
                            </div>
                        </div>

                        {/* Right: Profile Builder */}
                        <div className="w-[450px] border-l border-white/10 bg-black/30">
                            <ProfileBuilder
                                profile={profile}
                                completionPercentage={completionPercentage}
                                missingFields={missingFields}
                                transcripts={transcripts}
                            />
                        </div>
                    </div>
                )}

                {/* Step 5: Complete */}
                {step === "complete" && profile && (
                    <div className="px-6 py-12 max-w-2xl mx-auto text-center animate-fade-in">
                        <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-8">
                            <CheckCircle className="w-12 h-12 text-green-400" />
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-3">Profile Complete!</h2>
                        <p className="text-white/50 mb-8">
                            Your job profile for {profile.requirements.job_title || "the role"} has been created.
                            You're ready to start finding candidates.
                        </p>

                        {/* Summary */}
                        <div className="glass-card-premium p-6 rounded-2xl text-left mb-8">
                            <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-4">
                                Profile Summary
                            </h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-white/40">Title:</span>{" "}
                                    <span className="text-white">{profile.requirements.job_title || "-"}</span>
                                </div>
                                <div>
                                    <span className="text-white/40">Location:</span>{" "}
                                    <span className="text-white">{profile.requirements.location_type || "-"}</span>
                                </div>
                                <div>
                                    <span className="text-white/40">Traits:</span>{" "}
                                    <span className="text-white">{profile.traits.length} defined</span>
                                </div>
                                <div>
                                    <span className="text-white/40">Interview Stages:</span>{" "}
                                    <span className="text-white">{profile.interview_stages.length} stages</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <Link
                                href={`/candidates?profile=${sessionId}`}
                                className="flex-1 py-4 rounded-full bg-white text-black font-semibold hover:bg-gray-100 transition-all text-center flex items-center justify-center gap-2"
                            >
                                Upload Candidates
                                <ArrowLeft className="w-5 h-5 rotate-180" />
                            </Link>
                            <button className="flex-1 py-4 rounded-full bg-indigo-600/50 text-white/70 font-semibold cursor-not-allowed flex items-center justify-center gap-2">
                                <Sparkles className="w-5 h-5" />
                                Source Candidates (Coming Soon)
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
