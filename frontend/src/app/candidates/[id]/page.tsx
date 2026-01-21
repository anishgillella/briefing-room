"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Vapi from "@vapi-ai/web";
import {
  ArrowLeft,
  Sparkles,
  Mic,
  MicOff,
  Volume2,
  PlayCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import CandidateProfile from "@/components/CandidateProfile";
import InterviewHistory from "@/components/InterviewHistory";
import InterviewerSelector from "@/components/InterviewerSelector";
import CandidateAnalytics from "@/components/CandidateAnalytics";
import { Candidate, PreBrief } from "@/types";
import { setSelectedInterviewerId } from "@/lib/interviewerApi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FadeInUp, Spinner } from "@/components/ui/motion";
import { cn } from "@/lib/utils";
import { tokens, springConfig, easeOutCustom } from "@/lib/design-tokens";

const API_URL = "http://localhost:8000";

export default function CandidateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const candidateId = params.id as string;
  const prefersReducedMotion = useReducedMotion();

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [prebrief, setPrebrief] = useState<PreBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [prebriefLoading, setPrebriefLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startingInterview, setStartingInterview] = useState(false);
  const [selectedInterviewer, setSelectedInterviewer] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "history" | "analytics">("profile");
  const [backUrl, setBackUrl] = useState("/");

  // Animation variants
  const fadeIn = prefersReducedMotion
    ? { initial: {}, animate: {}, exit: {} }
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10 },
      };

  // Get back URL (rankings session) on mount
  useEffect(() => {
    const sessionId = sessionStorage.getItem("currentSessionId");
    if (sessionId) {
      setBackUrl(`/rankings/${sessionId}`);
    }
  }, []);

  // Voice agent state
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isVoiceConnecting, setIsVoiceConnecting] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string[]>([]);
  const vapiRef = useRef<Vapi | null>(null);

  useEffect(() => {
    fetchCandidate();
  }, [candidateId]);

  const fetchCandidate = async () => {
    try {
      const res = await fetch(`${API_URL}/api/pluto/candidates/${candidateId}`);
      if (!res.ok) throw new Error("Candidate not found");
      const data = await res.json();
      setCandidate(data);
      fetchPrebrief();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrebrief = async () => {
    setPrebriefLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/pluto/candidates/${candidateId}/prebrief`);
      if (res.ok) {
        const data = await res.json();
        setPrebrief(data.prebrief);
      }
    } catch (e) {
      // Prebrief not available yet
    } finally {
      setPrebriefLoading(false);
    }
  };

  const generatePrebrief = async () => {
    setPrebriefLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/pluto/candidates/${candidateId}/prebrief`);
      if (res.ok) {
        const data = await res.json();
        setPrebrief(data.prebrief);
      } else {
        alert("Failed to generate pre-brief");
      }
    } catch (e) {
      alert("Failed to generate pre-brief");
    } finally {
      setPrebriefLoading(false);
    }
  };

  const handleUpdateEmail = async (email: string) => {
    try {
      const res = await fetch(`${API_URL}/api/pluto/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        const updatedCandidate = await res.json();
        setCandidate(updatedCandidate);
      } else {
        alert("Failed to update email");
      }
    } catch (e) {
      alert("Failed to update email");
    }
  };

  const handleStartInterview = async () => {
    setStartingInterview(true);
    try {
      const res = await fetch(`${API_URL}/api/pluto/candidates/${candidateId}/interview/start`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/candidates/${candidateId}/interview?room=${data.room_name}`);
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to start interview");
      }
    } catch (e) {
      alert("Failed to start interview");
    } finally {
      setStartingInterview(false);
    }
  };

  // Build briefing context for voice agent
  const buildBriefingContext = useCallback(() => {
    if (!candidate) return "";
    const parts = [
      `Candidate: ${candidate.name}`,
      candidate.job_title ? `Current Role: ${candidate.job_title}` : "",
      candidate.years_experience ? `Experience: ${candidate.years_experience} years` : "",
      candidate.one_line_summary ? `Summary: ${candidate.one_line_summary}` : "",
      candidate.pros?.length ? `Strengths: ${candidate.pros.join(", ")}` : "",
      candidate.cons?.length ? `Concerns: ${candidate.cons.join(", ")}` : "",
      candidate.red_flags?.length ? `Red Flags: ${candidate.red_flags.join(", ")}` : "",
      candidate.interview_questions?.length
        ? `Suggested Questions: ${candidate.interview_questions.join(" | ")}`
        : "",
    ];
    return parts.filter(Boolean).join("\n");
  }, [candidate]);

  // Start voice agent
  const startVoiceAgent = useCallback(async () => {
    const vapiKey = process.env.NEXT_PUBLIC_VAPI_WEB_KEY;
    const assistantId = process.env.NEXT_PUBLIC_VAPI_BRIEFING_ASSISTANT_ID;

    if (!vapiKey) {
      alert("Voice AI not configured. Add NEXT_PUBLIC_VAPI_WEB_KEY to .env.local");
      return;
    }

    setIsVoiceConnecting(true);
    setVoiceTranscript([]);

    try {
      const vapi = new Vapi(vapiKey);
      vapiRef.current = vapi;

      vapi.on("call-start", () => {
        setIsVoiceConnecting(false);
        setIsVoiceActive(true);
        setVoiceTranscript((prev) => [
          ...prev,
          "Voice assistant connected. Ask me anything about this candidate!",
        ]);
      });

      vapi.on("call-end", () => {
        setIsVoiceActive(false);
        setVoiceTranscript((prev) => [...prev, "Voice assistant disconnected."]);
      });

      vapi.on("message", (msg: any) => {
        if (msg.type === "transcript" && msg.transcript) {
          const role = msg.role === "assistant" ? "AI:" : "You:";
          setVoiceTranscript((prev) => [...prev, `${role} ${msg.transcript}`]);
        }
      });

      vapi.on("error", (err: any) => {
        console.error("VAPI error:", err);
        setIsVoiceConnecting(false);
        setIsVoiceActive(false);
        if (err && Object.keys(err).length > 0) {
          setVoiceTranscript((prev) => [...prev, `Error: ${err.message || JSON.stringify(err)}`]);
        }
      });

      const briefingContext = buildBriefingContext();

      if (assistantId) {
        await vapi.start(assistantId, {
          variableValues: {
            candidateName: candidate?.name || "the candidate",
            briefingContext: briefingContext,
          },
        });
      } else {
        await vapi.start({
          model: {
            provider: "openai",
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are a helpful interview preparation assistant. You're helping a recruiter prepare for an interview with a candidate.

Here's the candidate information:
${briefingContext}

Help by:
- Answering questions about the candidate's background
- Suggesting probing questions based on their experience
- Highlighting concerns or red flags to explore
- Providing interviewing tips specific to this candidate

Be concise and helpful. The recruiter has limited time before the interview.`,
              },
            ],
          },
          voice: {
            provider: "11labs",
            voiceId: "21m00Tcm4TlvDq8ikWAM",
          },
          firstMessage: `Hi! I'm ready to help you prepare for your interview with ${
            candidate?.name || "this candidate"
          }. What would you like to know?`,
        });
      }
    } catch (err) {
      console.error("Voice agent failed:", err);
      setIsVoiceConnecting(false);
      const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
      alert(`Failed to start voice AI: ${errorMsg}`);
    }
  }, [candidate, buildBriefingContext]);

  // Stop voice agent
  const stopVoiceAgent = useCallback(() => {
    if (vapiRef.current) {
      vapiRef.current.stop();
      vapiRef.current = null;
    }
    setIsVoiceActive(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (vapiRef.current) {
        vapiRef.current.stop();
      }
    };
  }, []);

  // Toggle voice
  const handleVoiceToggle = () => {
    if (isVoiceActive) {
      stopVoiceAgent();
    } else {
      startVoiceAgent();
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: tokens.bgApp }}
      >
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p style={{ color: tokens.textMuted }}>Loading candidate profile...</p>
        </div>
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: tokens.bgApp, color: tokens.textPrimary }}
      >
        <FadeInUp>
          <Card padding="lg" className="text-center max-w-md">
            <motion.div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
              animate={prefersReducedMotion ? {} : { scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <AlertTriangle className="w-8 h-8" style={{ color: tokens.statusDanger }} />
            </motion.div>
            <h1 className="text-xl font-semibold mb-2">Candidate Not Found</h1>
            <p style={{ color: tokens.textMuted }} className="mb-6">
              {error}
            </p>
            <Button
              variant="primary"
              onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
            >
              Go Back
            </Button>
          </Card>
        </FadeInUp>
      </div>
    );
  }

  const tabs = [
    { id: "profile", label: "Profile & Pre-Brief" },
    { id: "history", label: "Interview History" },
    { id: "analytics", label: "Analytics" },
  ] as const;

  return (
    <div className="min-h-screen" style={{ background: tokens.bgApp, color: tokens.textPrimary }}>
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-0 left-1/4 w-[800px] h-[800px] rounded-full blur-[120px] opacity-30"
          style={{ background: tokens.brandGlow }}
        />
        <div
          className="absolute bottom-0 right-1/4 w-[600px] h-[600px] rounded-full blur-[100px] opacity-20"
          style={{ background: "rgba(139,92,246,0.15)" }}
        />
      </div>

      {/* Header */}
      <header
        className="backdrop-blur-xl sticky top-0 z-50"
        style={{
          borderBottom: `1px solid ${tokens.borderSubtle}`,
          background: "rgba(7,11,20,0.8)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <motion.button
            onClick={() => router.push(backUrl)}
            className="flex items-center gap-2 transition group"
            style={{ color: tokens.textMuted }}
            whileHover={prefersReducedMotion ? {} : { x: -2, color: tokens.textPrimary }}
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            Back to Rankings
          </motion.button>
          <div className="flex gap-3 items-center">
            {/* Voice indicator */}
            <AnimatePresence>
              {isVoiceActive && (
                <motion.div
                  initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={prefersReducedMotion ? {} : { opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                  style={{
                    background: tokens.brandGlow,
                    border: `1px solid ${tokens.brandPrimary}40`,
                  }}
                >
                  <motion.div
                    className="w-2 h-2 rounded-full"
                    style={{ background: tokens.brandSecondary }}
                    animate={prefersReducedMotion ? {} : { opacity: [1, 0.4, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <span className="text-sm" style={{ color: tokens.brandSecondary }}>
                    AI Listening...
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Voice AI Button */}
            <Button
              variant={isVoiceActive ? "danger" : "secondary"}
              size="sm"
              onClick={handleVoiceToggle}
              disabled={isVoiceConnecting}
              leftIcon={
                isVoiceConnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isVoiceActive ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )
              }
            >
              {isVoiceConnecting ? "Connecting..." : isVoiceActive ? "Stop AI" : "Ask AI"}
            </Button>

            {!prebrief && !prebriefLoading && (
              <Button
                variant="ghost"
                size="sm"
                onClick={generatePrebrief}
                leftIcon={<Sparkles className="w-4 h-4" />}
              >
                Generate Deep Analysis
              </Button>
            )}

            <InterviewerSelector
              label="Interviewing as"
              onInterviewerChange={(id) => {
                setSelectedInterviewer(id);
                setSelectedInterviewerId(id);
              }}
              className="min-w-[180px]"
            />

            <Button
              variant="primary"
              onClick={handleStartInterview}
              disabled={startingInterview || !selectedInterviewer}
              leftIcon={
                startingInterview ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <PlayCircle className="w-5 h-5" />
                )
              }
            >
              Start Interview
            </Button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-6 pt-6 relative z-10">
        <div
          className="flex gap-1 p-1 rounded-xl w-fit"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${tokens.borderSubtle}`,
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-medium transition-all relative"
              )}
              style={{
                color: activeTab === tab.id ? tokens.textPrimary : tokens.textMuted,
              }}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 rounded-lg shadow-lg"
                  style={{ background: tokens.brandPrimary }}
                  transition={springConfig}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "profile" && (
          <motion.div
            key="profile"
            {...fadeIn}
            transition={{ duration: 0.2, ease: easeOutCustom }}
          >
            <CandidateProfile
              candidate={candidate}
              prebrief={prebrief}
              loadingPrebrief={prebriefLoading}
              onStartInterview={handleStartInterview}
              startingInterview={startingInterview}
              onUpdateEmail={handleUpdateEmail}
            />
          </motion.div>
        )}
        {activeTab === "history" && (
          <motion.div
            key="history"
            {...fadeIn}
            transition={{ duration: 0.2, ease: easeOutCustom }}
            className="max-w-7xl mx-auto px-6 py-6 relative z-10"
          >
            <InterviewHistory
              candidateId={candidateId}
              candidateName={candidate.name}
              onStartInterview={(roomUrl, token, stage) => {
                router.push(`/candidates/${candidateId}/interview?room=live&stage=${stage}`);
              }}
            />
          </motion.div>
        )}
        {activeTab === "analytics" && (
          <motion.div
            key="analytics"
            {...fadeIn}
            transition={{ duration: 0.2, ease: easeOutCustom }}
            className="max-w-7xl mx-auto px-6 py-6 relative z-10"
          >
            <CandidateAnalytics candidateId={candidateId} candidateName={candidate.name} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Voice Assistant Panel */}
      <AnimatePresence>
        {(isVoiceActive || voiceTranscript.length > 0) && (
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? {} : { opacity: 0, y: 20, scale: 0.95 }}
            transition={springConfig}
            className="fixed bottom-6 right-6 w-96 max-h-[400px] backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden z-50"
            style={{
              background: "rgba(15,23,42,0.95)",
              border: `1px solid ${tokens.brandPrimary}40`,
              boxShadow: `0 25px 50px -12px ${tokens.brandGlow}`,
            }}
          >
            <div
              className="p-4 flex items-center justify-between"
              style={{ borderBottom: `1px solid ${tokens.borderSubtle}` }}
            >
              <div className="flex items-center gap-3">
                <motion.div
                  className={cn("w-3 h-3 rounded-full")}
                  style={{
                    background: isVoiceActive ? tokens.brandSecondary : tokens.textDisabled,
                  }}
                  animate={isVoiceActive && !prefersReducedMotion ? { opacity: [1, 0.4, 1] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className="font-semibold" style={{ color: tokens.textPrimary }}>
                  Voice Assistant
                </span>
              </div>
              <div className="flex gap-2">
                {isVoiceActive && (
                  <Button variant="danger" size="sm" onClick={stopVoiceAgent}>
                    Stop
                  </Button>
                )}
                {!isVoiceActive && voiceTranscript.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setVoiceTranscript([])}>
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <div className="p-4 max-h-[320px] overflow-y-auto space-y-2">
              {voiceTranscript.length === 0 && !isVoiceActive && (
                <p className="text-sm text-center py-4" style={{ color: tokens.textDisabled }}>
                  Click &quot;Ask AI&quot; to start voice assistant
                </p>
              )}
              {voiceTranscript.map((line, i) => (
                <motion.div
                  key={i}
                  initial={prefersReducedMotion ? {} : { opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 }}
                  className="text-sm"
                  style={{
                    color: line.startsWith("AI:")
                      ? tokens.brandSecondary
                      : line.startsWith("You:")
                      ? tokens.textPrimary
                      : line.includes("connected")
                      ? tokens.statusSuccess
                      : line.includes("disconnected")
                      ? tokens.statusWarning
                      : line.includes("Error")
                      ? tokens.statusDanger
                      : tokens.textMuted,
                  }}
                >
                  {line}
                </motion.div>
              ))}
              {isVoiceActive && (
                <motion.div
                  className="flex items-center gap-2 text-sm"
                  style={{ color: tokens.brandSecondary }}
                  animate={prefersReducedMotion ? {} : { opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Mic className="w-4 h-4" />
                  <span>Listening...</span>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grain texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-[100] opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
