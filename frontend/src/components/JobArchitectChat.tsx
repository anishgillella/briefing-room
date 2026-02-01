import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from 'react-markdown';
import {
    Send,
    Sparkles,
    User,
    Bot,
    Briefcase,
    TrendingUp,
    DollarSign,
    Loader2,
    CheckCircle2,
    MapPin,
    Clock,
    ChevronRight
} from "lucide-react";
import { tokens } from "@/lib/design-tokens";
import {
    chatWithArchitect,
    generateJobDescription,
    Message,
    MarketInsights
} from "@/lib/jobArchitectApi";

interface JobArchitectChatProps {
    onComplete: (jd: string, title?: string) => void;
    onCancel: () => void;
}

export default function JobArchitectChat({ onComplete, onCancel }: JobArchitectChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [marketInsights, setMarketInsights] = useState<MarketInsights | null>(null);
    const [draftTitle, setDraftTitle] = useState<string | null>(null);
    const [isReadyParams, setIsReadyParams] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedJd, setGeneratedJd] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Initialize chat
    useEffect(() => {
        if (messages.length === 0) {
            // Add initial greeting from AI (simulated, or we could call API)
            setMessages([{
                role: "assistant",
                content: "Hi! I'm your Job Architect. Let's design this role together. **Do you already have a specific job title in mind?** (If not, tell me what business problem you're trying to solve, and I'll help you define it.)"
            }]);
        }
    }, []);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg: Message = { role: "user", content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);

        try {
            // Call API with full history including new user message
            const history = [...messages, userMsg];
            const response = await chatWithArchitect(history);

            setMessages(prev => [...prev, { role: "assistant", content: response.message }]);

            if (response.market_insights) {
                setMarketInsights(response.market_insights);
            }

            if (response.suggested_title) {
                setDraftTitle(response.suggested_title);
            }

            if (response.is_ready_to_generate) {
                setIsReadyParams(true);
            }

        } catch (error) {
            console.error(error);
            // Simple error handling for UI
            setMessages(prev => [...prev, { role: "assistant", content: "I'm having trouble connecting. Please try again." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const { jd } = await generateJobDescription(messages);
            setGeneratedJd(jd);
            // Don't auto-complete. Let user review in modal.
        } catch (error) {
            console.error(error);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[700px] relative">
            {/* Blueprint Review Modal */}
            <AnimatePresence>
                {generatedJd && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm rounded-2xl"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="w-full max-w-2xl max-h-full flex flex-col rounded-2xl shadow-2xl border"
                            style={{ backgroundColor: tokens.bgSurface, borderColor: tokens.borderSubtle }}
                        >
                            <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: tokens.borderSubtle }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${tokens.statusSuccess}20` }}>
                                        <CheckCircle2 className="w-6 h-6" style={{ color: tokens.statusSuccess }} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Blueprint Ready</h3>
                                        <p className="text-xs" style={{ color: tokens.textMuted }}>Review your Job Description</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setGeneratedJd(null)}
                                    className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                                >
                                    <span className="sr-only">Close</span>
                                    <svg className="w-5 h-5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 bg-black/40">
                                <div className="prose prose-sm max-w-none">
                                    <ReactMarkdown
                                        components={{
                                            h1: ({ node, ...props }) => <h1 className="text-xl font-bold text-white mt-4 mb-2" {...props} />,
                                            h2: ({ node, ...props }) => <h2 className="text-lg font-bold text-white mt-4 mb-2" {...props} />,
                                            h3: ({ node, ...props }) => <h3 className="text-md font-bold text-white mt-3 mb-1" {...props} />,
                                            p: ({ node, ...props }) => <p className="text-gray-200 leading-relaxed mb-4" {...props} />,
                                            ul: ({ node, ...props }) => <ul className="list-disc pl-5 text-gray-200 mb-4" {...props} />,
                                            ol: ({ node, ...props }) => <ol className="list-decimal pl-5 text-gray-200 mb-4" {...props} />,
                                            li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                                            strong: ({ node, ...props }) => <strong className="font-bold text-white" {...props} />,
                                        }}
                                    >
                                        {generatedJd}
                                    </ReactMarkdown>
                                </div>
                            </div>

                            <div className="p-5 border-t flex gap-3 justify-end" style={{ borderColor: tokens.borderSubtle }}>
                                <button
                                    onClick={() => setGeneratedJd(null)}
                                    className="px-4 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-white/5"
                                    style={{ color: tokens.textSecondary }}
                                >
                                    Keep Refining (Chat)
                                </button>
                                <button
                                    onClick={() => onComplete(generatedJd, draftTitle || undefined)}
                                    className="px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg hover:scale-105 transition-all"
                                    style={{
                                        background: `linear-gradient(135deg, ${tokens.brandPrimary}, #8B5CF6)`,
                                        color: "white"
                                    }}
                                >
                                    Transfer to Editor <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Chat Area */}
            <div className="lg:col-span-2 flex flex-col rounded-2xl border overflow-hidden"
                style={{ backgroundColor: tokens.bgSurface, borderColor: tokens.borderSubtle }}>

                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: tokens.borderSubtle }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${tokens.brandPrimary}20` }}>
                            <Bot className="w-6 h-6" style={{ color: tokens.brandPrimary }} />
                        </div>
                        <div>
                            <h3 className="font-bold text-white">Job Architect AI</h3>
                            <p className="text-xs" style={{ color: tokens.textMuted }}>Role Discovery & Market Calibration</p>
                        </div>
                    </div>
                    <button onClick={onCancel} className="text-sm px-3 py-1.5 rounded hover:bg-white/5 transition-colors" style={{ color: tokens.textSecondary }}>
                        Cancel
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {messages.map((msg, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                            {msg.role === "assistant" && (
                                <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1" style={{ backgroundColor: tokens.bgCard }}>
                                    <Sparkles className="w-4 h-4" style={{ color: tokens.brandSecondary }} />
                                </div>
                            )}

                            <div
                                className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed ${msg.role === "user"
                                    ? "rounded-tr-none"
                                    : "rounded-tl-none"
                                    }`}
                                style={{
                                    backgroundColor: msg.role === "user" ? tokens.brandPrimary : tokens.bgCard,
                                    color: msg.role === "user" ? "white" : tokens.textPrimary
                                }}
                            >
                                {msg.content.split('\n').map((line, lineIdx) => (
                                    <p key={lineIdx} className={lineIdx > 0 ? "mt-2" : ""}>
                                        {line.split(/(\*\*.*?\*\*)/).map((part, partIdx) => {
                                            if (part.startsWith('**') && part.endsWith('**')) {
                                                return <strong key={partIdx}>{part.slice(2, -2)}</strong>;
                                            }
                                            return part;
                                        })}
                                    </p>
                                ))}
                            </div>

                            {msg.role === "user" && (
                                <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1" style={{ backgroundColor: tokens.bgCard }}>
                                    <User className="w-4 h-4" style={{ color: tokens.textSecondary }} />
                                </div>
                            )}
                        </motion.div>
                    ))}

                    {isLoading && (
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1" style={{ backgroundColor: tokens.bgCard }}>
                                <Sparkles className="w-4 h-4" style={{ color: tokens.brandSecondary }} />
                            </div>
                            <div className="bg-white/5 p-4 rounded-2xl rounded-tl-none flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce" />
                                <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce delay-75" />
                                <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce delay-150" />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t" style={{ borderColor: tokens.borderSubtle }}>
                    <form onSubmit={handleSubmit} className="flex gap-3">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type your reply..."
                            className="flex-1 bg-transparent border-0 focus:ring-0 text-white placeholder-white/30"
                            style={{ outline: "none" }}
                            autoFocus
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="p-2 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ backgroundColor: tokens.brandPrimary }}
                        >
                            <Send className="w-4 h-4 text-white" />
                        </button>
                    </form>
                </div>
            </div>

            {/* Insights Panel */}
            <div className="flex flex-col gap-4">
                {/* Role Card */}
                <div className="p-5 rounded-2xl border transition-all duration-300"
                    style={{
                        backgroundColor: tokens.bgCard,
                        borderColor: draftTitle ? tokens.brandPrimary : tokens.borderSubtle,
                        boxShadow: draftTitle ? `0 0 0 1px ${tokens.brandPrimary}` : "none"
                    }}>
                    <div className="flex items-center gap-3 mb-2">
                        <Briefcase className="w-5 h-5" style={{ color: tokens.brandSecondary }} />
                        <h4 className="font-semibold text-white">Target Role</h4>
                    </div>
                    <p className="text-lg font-light text-white">
                        {draftTitle || <span className="text-white/30 italic">Determining...</span>}
                    </p>
                </div>

                {/* Market Data Card */}
                <AnimatePresence>
                    {marketInsights ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="p-5 rounded-2xl border space-y-4"
                            style={{ backgroundColor: tokens.bgCard, borderColor: tokens.borderSubtle }}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <TrendingUp className="w-5 h-5" style={{ color: tokens.statusSuccess }} />
                                <h4 className="font-semibold text-white">Market Reality</h4>
                            </div>

                            <div className="space-y-3">
                                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                                    <div className="text-xs text-white/50 mb-1 flex items-center gap-1">
                                        <DollarSign className="w-3 h-3" /> Salary Range
                                    </div>
                                    <div className="text-xl font-medium text-white">
                                        ${(marketInsights.salary_range_low / 1000).toFixed(0)}k - ${(marketInsights.salary_range_high / 1000).toFixed(0)}k
                                    </div>
                                    <div className="text-xs text-white/50 mt-1">{marketInsights.location}</div>
                                </div>

                                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                                    <div className="text-xs text-white/50 mb-1 flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> Avg Time to Hire
                                    </div>
                                    <div className="text-lg font-medium text-white">
                                        {marketInsights.average_time_to_hire_days} Days
                                    </div>
                                </div>

                                <div>
                                    <div className="text-xs text-white/50 mb-2">Top Skills Required</div>
                                    <div className="flex flex-wrap gap-2">
                                        {marketInsights.top_skills.slice(0, 4).map(skill => (
                                            <span key={skill} className="text-xs px-2 py-1 rounded-md bg-white/10 text-white/80">
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {marketInsights.sources && marketInsights.sources.length > 0 && (
                                    <div className="text-[10px] text-white/30 text-right pt-2 border-t border-white/5">
                                        Source: {marketInsights.sources[0]}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ) : (
                        <div className="p-5 rounded-2xl border border-dashed flex flex-col items-center justify-center text-center py-12"
                            style={{ borderColor: tokens.borderSubtle }}>
                            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 text-white/20 bg-white/5">
                                <TrendingUp className="w-6 h-6" />
                            </div>
                            <p className="text-sm text-white/40">Market insights will appear here when role is defined</p>
                        </div>
                    )}
                </AnimatePresence>

                {/* Generate Button */}
                <div className="mt-auto">
                    <button
                        onClick={handleGenerate}
                        disabled={!isReadyParams || isGenerating}
                        className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                            background: isReadyParams
                                ? `linear-gradient(135deg, ${tokens.brandPrimary}, #8B5CF6)`
                                : tokens.bgSurface,
                            color: isReadyParams ? "white" : tokens.textDisabled,
                            border: isReadyParams ? "none" : `1px solid ${tokens.borderSubtle}`
                        }}
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                {generatedJd ? "Regenerate JD" : "Generating JD..."}
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-5 h-5" />
                                {generatedJd ? "View Blueprint" : "Generate Blueprint"}
                            </>
                        )}
                    </button>
                    {!isReadyParams && (
                        <p className="text-xs text-center mt-3 text-white/30">
                            Complete the discovery conversation to enable generation
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
