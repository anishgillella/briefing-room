"use client";

import { useState } from "react";
import { User, Globe, ArrowRight, Loader2, Mail } from "lucide-react";

interface IntakeFormProps {
    onSubmit: (data: {
        firstName: string;
        lastName: string;
        email: string;
        companyWebsite: string;
    }) => Promise<void>;
    isLoading?: boolean;
}

export default function IntakeForm({ onSubmit, isLoading = false }: IntakeFormProps) {
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [companyWebsite, setCompanyWebsite] = useState("");
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Basic validation
        if (!firstName.trim() || !lastName.trim() || !email.trim() || !companyWebsite.trim()) {
            setError("All fields are required");
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            setError("Please enter a valid email address");
            return;
        }

        // Basic URL validation
        let website = companyWebsite.trim();
        if (!website.startsWith("http://") && !website.startsWith("https://")) {
            website = "https://" + website;
        }

        try {
            await onSubmit({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim(),
                companyWebsite: website,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        }
    };

    // Extract company name from email domain
    const getCompanyFromEmail = (email: string): string => {
        const match = email.match(/@([^.]+)/);
        if (match) {
            return match[1].charAt(0).toUpperCase() + match[1].slice(1);
        }
        return "";
    };

    return (
        <div className="max-w-xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6 text-sm font-medium text-indigo-300">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                    AI Recruiter Assistant
                </div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                    <span className="bg-gradient-to-r from-white via-white to-white/50 bg-clip-text text-transparent">
                        Build Your
                    </span>
                    <br />
                    <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        Hiring Profile
                    </span>
                </h1>
                <p className="text-lg text-white/50 max-w-md mx-auto">
                    Let's start with a few details. We'll research your company to personalize everything.
                </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Name Row */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-white/60 uppercase tracking-wider">
                            First Name
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <User className="h-4 w-4 text-white/30" />
                            </div>
                            <input
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                placeholder="Jane"
                                className="w-full pl-11 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                                disabled={isLoading}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-white/60 uppercase tracking-wider">
                            Last Name
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <User className="h-4 w-4 text-white/30" />
                            </div>
                            <input
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                placeholder="Smith"
                                className="w-full pl-11 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                                disabled={isLoading}
                            />
                        </div>
                    </div>
                </div>

                {/* Work Email */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-white/60 uppercase tracking-wider">
                        Work Email
                    </label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Mail className="h-4 w-4 text-white/30" />
                        </div>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="jane@company.com"
                            className="w-full pl-11 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                            disabled={isLoading}
                        />
                    </div>
                </div>

                {/* Company Website */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-white/60 uppercase tracking-wider">
                        Company Website
                    </label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Globe className="h-4 w-4 text-white/30" />
                        </div>
                        <input
                            type="text"
                            value={companyWebsite}
                            onChange={(e) => setCompanyWebsite(e.target.value)}
                            placeholder="company.com"
                            className="w-full pl-11 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                            disabled={isLoading}
                        />
                    </div>
                    <p className="text-xs text-white/30 pl-1">
                        We'll research your company to personalize the experience
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={isLoading || !firstName || !lastName || !email || !companyWebsite}
                    className="w-full py-4 rounded-full bg-white text-black font-semibold text-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-[0_0_40px_rgba(255,255,255,0.1)] flex items-center justify-center gap-3"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Starting Session...
                        </>
                    ) : (
                        <>
                            Continue
                            <ArrowRight className="w-5 h-5" />
                        </>
                    )}
                </button>
            </form>

            {/* Security Note */}
            <div className="mt-8 flex justify-center gap-8 text-white/20 text-xs font-medium">
                <span className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    SOC2 Compliant
                </span>
                <span className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Encrypted
                </span>
            </div>
        </div>
    );
}
