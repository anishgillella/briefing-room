"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Vapi from "@vapi-ai/web";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, PhoneOff, Loader2, Sparkles, CheckCircle, AlertCircle } from "lucide-react";

// Types for our API response
interface InterviewInit {
    call_config: {
        assistantId: string;
        assistantOverrides?: {
            variableValues?: Record<string, string>;
            [key: string]: unknown;
        };
        sessionId: string;
    };
    candidate_name: string;
    job_title: string;
}

// Vapi Public Key (should be env var, but hardcoding for demo if needed or fetch from API)
// Ideally this comes from the init endpoint too, or env.
const VAPI_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || "YOUR_PUBLIC_KEY";

export default function InterviewPage() {
    const params = useParams();
    const interviewId = params.id as string;

    const [status, setStatus] = useState<"loading" | "lobby" | "connecting" | "active" | "completed" | "error">("loading");
    const [data, setData] = useState<InterviewInit | null>(null);
    const [errorMsg, setErrorMsg] = useState("");
    const [volumeLevel, setVolumeLevel] = useState(0);

    const vapiRef = useRef<Vapi | null>(null);

    // Initialize Vapi instance
    useEffect(() => {
        const vapi = new Vapi(VAPI_PUBLIC_KEY);
        vapiRef.current = vapi;

        // Vapi Event Listeners
        vapi.on("call-start", () => {
            setStatus("active");
        });

        vapi.on("call-end", () => {
            setStatus("completed");
        });

        vapi.on("volume-level", (level: number) => {
            setVolumeLevel(level);
        });

        vapi.on("error", (e: unknown) => {
            console.error("Vapi Error:", e);
            // Only show error if we haven't completed
            if (status !== "completed") {
                setErrorMsg("Connection error. Please refresh to try again.");
            }
        });

        return () => {
            vapi.stop();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Fetch Interview Data on Load
    useEffect(() => {
        async function initInterview() {
            try {
                const res = await fetch(`http://localhost:8000/api/vapi-interview/${interviewId}/init`, {
                    method: "POST",
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.detail || "Failed to load interview");
                }

                const json = await res.json();
                setData(json);
                setStatus("lobby");
            } catch (e: unknown) {
                console.error(e);
                setErrorMsg((e as Error).message);
                setStatus("error");
            }
        }

        if (interviewId) {
            initInterview();
        }
    }, [interviewId]);

    const startInterview = async () => {
        if (!vapiRef.current || !data) return;
        setStatus("connecting");

        try {
            // Pass metadata with interview_id so webhooks can link back
            // Also pass variableValues for template substitution
            const overrides = {
                metadata: {
                    interview_id: data.call_config.sessionId, // Try passing in metadata
                },
                variableValues: {
                    ...(data.call_config.assistantOverrides?.variableValues || {}),
                    interview_id: data.call_config.sessionId, // Also pass in variableValues as fallback
                }
            };

            await vapiRef.current.start(data.call_config.assistantId, overrides);
        } catch (e: unknown) {
            console.error("Failed to start call:", e);
            setErrorMsg("Could not start call. Check microphone permissions.");
            setStatus("error");
        }
    };

    const endInterview = () => {
        if (vapiRef.current) {
            vapiRef.current.stop();
            setStatus("completed");
        }
    };

    // --- UI COMPONENTS ---

    const LoadingScreen = () => (
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
            <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
            <p className="text-gray-400 font-light">Loading interview details...</p>
        </div>
    );

    const ErrorScreen = () => (
        <div className="flex flex-col items-center justify-center p-8 space-y-6 text-center max-w-md">
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <AlertCircle className="w-10 h-10 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Something went wrong</h2>
            <p className="text-gray-400">{errorMsg}</p>
            <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all"
            >
                Try Again
            </button>
        </div>
    );

    const LobbyScreen = () => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-xl w-full"
        >
            <div className="relative overflow-hidden rounded-3xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl p-8 md:p-12 text-center space-y-8">

                {/* Glow Effects */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl -z-10" />

                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-4">
                        <Sparkles className="w-4 h-4" />
                        First Round Interview
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
                        Hi, {data?.candidate_name.split(' ')[0]}
                    </h1>
                    <p className="text-xl text-gray-400">
                        Ready for your interview for <span className="text-white font-medium">{data?.job_title}</span>?
                    </p>
                </div>

                <div className="space-y-4 text-left bg-white/5 rounded-2xl p-6 border border-white/5">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Instructions</h3>
                    <ul className="space-y-3 text-gray-300">
                        <li className="flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                            <span>It will be a 15-minute voice conversation with Alex, our AI interviewer.</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                            <span>Find a quiet place with a good microphone.</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                            <span>Speak naturally. You can ask clarifying questions at any time.</span>
                        </li>
                    </ul>
                </div>

                <button
                    onClick={startInterview}
                    className="group relative w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl text-white text-lg font-bold shadow-lg shadow-blue-500/25 transition-all outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                    <span className="flex items-center justify-center gap-2">
                        <Mic className="w-5 h-5" />
                        Start Interview
                    </span>
                </button>
            </div>
        </motion.div>
    );

    const ActiveScreen = () => (
        <motion.div
            layout
            className="relative flex flex-col items-center justify-center space-y-12 max-w-lg w-full"
        >
            {/* Visualizer Orb */}
            <div className="relative w-64 h-64 flex items-center justify-center">
                <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />

                {/* Dynamic circles based on volume */}
                <motion.div
                    animate={{ scale: 1 + volumeLevel * 2 }}
                    className="absolute w-40 h-40 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full opacity-80 blur-lg"
                />
                <motion.div
                    animate={{ scale: 1 + volumeLevel * 1.5 }}
                    className="absolute w-32 h-32 bg-white rounded-full opacity-20"
                />
                <div className="relative w-24 h-24 bg-black rounded-full flex items-center justify-center border border-white/10 z-10 shadow-inner">
                    <Mic className={`w-8 h-8 ${volumeLevel > 0.05 ? 'text-blue-400' : 'text-gray-600'}`} />
                </div>
            </div>

            <div className="text-center space-y-2">
                <h2 className="text-2xl font-semibold text-white">Interview in Progress</h2>
                <p className="text-gray-400">Listening...</p>
            </div>

            <button
                onClick={endInterview}
                className="flex items-center gap-2 px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-full border border-red-500/20 transition-all font-medium"
            >
                <PhoneOff className="w-5 h-5" />
                End Interview
            </button>
        </motion.div>
    );

    const CompletedScreen = () => (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full text-center space-y-8"
        >
            <div className="mx-auto w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center border-2 border-green-500/20">
                <CheckCircle className="w-12 h-12 text-green-400" />
            </div>

            <div className="space-y-2">
                <h2 className="text-3xl font-bold text-white">Complete!</h2>
                <p className="text-gray-400 text-lg">
                    Thank you for taking the time to speak with us.
                </p>
            </div>

            <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                <p className="text-gray-300">
                    Our team will review your interview transcript and get back to you within 48 hours with next steps.
                </p>
            </div>
        </motion.div>
    );

    return (
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4 selection:bg-blue-500/30">
            {/* Background Dots */}
            <div className="absolute inset-0 bg-[radial-gradient(#ffffff05_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

            <AnimatePresence mode="wait">
                {status === "loading" && <LoadingScreen key="loading" />}
                {(status === "lobby" || status === "connecting") && <LobbyScreen key="lobby" />}
                {status === "active" && <ActiveScreen key="active" />}
                {status === "completed" && <CompletedScreen key="completed" />}
                {status === "error" && <ErrorScreen key="error" />}
            </AnimatePresence>
        </div>
    );
}
