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
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-4 relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />

            <div className={`w-full relative z-10 transition-all duration-500 ease-in-out ${isInterviewer ? "max-w-4xl" : "max-w-md"}`}>

                {/* Header Section */}
                <div className="text-center mb-8 space-y-2">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-emerald-400">
                            {roomName ? "Join Interview" : "Superposition"}
                        </span>
                    </h1>
                    <p className="text-slate-400 text-lg">
                        {roomName
                            ? `Entering room: ${roomName}`
                            : "Next-generation AI-powered interview platform"
                        }
                    </p>
                </div>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                    <div className="p-8 md:p-10">
                        <form onSubmit={handleSubmit} className="space-y-8">

                            {/* Role Selection Tabs */}
                            <div className="grid grid-cols-2 gap-4 p-1 bg-black/20 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setParticipantType("interviewer")}
                                    className={`relative flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all duration-300 ${isInterviewer
                                            ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20"
                                            : "text-slate-400 hover:text-white hover:bg-white/5"
                                        }`}
                                >
                                    <UserCircle2 className="w-4 h-4" />
                                    Interviewer
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setParticipantType("candidate")}
                                    className={`relative flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all duration-300 ${!isInterviewer
                                            ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                                            : "text-slate-400 hover:text-white hover:bg-white/5"
                                        }`}
                                >
                                    <Code2 className="w-4 h-4" />
                                    Candidate
                                </button>
                            </div>

                            {/* Name Input */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-slate-300 ml-1">Your Name</Label>
                                    <div className="relative group">
                                        <User className="absolute left-3 top-3 w-5 h-5 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
                                        <Input
                                            id="name"
                                            type="text"
                                            placeholder="Enter your full name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            required
                                            autoFocus
                                            className="pl-10 h-11 bg-slate-900/50 border-white/10 text-white placeholder:text-slate-600 focus:border-violet-500 focus:ring-violet-500/20 transition-all font-medium"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Interviewer Context Inputs (Animated Expand) */}
                            <div className={`space-y-6 transition-all duration-500 ease-in-out overflow-hidden ${isInterviewer ? "opacity-100 max-h-[800px]" : "opacity-0 max-h-0"}`}>
                                <div className="pt-6 border-t border-white/5">
                                    <div className="flex items-center gap-2 mb-6">
                                        <div className="p-2 rounded-full bg-violet-500/10 text-violet-400">
                                            <Sparkles className="w-4 h-4" />
                                        </div>
                                        <h3 className="font-semibold text-white">AI Briefing Setup</h3>
                                        <span className="text-xs text-slate-500 uppercase tracking-wider font-medium ml-auto">Optional</span>
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="jobDescription" className="text-slate-300 ml-1">Job Description</Label>
                                            <div className="relative group">
                                                <Briefcase className="absolute left-3 top-3 w-5 h-5 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
                                                <Textarea
                                                    id="jobDescription"
                                                    placeholder="Paste the job description here..."
                                                    value={jobDescription}
                                                    onChange={(e) => setJobDescription(e.target.value)}
                                                    className="pl-10 min-h-[140px] bg-slate-900/50 border-white/10 text-white placeholder:text-slate-600 focus:border-violet-500 focus:ring-violet-500/20 transition-all resize-none"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="candidateResume" className="text-slate-300 ml-1">Candidate Details</Label>
                                            <div className="relative group">
                                                <FileText className="absolute left-3 top-3 w-5 h-5 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
                                                <Textarea
                                                    id="candidateResume"
                                                    placeholder="Paste resume summary or key notes..."
                                                    value={candidateResume}
                                                    onChange={(e) => setCandidateResume(e.target.value)}
                                                    className="pl-10 min-h-[140px] bg-slate-900/50 border-white/10 text-white placeholder:text-slate-600 focus:border-violet-500 focus:ring-violet-500/20 transition-all resize-none"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-center text-sm text-slate-500 pt-2">
                                        Our AI will analyze this to generate real-time questions, red flag warnings, and a competency radar chart.
                                    </p>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <Button
                                type="submit"
                                className={`w-full h-12 text-lg font-medium transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] ${isInterviewer
                                        ? "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/25"
                                        : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-500/25"
                                    }`}
                                disabled={!name.trim() || isLoading}
                            >
                                {isLoading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>{isInterviewer ? "Setting up Room..." : "Joining..."}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span>{isInterviewer ? "Start Interview Session" : "Join Room"}</span>
                                        <ArrowRight className="w-5 h-5" />
                                    </div>
                                )}
                            </Button>

                        </form>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-slate-500 text-sm mt-8">
                    Powered by <span className="text-slate-400 font-medium">Daily.co</span> & <span className="text-slate-400 font-medium">OpenAI Realtime</span>
                </p>
            </div>
        </div>
    );
}
