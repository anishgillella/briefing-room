"use client";

import { Mic, User, Loader2 } from "lucide-react";

export type InterviewRole = "interviewer" | "candidate";

interface RoleSelectorProps {
    candidateName: string;
    jobTitle: string;
    onSelectRole: (role: InterviewRole) => void;
    isLoading?: boolean;
}

export default function RoleSelector({
    candidateName,
    jobTitle,
    onSelectRole,
    isLoading = false,
}: RoleSelectorProps) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
            <h2 className="text-2xl font-bold text-white mb-2">
                Join Interview Session
            </h2>
            <p className="text-gray-400 mb-8 text-center">
                Interview for{" "}
                <span className="font-medium text-white">{jobTitle || "this position"}</span>
                {candidateName && (
                    <>
                        {" "}with{" "}
                        <span className="font-medium text-white">{candidateName}</span>
                    </>
                )}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl w-full">
                {/* Interviewer Role */}
                <button
                    onClick={() => !isLoading && onSelectRole("interviewer")}
                    disabled={isLoading}
                    className={`
                        p-6 rounded-2xl border transition-all duration-200
                        bg-[#1C1C1E] border-[#3A3A3C]
                        hover:border-[#0A84FF] hover:bg-[#0A84FF]/5
                        disabled:opacity-50 disabled:cursor-not-allowed
                        text-left group
                    `}
                >
                    <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-full bg-[#0A84FF]/10 flex items-center justify-center mb-4 group-hover:bg-[#0A84FF]/20 transition-colors">
                            <Mic className="w-8 h-8 text-[#0A84FF]" />
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-1">
                            Join as Interviewer
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">
                            You conduct the interview
                        </p>
                        <ul className="text-sm text-gray-400 space-y-1 mb-4">
                            <li>• You ask questions</li>
                            <li>• AI plays the candidate</li>
                            <li>• Get real-time coaching</li>
                        </ul>
                        <div className="w-full py-2.5 px-4 rounded-xl bg-[#0A84FF] text-white font-medium text-center">
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                            ) : (
                                "Start as Interviewer"
                            )}
                        </div>
                    </div>
                </button>

                {/* Candidate Role */}
                <button
                    onClick={() => !isLoading && onSelectRole("candidate")}
                    disabled={isLoading}
                    className={`
                        p-6 rounded-2xl border transition-all duration-200
                        bg-[#1C1C1E] border-[#3A3A3C]
                        hover:border-[#BF5AF2] hover:bg-[#BF5AF2]/5
                        disabled:opacity-50 disabled:cursor-not-allowed
                        text-left group
                    `}
                >
                    <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-full bg-[#BF5AF2]/10 flex items-center justify-center mb-4 group-hover:bg-[#BF5AF2]/20 transition-colors">
                            <User className="w-8 h-8 text-[#BF5AF2]" />
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-1">
                            Join as Candidate
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Experience being interviewed
                        </p>
                        <ul className="text-sm text-gray-400 space-y-1 mb-4">
                            <li>• AI asks you questions</li>
                            <li>• You answer as candidate</li>
                            <li>• Test the candidate UX</li>
                        </ul>
                        <div className="w-full py-2.5 px-4 rounded-xl bg-[#BF5AF2] text-white font-medium text-center">
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                            ) : (
                                "Start as Candidate"
                            )}
                        </div>
                    </div>
                </button>
            </div>

            <p className="text-xs text-gray-500 mt-8 text-center max-w-md">
                Both modes generate analytics after the interview ends.
                Choose based on which experience you want to test.
            </p>
        </div>
    );
}
