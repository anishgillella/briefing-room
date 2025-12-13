"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { User, Briefcase, FileText, Sparkles, ArrowRight, UserCircle2, Code2 } from "lucide-react";

interface JoinScreenProps {
    roomName?: string;
    onJoin: (data: {
        participantName: string;
        participantType: "interviewer" | "candidate";
        jobDescription?: string;
        candidateResume?: string;
    }) => void;
    isLoading?: boolean;
}

export default function JoinScreen({ roomName, onJoin, isLoading }: JoinScreenProps) {
    const [name, setName] = useState("");
    const [participantType, setParticipantType] = useState<"interviewer" | "candidate">("interviewer");
    const [jobDescription, setJobDescription] = useState("");
    const [candidateResume, setCandidateResume] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onJoin({
                participantName: name.trim(),
                participantType,
                jobDescription: jobDescription.trim() || undefined,
                candidateResume: candidateResume.trim() || undefined,
            });
        }
    };

    const isInterviewer = participantType === "interviewer";

    return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white p-4 relative overflow-hidden font-sans">
            {/* Premium Deep Space Background */}
            <div className="fixed inset-0 z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-purple-600/20 rounded-full blur-[120px] animate-pulse pointer-events-none" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[120px] animate-pulse pointer-events-none delay-1000" />
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />
            </div>

            <div className={`w-full relative z-10 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${isInterviewer ? "max-w-4xl" : "max-w-md"}`}>

                {/* Header Section */}
                <div className="text-center mb-10 space-y-3 animate-fade-up">
                    <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/50 filter drop-shadow-lg">
                            {roomName ? "Join Interview" : "Pluto"}
                        </span>
                    </h1>
                    <p className="text-white/60 text-lg font-light tracking-wide">
                        {roomName
                            ? `Entering room: ${roomName}`
                            : "Advanced AI Interview Intelligence"
                        }
                    </p>
                </div>

                <div className="glass-card-premium p-1 overflow-hidden animate-fade-up delay-100">
                    <div className="bg-black/40 backdrop-blur-3xl rounded-[30px] p-8 md:p-12 border border-white/5">
                        <form onSubmit={handleSubmit} className="space-y-8">

                            {/* Role Selection Tabs */}
                            <div className="grid grid-cols-2 gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/5">
                                <button
                                    type="button"
                                    onClick={() => setParticipantType("interviewer")}
                                    className={`relative flex items-center justify-center gap-3 py-4 px-6 rounded-xl text-sm font-semibold transition-all duration-300 ${isInterviewer
                                        ? "bg-white/10 text-white shadow-lg backdrop-blur-md border border-white/10"
                                        : "text-white/40 hover:text-white hover:bg-white/5"
                                        }`}
                                >
                                    <UserCircle2 className={`w-5 h-5 ${isInterviewer ? "text-purple-400" : ""}`} />
                                    Interviewer
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setParticipantType("candidate")}
                                    className={`relative flex items-center justify-center gap-3 py-4 px-6 rounded-xl text-sm font-semibold transition-all duration-300 ${!isInterviewer
                                        ? "bg-white/10 text-white shadow-lg backdrop-blur-md border border-white/10"
                                        : "text-white/40 hover:text-white hover:bg-white/5"
                                        }`}
                                >
                                    <Code2 className={`w-5 h-5 ${!isInterviewer ? "text-emerald-400" : ""}`} />
                                    Candidate
                                </button>
                            </div>

                            {/* Name Input */}
                            <div className="space-y-6 animate-fade-up delay-200">
                                <div className="space-y-3">
                                    <Label htmlFor="name" className="text-white/60 ml-1 text-sm font-medium tracking-wide">FULL NAME</Label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-4 w-5 h-5 text-white/30 group-focus-within:text-purple-400 transition-colors" />
                                        <Input
                                            id="name"
                                            type="text"
                                            placeholder="Enter your full name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            required
                                            autoFocus
                                            className="pl-12 h-14 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-purple-500/50 focus:ring-purple-500/20 rounded-2xl transition-all text-lg font-light"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Interviewer Context Inputs (Animated Expand) */}
                            <div className={`space-y-8 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden ${isInterviewer ? "opacity-100 max-h-[800px] pt-4" : "opacity-0 max-h-0 pt-0"}`}>
                                <div className="border-t border-white/5 pt-8">
                                    <div className="flex items-center gap-3 mb-8">
                                        <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                            <Sparkles className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-white tracking-tight">AI Briefing Setup</h3>
                                            <p className="text-xs text-white/40 font-light">Configure context for the AI agent</p>
                                        </div>
                                        <span className="text-[10px] text-white/20 uppercase tracking-widest font-bold ml-auto px-2 py-1 rounded bg-white/5">Optional</span>
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <Label htmlFor="jobDescription" className="text-white/60 ml-1 text-sm font-medium tracking-wide">JOB DESCRIPTION</Label>
                                            <div className="relative group">
                                                <Briefcase className="absolute left-4 top-4 w-5 h-5 text-white/30 group-focus-within:text-purple-400 transition-colors" />
                                                <Textarea
                                                    id="jobDescription"
                                                    placeholder="Paste JD here to enable context-aware questions..."
                                                    value={jobDescription}
                                                    onChange={(e) => setJobDescription(e.target.value)}
                                                    className="pl-12 pt-4 min-h-[160px] bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-purple-500/50 focus:ring-purple-500/20 rounded-2xl transition-all resize-none text-sm leading-relaxed"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <Label htmlFor="candidateResume" className="text-white/60 ml-1 text-sm font-medium tracking-wide">CANDIDATE PROFILE</Label>
                                            <div className="relative group">
                                                <FileText className="absolute left-4 top-4 w-5 h-5 text-white/30 group-focus-within:text-purple-400 transition-colors" />
                                                <Textarea
                                                    id="candidateResume"
                                                    placeholder="Paste resume or key highlights..."
                                                    value={candidateResume}
                                                    onChange={(e) => setCandidateResume(e.target.value)}
                                                    className="pl-12 pt-4 min-h-[160px] bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-purple-500/50 focus:ring-purple-500/20 rounded-2xl transition-all resize-none text-sm leading-relaxed"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <Button
                                type="submit"
                                className={`w-full h-14 text-lg font-semibold transition-all duration-500 rounded-2xl relative overflow-hidden group ${isInterviewer
                                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-[0_0_40px_rgba(124,58,237,0.5)]"
                                    : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:shadow-[0_0_40px_rgba(5,150,105,0.5)]"
                                    }`}
                                disabled={!name.trim() || isLoading}
                            >
                                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 skew-x-12"></div>
                                {isLoading ? (
                                    <div className="flex items-center gap-3">
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>{isInterviewer ? "Initializing Room..." : "Connecting..."}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <span>{isInterviewer ? "Start Session" : "Join Room"}</span>
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                )}
                            </Button>

                        </form>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center mt-10 space-y-4 animate-fade-up delay-300">
                    <a
                        href="/candidates"
                        className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm font-medium tracking-wide group"
                    >
                        <User className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        View Candidate Pipeline
                    </a>
                    <p className="text-white/20 text-xs tracking-wider uppercase font-semibold">
                        Powered by Daily.co & OpenAI Realtime
                    </p>
                </div>
            </div>
        </div>
    );
}
