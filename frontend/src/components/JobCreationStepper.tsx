import { motion } from "framer-motion";
import { Check } from "lucide-react";

interface JobCreationStepperProps {
    currentStep: 1 | 2;
}

const tokens = {
    brandPrimary: "#6366F1",
    brandGlow: "rgba(99,102,241,0.5)",
    textPrimary: "#F8FAFC",
    textMuted: "#64748B",
    bgCard: "#0F172A",
    borderDefault: "rgba(255,255,255,0.08)",
    success: "#10B981",
};

export default function JobCreationStepper({ currentStep }: JobCreationStepperProps) {
    return (
        <div className="w-full max-w-lg mx-auto mb-8">
            <div className="relative flex items-center justify-between">

                {/* Connecting Line - Background */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-white/5 rounded-full -z-10" />

                {/* Connecting Line - Progress */}
                <motion.div
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full -z-10"
                    initial={{ width: "0%" }}
                    animate={{ width: currentStep === 2 ? "100%" : "0%" }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                />

                {/* Step 1: Enter Details */}
                <div className="relative flex flex-col items-center gap-2 group cursor-default">
                    <motion.div
                        initial={false}
                        animate={{
                            backgroundColor: currentStep === 1 ? tokens.brandPrimary : tokens.success,
                            borderColor: currentStep === 1 ? tokens.brandPrimary : tokens.success,
                            scale: currentStep === 1 ? 1.1 : 1,
                            boxShadow: currentStep === 1
                                ? `0 0 20px ${tokens.brandGlow}`
                                : `0 0 0px ${tokens.brandGlow}`,
                        }}
                        className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-transparent z-10 transition-colors duration-300"
                    >
                        {currentStep === 1 ? (
                            <span className="font-bold text-white text-sm">1</span>
                        ) : (
                            <Check className="w-5 h-5 text-white" strokeWidth={3} />
                        )}
                    </motion.div>
                    <motion.span
                        animate={{ color: currentStep === 1 ? tokens.textPrimary : tokens.success }}
                        className="absolute top-12 whitespace-nowrap text-sm font-semibold tracking-wide"
                    >
                        Enter Details
                    </motion.span>
                </div>

                {/* Step 2: Review & Create */}
                <div className="relative flex flex-col items-center gap-2 group cursor-default">
                    <motion.div
                        initial={false}
                        animate={{
                            backgroundColor: currentStep === 2 ? tokens.brandPrimary : tokens.bgCard,
                            borderColor: currentStep === 2 ? tokens.brandPrimary : tokens.borderDefault,
                            scale: currentStep === 2 ? 1.1 : 1,
                            boxShadow: currentStep === 2
                                ? `0 0 20px ${tokens.brandGlow}`
                                : "none",
                        }}
                        className="w-10 h-10 rounded-full flex items-center justify-center border-2 z-10 transition-colors duration-300"
                    >
                        <span className={`font-bold text-sm ${currentStep === 2 ? "text-white" : "text-slate-500"}`}>
                            2
                        </span>
                    </motion.div>
                    <motion.span
                        animate={{ color: currentStep === 2 ? tokens.textPrimary : tokens.textMuted }}
                        className="absolute top-12 whitespace-nowrap text-sm font-semibold tracking-wide"
                    >
                        Review & Create
                    </motion.span>
                </div>
            </div>
        </div>
    );
}
