"use client";

import { useEffect, useState, use } from "react";
import { motion } from "framer-motion";
import {
    MapPin,
    Briefcase,
    DollarSign,
    Clock,
    CheckCircle,
    Upload,
    ArrowRight,
    Loader2,
    AlertCircle
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { getPublicJob, applyToJob, type PublicJobDetail } from "@/lib/publicApi";
import { tokens } from "@/lib/design-tokens";

const GRADIENTS = {
    primary: "linear-gradient(135deg, #6366F1 0%, #A855F7 100%)",
    surface: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
};

export default function PublicJobPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const [job, setJob] = useState<PublicJobDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        linkedin_url: "",
        portfolio_url: "",
    });
    const [resume, setResume] = useState<File | null>(null);

    useEffect(() => {
        fetchJob();
    }, [resolvedParams.id]);

    const fetchJob = async () => {
        try {
            const data = await getPublicJob(resolvedParams.id);
            setJob(data);
        } catch (err) {
            console.error(err);
            setError("Job not found or no longer active.");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resume || !job) return;

        setSubmitting(true);
        try {
            await applyToJob(job.id, {
                ...formData,
                resume,
            });
            setSubmitted(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            console.error(err);
            alert("Failed to submit application. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    if (error || !job) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                    <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Job Not Found</h1>
                <p className="text-slate-400 max-w-md">{error || "The position you are looking for does not exist or has been closed."}</p>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="max-w-2xl mx-auto px-6 py-20 text-center">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-[#0F121D] border border-white/5 rounded-3xl p-12 shadow-2xl"
                >
                    <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-10 h-10 text-green-400" />
                    </div>
                    <h1 className="text-3xl font-bold mb-4">Application Sent!</h1>
                    <p className="text-lg text-slate-300 mb-8">
                        Thanks for applying to <strong>{job.title}</strong> based in {job.location || 'Remote'}.
                        We've received your details and will be in touch soon.
                    </p>
                    <div className="p-4 bg-white/5 rounded-xl text-sm text-slate-400">
                        A confirmation email has been sent to {formData.email}
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-6 py-12">
            {/* Header Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-8"
            >
                <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">{job.title}</h1>

                <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                    {job.location && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
                            <MapPin className="w-4 h-4" />
                            {job.location}
                        </div>
                    )}
                    {job.work_type && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
                            <Briefcase className="w-4 h-4" />
                            <span className="capitalize">{job.work_type}</span>
                        </div>
                    )}
                    {job.salary_range && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
                            <DollarSign className="w-4 h-4" />
                            {job.salary_range}
                        </div>
                    )}
                    {job.requirements.years_experience && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
                            <Clock className="w-4 h-4" />
                            {job.requirements.years_experience}
                        </div>
                    )}
                </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr,400px] gap-16">

                {/* Left Column: Job Details */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                >
                    <div className="mb-0">
                        <div className="prose prose-invert prose-lg max-w-none text-slate-300">
                            <ReactMarkdown
                                components={{
                                    h1: ({ node, ...props }) => <h1 className="text-3xl font-bold text-white mt-8 mb-4" {...props} />,
                                    h2: ({ node, ...props }) => <h2 className="text-2xl font-bold text-white mt-8 mb-4 border-b border-white/10 pb-2" {...props} />,
                                    h3: ({ node, ...props }) => <h3 className="text-xl font-bold text-white mt-6 mb-3" {...props} />,
                                    ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-4 space-y-2" {...props} />,
                                    ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-4 space-y-2" {...props} />,
                                    li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                                    p: ({ node, ...props }) => <p className="mb-4 leading-relaxed" {...props} />,
                                    strong: ({ node, ...props }) => <strong className="font-semibold text-white" {...props} />,
                                }}
                            >
                                {job.description}
                            </ReactMarkdown>
                        </div>
                    </div>
                </motion.div>

                {/* Right Column: Application Form */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="lg:sticky lg:top-24 h-fit"
                >
                    <div
                        className="rounded-3xl p-6 md:p-8"
                        style={{
                            background: "#0F121D",
                            border: "1px solid rgba(255,255,255,0.08)",
                            boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)"
                        }}
                    >
                        <h3 className="text-2xl font-bold mb-2">Apply Now</h3>
                        <p className="text-slate-400 mb-6 text-sm">Fill out the form below to apply for this position.</p>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name <span className="text-red-400">*</span></label>
                                <input
                                    required
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all"
                                    placeholder="John Doe"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Address <span className="text-red-400">*</span></label>
                                <input
                                    required
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all"
                                    placeholder="john@example.com"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Phone Number</label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all"
                                    placeholder="+1 (555) 000-0000"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">LinkedIn URL</label>
                                <input
                                    type="url"
                                    value={formData.linkedin_url}
                                    onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all"
                                    placeholder="https://linkedin.com/in/..."
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Resume / CV <span className="text-red-400">*</span></label>
                                <div className="relative group">
                                    <input
                                        required
                                        type="file"
                                        accept=".pdf,.doc,.docx"
                                        onChange={(e) => setResume(e.target.files?.[0] || null)}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <div className={`
                    w-full bg-white/5 border-2 border-dashed rounded-xl px-4 py-8 text-center transition-all
                    ${resume ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-white/10 group-hover:border-white/20 group-hover:bg-white/10'}
                  `}>
                                        <div className="flex flex-col items-center gap-2 pointer-events-none">
                                            <div className="p-2 rounded-lg bg-white/5">
                                                <Upload className="w-5 h-5 text-indigo-400" />
                                            </div>
                                            <div className="text-sm font-medium text-slate-300">
                                                {resume ? resume.name : "Click to upload resume"}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {resume ? "Ready to submit" : "PDF, DOCX up to 10MB"}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={submitting || !resume}
                                    className={`
                    w-full py-3.5 px-6 rounded-xl font-medium flex items-center justify-center gap-2 transition-all
                    ${submitting || !resume
                                            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                            : 'text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5'
                                        }
                  `}
                                    style={{
                                        background: submitting || !resume ? undefined : GRADIENTS.primary
                                    }}
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            Submit Application
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </div>

                        </form>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
