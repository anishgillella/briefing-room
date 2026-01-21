"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Building2,
  Briefcase,
  GraduationCap,
  ExternalLink,
  ChevronRight,
  Clock,
  Star,
  Target,
  TrendingUp,
  Activity,
  Award,
  User,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { tokens, springConfig, easeOutCustom, getTierConfig, getStatusConfig } from "@/lib/design-tokens";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface WorkHistory {
  company: string | null;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
}

interface Education {
  school: string | null;
  degree: string | null;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
}

interface Application {
  candidate_id: string;
  job_id: string | null;
  job_title: string | null;
  pipeline_status: string | null;
  interview_status: string | null;
  ranking_score: number | null;
  combined_score?: number | null;
  created_at: string | null;
}

interface PersonDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  resume_url: string | null;
  headline: string | null;
  summary: string | null;
  current_title: string | null;
  current_company: string | null;
  location: string | null;
  years_experience: number | null;
  skills: string[];
  work_history: WorkHistory[];
  education: Education[];
  created_at: string | null;
  updated_at: string | null;
  applications: Application[];
}

interface GlobalTalentProfile {
  person_id: string;
  person_name: string;
  total_applications: number;
  average_score: number | null;
  highest_score: number | null;
  lowest_score: number | null;
  status_breakdown: Record<string, number>;
  applications: Array<{
    job_id: string;
    job_title: string;
    score: number | null;
    status: string;
  }>;
}

// =============================================================================
// SCORE RING - Circular Progress
// =============================================================================
function ScoreRing({
  score,
  size = 80,
  strokeWidth = 6,
  label,
}: {
  score: number | null;
  size?: number;
  strokeWidth?: number;
  label?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percent = score !== null ? Math.min(100, Math.max(0, score)) : 0;
  const offset = circumference - (percent / 100) * circumference;

  const getColor = (score: number | null) => {
    if (score === null) return tokens.textDisabled;
    if (score >= 80) return tokens.statusSuccess;
    if (score >= 60) return tokens.brandPrimary;
    if (score >= 40) return tokens.statusWarning;
    return tokens.statusDanger;
  };

  const color = getColor(score);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          className="transform -rotate-90"
          width={size}
          height={size}
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={tokens.borderDefault}
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
            style={{
              filter: `drop-shadow(0 0 8px ${color}40)`,
            }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-xl font-bold tabular-nums"
            style={{ color: score !== null ? tokens.textPrimary : tokens.textDisabled }}
          >
            {score !== null ? Math.round(score) : "—"}
          </span>
        </div>
      </div>
      {label && (
        <span
          className="text-xs font-medium mt-2"
          style={{ color: tokens.textMuted }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

// =============================================================================
// STATUS BREAKDOWN BAR
// =============================================================================
function StatusBreakdownBar({
  breakdown,
}: {
  breakdown: Record<string, number>;
}) {
  const total = Object.values(breakdown).reduce((acc, v) => acc + v, 0);
  if (total === 0) return null;

  const segments = Object.entries(breakdown)
    .filter(([_, count]) => count > 0)
    .map(([status, count]) => ({
      status,
      count,
      percent: (count / total) * 100,
      config: getStatusConfig(status),
    }));

  return (
    <div className="space-y-3">
      {/* Bar */}
      <div
        className="h-2 rounded-full overflow-hidden flex"
        style={{ backgroundColor: tokens.bgSurface }}
      >
        {segments.map((seg, i) => (
          <motion.div
            key={seg.status}
            initial={{ width: 0 }}
            animate={{ width: `${seg.percent}%` }}
            transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
            className="h-full"
            style={{ backgroundColor: seg.config.color }}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {segments.map((seg) => (
          <div key={seg.status} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: seg.config.color }}
            />
            <span className="text-xs" style={{ color: tokens.textMuted }}>
              {seg.status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
            </span>
            <span
              className="text-xs font-semibold"
              style={{ color: tokens.textSecondary }}
            >
              {seg.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// SECTION CARD
// =============================================================================
function SectionCard({
  title,
  icon: Icon,
  children,
  delay = 0,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: easeOutCustom }}
    >
      <div
        className="rounded-2xl p-6"
        style={{
          backgroundColor: tokens.bgCard,
          border: `1px solid ${tokens.borderDefault}`,
        }}
      >
        <div className="flex items-center gap-3 mb-5">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: tokens.brandGlow }}
          >
            <Icon className="w-4 h-4" style={{ color: tokens.brandPrimary }} />
          </div>
          <h3
            className="text-sm font-semibold uppercase tracking-wide"
            style={{ color: tokens.textMuted }}
          >
            {title}
          </h3>
        </div>
        {children}
      </div>
    </motion.div>
  );
}

// =============================================================================
// LOADING STATE
// =============================================================================
function LoadingState() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: tokens.bgApp }}
    >
      <div className="flex flex-col items-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Activity className="w-8 h-8" style={{ color: tokens.brandPrimary }} />
        </motion.div>
        <span style={{ color: tokens.textMuted }}>Loading profile...</span>
      </div>
    </div>
  );
}

// =============================================================================
// NOT FOUND STATE
// =============================================================================
function NotFoundState() {
  const router = useRouter();

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: tokens.bgApp }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{
            backgroundColor: tokens.bgCard,
            border: `1px solid ${tokens.borderDefault}`,
          }}
        >
          <User className="w-10 h-10" style={{ color: tokens.textMuted }} />
        </div>
        <h3
          className="text-xl font-semibold mb-2"
          style={{ color: tokens.textPrimary }}
        >
          Person not found
        </h3>
        <p className="mb-6" style={{ color: tokens.textSecondary }}>
          This profile doesn't exist or has been removed.
        </p>
        <Button onClick={() => router.push("/talent-pool")}>
          Back to Talent Pool
        </Button>
      </motion.div>
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================
export default function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();

  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [globalProfile, setGlobalProfile] = useState<GlobalTalentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchPerson();
      fetchGlobalProfile();
    }
  }, [resolvedParams.id, isAuthenticated, token]);

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };

  const fetchPerson = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/talent-pool/${resolvedParams.id}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setPerson(data);
      } else if (response.status === 401) {
        router.push("/login");
      } else if (response.status === 404) {
        setPerson(null);
      }
    } catch (error) {
      console.error("Failed to fetch person:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGlobalProfile = async () => {
    try {
      const response = await fetch(`${API_URL}/api/talent-pool/${resolvedParams.id}/global-profile`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setGlobalProfile(data);
      }
    } catch (error) {
      console.error("Failed to fetch global profile:", error);
    }
  };

  if (authLoading || loading) {
    return <LoadingState />;
  }

  if (!person) {
    return <NotFoundState />;
  }

  // Calculate stats from global profile or applications
  const avgScore = globalProfile?.average_score ?? null;
  const highScore = globalProfile?.highest_score ?? null;
  const totalApps = globalProfile?.total_applications ?? person.applications?.length ?? 0;
  const statusBreakdown = globalProfile?.status_breakdown ?? {};

  return (
    <AppLayout>
      {/* Page Canvas */}
      <div
        className="min-h-screen relative"
        style={{ backgroundColor: tokens.bgApp }}
      >
        {/* Ambient gradient */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse at 70% 10%, ${tokens.brandGlow} 0%, transparent 50%),
              radial-gradient(ellipse at 20% 80%, rgba(139,92,246,0.05) 0%, transparent 50%)
            `,
          }}
        />

        {/* Grain texture */}
        <div
          className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative px-8 py-8 max-w-[1200px] mx-auto"
        >
          {/* Back Button */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-6"
          >
            <Link href="/talent-pool">
              <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Back to Talent Pool
              </Button>
            </Link>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Profile */}
            <div className="lg:col-span-1 space-y-6">
              {/* Profile Hero Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: easeOutCustom }}
              >
                <div
                  className="rounded-2xl p-6 overflow-hidden relative"
                  style={{
                    backgroundColor: tokens.bgCard,
                    border: `1px solid ${tokens.borderDefault}`,
                  }}
                >
                  {/* Gradient accent */}
                  <div
                    className="absolute top-0 left-0 right-0 h-24 opacity-50"
                    style={{
                      background: `linear-gradient(180deg, ${tokens.brandGlow} 0%, transparent 100%)`,
                    }}
                  />

                  <div className="relative">
                    {/* Avatar + Name */}
                    <div className="flex items-start gap-4 mb-6">
                      <UserAvatar name={person.name} size="xl" />
                      <div className="flex-1 min-w-0">
                        <h1
                          className="text-xl font-bold truncate"
                          style={{ color: tokens.textPrimary }}
                        >
                          {person.name}
                        </h1>
                        {person.headline && (
                          <p
                            className="text-sm mt-1"
                            style={{ color: tokens.textSecondary }}
                          >
                            {person.headline}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-3 mb-6">
                      {person.email && (
                        <a
                          href={`mailto:${person.email}`}
                          className="flex items-center gap-3 text-sm transition-colors hover:text-indigo-400"
                          style={{ color: tokens.textSecondary }}
                        >
                          <Mail className="w-4 h-4" style={{ color: tokens.textMuted }} />
                          {person.email}
                        </a>
                      )}
                      {person.phone && (
                        <div
                          className="flex items-center gap-3 text-sm"
                          style={{ color: tokens.textSecondary }}
                        >
                          <Phone className="w-4 h-4" style={{ color: tokens.textMuted }} />
                          {person.phone}
                        </div>
                      )}
                      {person.location && (
                        <div
                          className="flex items-center gap-3 text-sm"
                          style={{ color: tokens.textSecondary }}
                        >
                          <MapPin className="w-4 h-4" style={{ color: tokens.textMuted }} />
                          {person.location}
                        </div>
                      )}
                      {person.current_company && (
                        <div
                          className="flex items-center gap-3 text-sm"
                          style={{ color: tokens.textSecondary }}
                        >
                          <Building2 className="w-4 h-4" style={{ color: tokens.textMuted }} />
                          {person.current_title && `${person.current_title} at `}
                          {person.current_company}
                        </div>
                      )}
                      {person.years_experience && (
                        <div
                          className="flex items-center gap-3 text-sm"
                          style={{ color: tokens.textSecondary }}
                        >
                          <Clock className="w-4 h-4" style={{ color: tokens.textMuted }} />
                          {person.years_experience} years experience
                        </div>
                      )}
                    </div>

                    {/* Links */}
                    {(person.linkedin_url || person.resume_url) && (
                      <div
                        className="flex gap-3 pt-5"
                        style={{ borderTop: `1px solid ${tokens.borderSubtle}` }}
                      >
                        {person.linkedin_url && (
                          <a
                            href={person.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="secondary" size="sm" leftIcon={<ExternalLink className="w-3 h-3" />}>
                              LinkedIn
                            </Button>
                          </a>
                        )}
                        {person.resume_url && (
                          <a
                            href={person.resume_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="ghost" size="sm" leftIcon={<ExternalLink className="w-3 h-3" />}>
                              Resume
                            </Button>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Skills */}
              {person.skills && person.skills.length > 0 && (
                <SectionCard title="Skills" icon={Sparkles} delay={0.1}>
                  <div className="flex flex-wrap gap-2">
                    {person.skills.map((skill, index) => (
                      <motion.span
                        key={skill}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.15 + index * 0.02 }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{
                          backgroundColor: tokens.brandGlow,
                          color: tokens.brandPrimary,
                          border: `1px solid ${tokens.brandPrimary}30`,
                        }}
                      >
                        {skill}
                      </motion.span>
                    ))}
                  </div>
                </SectionCard>
              )}
            </div>

            {/* Right Column - Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Global Performance Section */}
              {totalApps > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1, ease: easeOutCustom }}
                >
                  <div
                    className="rounded-2xl p-6"
                    style={{
                      backgroundColor: tokens.bgCard,
                      border: `1px solid ${tokens.borderDefault}`,
                    }}
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: "rgba(16,185,129,0.15)" }}
                      >
                        <Activity className="w-4 h-4" style={{ color: tokens.statusSuccess }} />
                      </div>
                      <h3
                        className="text-sm font-semibold uppercase tracking-wide"
                        style={{ color: tokens.textMuted }}
                      >
                        Global Performance
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
                      {/* Score Rings */}
                      <div className="flex justify-center">
                        <ScoreRing score={avgScore} label="Average Score" />
                      </div>
                      <div className="flex justify-center">
                        <ScoreRing score={highScore} label="Highest Score" />
                      </div>
                      <div className="flex flex-col items-center justify-center">
                        <div
                          className="text-4xl font-bold tabular-nums"
                          style={{ color: tokens.textPrimary }}
                        >
                          {totalApps}
                        </div>
                        <span
                          className="text-xs font-medium mt-2"
                          style={{ color: tokens.textMuted }}
                        >
                          Total Applications
                        </span>
                      </div>
                    </div>

                    {/* Status Breakdown */}
                    {Object.keys(statusBreakdown).length > 0 && (
                      <div
                        className="pt-6"
                        style={{ borderTop: `1px solid ${tokens.borderSubtle}` }}
                      >
                        <h4
                          className="text-xs font-medium uppercase tracking-wide mb-4"
                          style={{ color: tokens.textMuted }}
                        >
                          Pipeline Distribution
                        </h4>
                        <StatusBreakdownBar breakdown={statusBreakdown} />
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Summary */}
              {person.summary && (
                <SectionCard title="About" icon={User} delay={0.15}>
                  <p
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    style={{ color: tokens.textSecondary }}
                  >
                    {person.summary}
                  </p>
                </SectionCard>
              )}

              {/* Work History */}
              {person.work_history && person.work_history.length > 0 && (
                <SectionCard title="Work Experience" icon={Briefcase} delay={0.2}>
                  <div className="space-y-4">
                    {person.work_history.map((job, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.25 + index * 0.05 }}
                        className="relative pl-5"
                        style={{
                          borderLeft: `2px solid ${job.is_current ? tokens.brandPrimary : tokens.borderDefault}`,
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4
                                className="font-medium"
                                style={{ color: tokens.textPrimary }}
                              >
                                {job.title || "Position"}
                              </h4>
                              {job.is_current && (
                                <span
                                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                  style={{
                                    backgroundColor: tokens.brandGlow,
                                    color: tokens.brandPrimary,
                                  }}
                                >
                                  Current
                                </span>
                              )}
                            </div>
                            <p
                              className="text-sm"
                              style={{ color: tokens.textSecondary }}
                            >
                              {job.company || "Company"}
                            </p>
                          </div>
                          {(job.start_date || job.end_date) && (
                            <span
                              className="text-xs shrink-0"
                              style={{ color: tokens.textMuted }}
                            >
                              {job.start_date || "?"} - {job.is_current ? "Present" : job.end_date || "?"}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Education */}
              {person.education && person.education.length > 0 && (
                <SectionCard title="Education" icon={GraduationCap} delay={0.25}>
                  <div className="space-y-4">
                    {person.education.map((edu, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + index * 0.05 }}
                        className="relative pl-5"
                        style={{
                          borderLeft: `2px solid ${tokens.borderDefault}`,
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4
                              className="font-medium"
                              style={{ color: tokens.textPrimary }}
                            >
                              {edu.school || "School"}
                            </h4>
                            <p
                              className="text-sm"
                              style={{ color: tokens.textSecondary }}
                            >
                              {edu.degree}
                              {edu.degree && edu.field_of_study && " in "}
                              {edu.field_of_study}
                            </p>
                          </div>
                          {(edu.start_date || edu.end_date) && (
                            <span
                              className="text-xs shrink-0"
                              style={{ color: tokens.textMuted }}
                            >
                              {edu.start_date || "?"} - {edu.end_date || "?"}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Job Applications */}
              {person.applications && person.applications.length > 0 && (
                <SectionCard title={`Job Applications (${person.applications.length})`} icon={Target} delay={0.3}>
                  <div className="space-y-3">
                    {person.applications.map((app, index) => {
                      const score = app.combined_score ?? app.ranking_score;
                      const statusConfig = getStatusConfig(app.interview_status || app.pipeline_status);

                      return (
                        <motion.div
                          key={app.candidate_id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.35 + index * 0.05 }}
                        >
                          <Link href={app.job_id ? `/jobs/${app.job_id}` : "#"}>
                            <div
                              className="flex items-center justify-between p-4 rounded-xl transition-all duration-200 cursor-pointer group"
                              style={{
                                backgroundColor: "rgba(255,255,255,0.02)",
                                border: `1px solid ${tokens.borderDefault}`,
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)";
                                e.currentTarget.style.borderColor = tokens.borderHover;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)";
                                e.currentTarget.style.borderColor = tokens.borderDefault;
                              }}
                            >
                              <div className="flex-1 min-w-0">
                                <h4
                                  className="font-medium truncate transition-colors group-hover:text-indigo-400"
                                  style={{ color: tokens.textPrimary }}
                                >
                                  {app.job_title || "Unknown Job"}
                                </h4>
                                <div className="flex items-center gap-3 mt-2">
                                  {/* Status Badge */}
                                  <span
                                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase"
                                    style={{
                                      backgroundColor: statusConfig.bg,
                                      color: statusConfig.color,
                                    }}
                                  >
                                    {(app.interview_status || app.pipeline_status || "pending").replace(/_/g, " ")}
                                  </span>
                                  {/* Score */}
                                  {score !== null && (
                                    <span
                                      className="flex items-center gap-1 text-xs"
                                      style={{ color: tokens.textMuted }}
                                    >
                                      <Star className="w-3 h-3" />
                                      {Math.round(score)}%
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Score Bar */}
                              {score !== null && (
                                <div className="w-24 ml-4">
                                  <div
                                    className="h-1.5 rounded-full overflow-hidden"
                                    style={{ backgroundColor: tokens.bgSurface }}
                                  >
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${Math.min(100, score)}%` }}
                                      transition={{ duration: 0.5, delay: 0.4 + index * 0.05 }}
                                      className="h-full rounded-full"
                                      style={{
                                        backgroundColor: score >= 80
                                          ? tokens.statusSuccess
                                          : score >= 60
                                            ? tokens.brandPrimary
                                            : score >= 40
                                              ? tokens.statusWarning
                                              : tokens.statusDanger,
                                      }}
                                    />
                                  </div>
                                </div>
                              )}

                              <ChevronRight
                                className="w-4 h-4 ml-3 flex-shrink-0 transition-transform group-hover:translate-x-1"
                                style={{ color: tokens.textMuted }}
                              />
                            </div>
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>
                </SectionCard>
              )}

              {/* Empty State */}
              {!person.summary &&
                (!person.work_history || person.work_history.length === 0) &&
                (!person.education || person.education.length === 0) &&
                (!person.applications || person.applications.length === 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="text-center py-16"
                  >
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                      style={{
                        backgroundColor: tokens.bgCard,
                        border: `1px solid ${tokens.borderDefault}`,
                      }}
                    >
                      <User className="w-8 h-8" style={{ color: tokens.textMuted }} />
                    </div>
                    <p style={{ color: tokens.textMuted }}>
                      No additional profile information available
                    </p>
                  </motion.div>
                )}
            </div>
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
