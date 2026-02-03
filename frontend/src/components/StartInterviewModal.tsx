"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Mic, User, Loader2, Calendar, Zap, ChevronLeft } from "lucide-react";

export type InterviewRole = "interviewer" | "candidate";

interface StartInterviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    candidateId: string;
    candidateName: string;
    jobTitle: string;
    onReschedule?: () => void;
}

export default function StartInterviewModal({
    isOpen,
    onClose,
    candidateId,
    candidateName,
    jobTitle,
    onReschedule,
}: StartInterviewModalProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [view, setView] = useState<"menu" | "role_selection">("menu");
    const [selectedRole, setSelectedRole] = useState<InterviewRole | null>(null);

    if (!isOpen) return null;

    // Reset view when closing/opening can be handled by parent or effect, 
    // but simplicity is key. For now, if closed, we rely on parent unmounting or resetting if needed.
    // Ideally use Effect to reset view on `isOpen` change if this stays mounted.

    const handleSelectRole = (role: InterviewRole) => {
        setIsLoading(true);
        setSelectedRole(role);
        // Navigate to interview page with role parameter
        router.push(`/talent-pool/${candidateId}/interview?role=${role}`);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
            <div
                className="glass-panel rounded-2xl p-0 max-w-2xl w-full mx-4 relative overflow-hidden shadow-2xl border border-white/10"
                style={{ backgroundColor: "#0f1115" }} // Explicit dark bg fallback
            >
                {/* Header Background Gradient */}
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-white/40 hover:text-white/80 transition-colors z-10"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Back Button (Only in role selection) */}
                {view === "role_selection" && (
                    <button
                        onClick={() => setView("menu")}
                        className="absolute top-4 left-4 p-2 text-white/40 hover:text-white/80 transition-colors z-10 flex items-center gap-1 text-sm font-medium"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Back
                    </button>
                )}

                <div className="p-8 pt-10 relative">
                    {/* Header Text */}
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-semibold text-white mb-2 tracking-tight">
                            {view === "menu" ? "Manage Interview" : "Choose Your Role"}
                        </h2>
                        <p className="text-white/50 text-sm">
                            {candidateName} • <span className="text-indigo-400">{jobTitle}</span>
                        </p>
                    </div>

                    {/* VIEW: MENU (Edit vs Start) */}
                    {view === "menu" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* ACTION: Edit Schedule */}
                            <button
                                onClick={() => {
                                    if (onReschedule) {
                                        onReschedule();
                                        onClose();
                                    }
                                }}
                                className="group relative p-6 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-indigo-500/30 transition-all duration-300 text-left flex flex-col h-full"
                            >
                                <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4 group-hover:bg-indigo-500/20 group-hover:scale-110 transition-all duration-300">
                                    <Calendar className="w-6 h-6 text-indigo-400" />
                                </div>
                                <h3 className="text-lg font-medium text-white mb-2 group-hover:text-indigo-300 transition-colors">
                                    Edit Schedule
                                </h3>
                                <p className="text-sm text-white/40 leading-relaxed">
                                    Change the date or time of this interview round.
                                </p>
                            </button>

                            {/* ACTION: Start Interview */}
                            <button
                                onClick={() => setView("role_selection")}
                                className="group relative p-6 rounded-xl border border-white/5 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 hover:from-indigo-500/20 hover:to-purple-500/20 border-indigo-500/20 hover:border-indigo-500/40 transition-all duration-300 text-left flex flex-col h-full"
                            >
                                <div className="w-12 h-12 rounded-full bg-indigo-500 shadow-lg  shadow-indigo-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                    <Zap className="w-6 h-6 text-white fill-white" />
                                </div>
                                <h3 className="text-lg font-medium text-white mb-2">
                                    Start Interview
                                </h3>
                                <p className="text-sm text-indigo-200/60 leading-relaxed">
                                    Launch the AI interview session now.
                                </p>
                            </button>
                        </div>
                    )}

                    {/* VIEW: ROLE SELECTION */}
                    {view === "role_selection" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                            {/* Interviewer Role */}
                            <button
                                onClick={() => handleSelectRole("interviewer")}
                                disabled={isLoading}
                                className="group p-5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-[#0A84FF]/5 hover:border-[#0A84FF]/30 transition-all duration-300 text-left disabled:opacity-50"
                            >
                                <div className="flex flex-col items-center text-center">
                                    <div className="w-14 h-14 rounded-full bg-[#0A84FF]/10 flex items-center justify-center mb-3 group-hover:bg-[#0A84FF]/20 transition-colors">
                                        <Mic className="w-7 h-7 text-[#0A84FF]" />
                                    </div>
                                    <h3 className="text-base font-medium text-white mb-1">
                                        Join as Interviewer
                                    </h3>
                                    <p className="text-xs text-white/50 mb-4">
                                        Conduct the interview yourself
                                    </p>
                                    <div className="w-full py-2.5 px-3 rounded-lg bg-[#0A84FF] text-white text-sm font-medium shadow-lg shadow-[#0A84FF]/20 group-hover:shadow-[#0A84FF]/40 transition-all">
                                        {isLoading && selectedRole === "interviewer" ? (
                                            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                        ) : (
                                            "Start as Interviewer"
                                        )}
                                    </div>
                                </div>
                            </button>

                            {/* Candidate Role */}
                            <button
                                onClick={() => handleSelectRole("candidate")}
                                disabled={isLoading}
                                className="group p-5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-[#BF5AF2]/5 hover:border-[#BF5AF2]/30 transition-all duration-300 text-left disabled:opacity-50"
                            >
                                <div className="flex flex-col items-center text-center">
                                    <div className="w-14 h-14 rounded-full bg-[#BF5AF2]/10 flex items-center justify-center mb-3 group-hover:bg-[#BF5AF2]/20 transition-colors">
                                        <User className="w-7 h-7 text-[#BF5AF2]" />
                                    </div>
                                    <h3 className="text-base font-medium text-white mb-1">
                                        Join as Candidate
                                    </h3>
                                    <p className="text-xs text-white/50 mb-4">
                                        Experience being interviewed
                                    </p>
                                    <div className="w-full py-2.5 px-3 rounded-lg bg-[#BF5AF2] text-white text-sm font-medium shadow-lg shadow-[#BF5AF2]/20 group-hover:shadow-[#BF5AF2]/40 transition-all">
                                        {isLoading && selectedRole === "candidate" ? (
                                            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                        ) : (
                                            "Start as Candidate"
                                        )}
                                    </div>
                                </div>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
