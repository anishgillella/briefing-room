"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Mic, User, Loader2 } from "lucide-react";

export type InterviewRole = "interviewer" | "candidate";

interface StartInterviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    candidateId: string;
    candidateName: string;
    jobTitle: string;
}

export default function StartInterviewModal({
    isOpen,
    onClose,
    candidateId,
    candidateName,
    jobTitle,
}: StartInterviewModalProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [selectedRole, setSelectedRole] = useState<InterviewRole | null>(null);

    if (!isOpen) return null;

    const handleSelectRole = (role: InterviewRole) => {
        setIsLoading(true);
        setSelectedRole(role);
        // Navigate to interview page with role parameter
        router.push(`/candidates/${candidateId}/interview?role=${role}`);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="glass-panel rounded-2xl p-6 max-w-2xl w-full mx-4 relative">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-white/40 hover:text-white/60 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Header */}
                <div className="text-center mb-6">
                    <h2 className="text-xl font-semibold text-white mb-2">
                        Start Interview
                    </h2>
                    <p className="text-white/50 text-sm">
                        Interview with{" "}
                        <span className="text-white font-medium">{candidateName}</span>
                        {jobTitle && (
                            <>
                                {" "}for{" "}
                                <span className="text-white font-medium">{jobTitle}</span>
                            </>
                        )}
                    </p>
                </div>

                {/* Role Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {/* Interviewer Role */}
                    <button
                        onClick={() => handleSelectRole("interviewer")}
                        disabled={isLoading}
                        className={`
                            p-5 rounded-xl border transition-all duration-200 text-left
                            bg-white/5 border-white/10
                            hover:border-[#0A84FF] hover:bg-[#0A84FF]/5
                            disabled:opacity-50 disabled:cursor-not-allowed
                            group
                        `}
                    >
                        <div className="flex flex-col items-center text-center">
                            <div className="w-14 h-14 rounded-full bg-[#0A84FF]/10 flex items-center justify-center mb-3 group-hover:bg-[#0A84FF]/20 transition-colors">
                                <Mic className="w-7 h-7 text-[#0A84FF]" />
                            </div>
                            <h3 className="text-base font-medium text-white mb-1">
                                Join as Interviewer
                            </h3>
                            <p className="text-xs text-white/50 mb-3">
                                You conduct the interview
                            </p>
                            <ul className="text-xs text-white/40 space-y-1">
                                <li>You ask questions</li>
                                <li>AI plays the candidate</li>
                                <li>Get real-time coaching</li>
                            </ul>
                            <div className="w-full mt-4 py-2 px-3 rounded-lg bg-[#0A84FF] text-white text-sm font-medium text-center">
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
                        className={`
                            p-5 rounded-xl border transition-all duration-200 text-left
                            bg-white/5 border-white/10
                            hover:border-[#BF5AF2] hover:bg-[#BF5AF2]/5
                            disabled:opacity-50 disabled:cursor-not-allowed
                            group
                        `}
                    >
                        <div className="flex flex-col items-center text-center">
                            <div className="w-14 h-14 rounded-full bg-[#BF5AF2]/10 flex items-center justify-center mb-3 group-hover:bg-[#BF5AF2]/20 transition-colors">
                                <User className="w-7 h-7 text-[#BF5AF2]" />
                            </div>
                            <h3 className="text-base font-medium text-white mb-1">
                                Join as Candidate
                            </h3>
                            <p className="text-xs text-white/50 mb-3">
                                Experience being interviewed
                            </p>
                            <ul className="text-xs text-white/40 space-y-1">
                                <li>AI asks you questions</li>
                                <li>You answer as candidate</li>
                                <li>Test the candidate UX</li>
                            </ul>
                            <div className="w-full mt-4 py-2 px-3 rounded-lg bg-[#BF5AF2] text-white text-sm font-medium text-center">
                                {isLoading && selectedRole === "candidate" ? (
                                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                ) : (
                                    "Start as Candidate"
                                )}
                            </div>
                        </div>
                    </button>
                </div>

                {/* Footer Note */}
                <p className="text-xs text-white/30 text-center">
                    Both modes generate analytics after the interview ends.
                </p>
            </div>
        </div>
    );
}
