"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import {
  ArrowLeft,
  User,
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
  TrendingUp,
  Award,
  Target,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { SkeletonCard } from "@/components/ui/skeleton";
import {
  tokens,
  springConfig,
  easeOutCustom,
  statCardVariants,
  getScoreColor,
  getStatusBadgeStyle,
  ambientGradient,
  grainTexture,
} from "@/lib/design-tokens";

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
  combined_score: number | null;
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
  applications: Application[];
}

// =============================================================================
// SCORE RING - Circular Progress for Score Display
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
  const shouldReduceMotion = useReducedMotion();
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = score !== null ? (score / 100) * circumference : 0;
  const color = getScoreColor(score);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background circle */}
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={tokens.borderSubtle}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {score !== null && (
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference - percentage }}
              transition={!shouldReduceMotion ? { duration: 1, ease: easeOutCustom } : { duration: 0 }}
            />
          )}
        </svg>
        {/* Score text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-xl font-bold tabular-nums"
            style={{ color: score !== null ? color : tokens.textMuted }}
          >
            {score !== null ? score : "—"}
          </span>
        </div>
      </div>
      {label && (
        <p className="text-xs mt-2" style={{ color: tokens.textMuted }}>
          {label}
        </p>
      )}
    </div>
  );
}

// =============================================================================
// STATUS BREAKDOWN BAR
// =============================================================================
function StatusBreakdownBar({ breakdown }: { breakdown: Record<string, number> }) {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const statusColors: Record<string, string> = {
    new: tokens.statusInfo,
    round_1: tokens.brandPrimary,
    round_2: tokens.brandSecondary,
    round_3: "#A78BFA",
    decision_pending: tokens.statusWarning,
    accepted: tokens.statusSuccess,
    rejected: tokens.statusDanger,
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs" style={{ color: tokens.textMuted }}>
        <span>Pipeline Distribution</span>
        <span>{total} applications</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden" style={{ backgroundColor: tokens.borderSubtle }}>
        {Object.entries(breakdown).map(([status, count]) => {
          const width = (count / total) * 100;
          if (width === 0) return null;
          return (
            <motion.div
              key={status}
              initial={{ width: 0 }}
              animate={{ width: `${width}%` }}
              transition={{ duration: 0.5, ease: easeOutCustom }}
              style={{ backgroundColor: statusColors[status] || tokens.textMuted }}
              title={`${status.replace(/_/g, " ")}: ${count}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {Object.entries(breakdown).map(([status, count]) => (
          <span
            key={status}
            className="flex items-center gap-1.5 text-[11px]"
            style={{ color: tokens.textSecondary }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: statusColors[status] || tokens.textMuted }}
            />
            {status.replace(/_/g, " ")}: {count}
          </span>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// GLOBAL PERFORMANCE SECTION
// =============================================================================
function GlobalPerformanceSection({ profile }: { profile: GlobalTalentProfile | null }) {
  if (!profile) {
    return (
      <div
        className="p-6 rounded-2xl"
        style={{
          backgroundColor: tokens.bgCard,
          border: `1px solid ${tokens.borderDefault}`,
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="p-2 rounded-xl"
            style={{ backgroundColor: tokens.brandGlow }}
          >
            <BarChart3 className="w-5 h-5" style={{ color: tokens.brandPrimary }} />
          </div>
          <h3 className="text-lg font-semibold" style={{ color: tokens.textPrimary }}>
            Global Performance
          </h3>
        </div>
        <p className="text-sm" style={{ color: tokens.textMuted }}>
          No interview data available yet.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: easeOutCustom }}
      className="p-6 rounded-2xl"
      style={{
        backgroundColor: tokens.bgCard,
        border: `1px solid ${tokens.borderDefault}`,
      }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div
          className="p-2 rounded-xl"
          style={{ backgroundColor: tokens.brandGlow }}
        >
          <BarChart3 className="w-5 h-5" style={{ color: tokens.brandPrimary }} />
        </div>
        <h3 className="text-lg font-semibold" style={{ color: tokens.textPrimary }}>
          Global Performance
        </h3>
      </div>

      {/* Score Rings */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <ScoreRing score={profile.average_score} label="Average" />
        <ScoreRing score={profile.highest_score} label="Highest" />
        <ScoreRing score={profile.lowest_score} label="Lowest" />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div
          className="p-4 rounded-xl text-center"
          style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
        >
          <p className="text-2xl font-bold tabular-nums" style={{ color: tokens.textPrimary }}>
            {profile.total_applications}
          </p>
          <p className="text-xs" style={{ color: tokens.textMuted }}>
            Total Applications
          </p>
        </div>
        <div
          className="p-4 rounded-xl text-center"
          style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
        >
          <p className="text-2xl font-bold tabular-nums" style={{ color: tokens.textPrimary }}>
            {Object.keys(profile.status_breakdown).length}
          </p>
          <p className="text-xs" style={{ color: tokens.textMuted }}>
            Pipeline Stages
          </p>
        </div>
      </div>

      {/* Status Breakdown */}
      <StatusBreakdownBar breakdown={profile.status_breakdown} />
    </motion.div>
  );
}

// =============================================================================
// APPLICATION CARD
// =============================================================================
function ApplicationCard({
  application,
  index,
}: {
  application: Application;
  index: number;
}) {
  const statusStyle = getStatusBadgeStyle(application.pipeline_status);
  const scoreColor = getScoreColor(application.combined_score);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: easeOutCustom }}
    >
      <Link href={application.job_id ? `/jobs/${application.job_id}` : "#"}>
        <motion.div
          whileHover={{ x: 4 }}
          transition={springConfig}
          className="flex items-center justify-between p-4 rounded-xl cursor-pointer group"
          style={{
            backgroundColor: "rgba(255,255,255,0.03)",
            border: `1px solid ${tokens.borderSubtle}`,
          }}
        >
          <div className="flex-1 min-w-0">
            <h4
              className="font-medium truncate group-hover:text-indigo-400 transition-colors"
              style={{ color: tokens.textPrimary }}
            >
              {application.job_title || "Unknown Job"}
            </h4>
            <div className="flex items-center gap-3 mt-1.5">
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{
                  backgroundColor: statusStyle.bg,
                  color: statusStyle.text,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: statusStyle.dot }}
                />
                {(application.pipeline_status || "new").replace(/_/g, " ")}
              </span>
              {application.combined_score !== null && (
                <span
                  className="flex items-center gap-1 text-xs font-medium"
                  style={{ color: scoreColor }}
                >
                  <Star className="w-3 h-3" />
                  {application.combined_score}%
                </span>
              )}
            </div>
          </div>

          {/* Score Bar */}
          {application.combined_score !== null && (
            <div className="w-24 mr-4">
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ backgroundColor: tokens.borderSubtle }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${application.combined_score}%` }}
                  transition={{ duration: 0.5, ease: easeOutCustom }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: scoreColor }}
                />
              </div>
            </div>
          )}

          <ChevronRight
            className="w-4 h-4 shrink-0 transition-all duration-200 group-hover:translate-x-1"
            style={{ color: tokens.textMuted }}
          />
        </motion.div>
      </Link>
    </motion.div>
  );
}

// =============================================================================
// SECTION CARD
// =============================================================================
function SectionCard({
  icon: Icon,
  title,
  children,
  delay = 0,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: easeOutCustom }}
      className="p-6 rounded-2xl"
      style={{
        backgroundColor: tokens.bgCard,
        border: `1px solid ${tokens.borderDefault}`,
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="p-2 rounded-xl"
          style={{ backgroundColor: tokens.brandGlow }}
        >
          <Icon className="w-4 h-4" style={{ color: tokens.brandPrimary }} />
        </div>
        <h3 className="text-sm font-medium" style={{ color: tokens.textSecondary }}>
          {title}
        </h3>
      </div>
      {children}
    </motion.div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================
export default function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();
  const shouldReduceMotion = useReducedMotion();

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
        router.push("/talent-pool");
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

  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <AppLayout>
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ backgroundColor: tokens.bgApp }}
        >
          <SkeletonCard />
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ backgroundColor: tokens.bgApp }}
        >
          <SkeletonCard />
        </div>
      </AppLayout>
    );
  }

  if (!person) {
    return (
      <AppLayout>
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ backgroundColor: tokens.bgApp }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <User className="w-16 h-16 mx-auto mb-4" style={{ color: tokens.textMuted }} />
            <p className="mb-4" style={{ color: tokens.textSecondary }}>Person not found</p>
            <Button variant="ghost" onClick={() => router.push("/talent-pool")}>
              Back to Talent Pool
            </Button>
          </motion.div>
        </div>
      </AppLayout>
    );
  }

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
          style={{ background: ambientGradient }}
        />

        {/* Grain texture */}
        <div
          className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30"
          style={{ backgroundImage: grainTexture }}
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
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Back to Talent Pool
              </Button>
            </Link>
          </motion.div>

          {/* Profile Hero Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOutCustom }}
            className="p-8 rounded-3xl mb-8"
            style={{
              backgroundColor: tokens.bgSurface,
              border: `1px solid ${tokens.borderDefault}`,
            }}
          >
            <div className="flex flex-col md:flex-row items-start gap-6">
              {/* Avatar */}
              <UserAvatar name={person.name} size="xl" />

              {/* Info */}
              <div className="flex-1">
                <h1
                  className="text-3xl font-bold tracking-tight mb-2"
                  style={{ color: tokens.textPrimary }}
                >
                  {person.name}
                </h1>
                {person.headline && (
                  <p className="text-lg mb-4" style={{ color: tokens.textSecondary }}>
                    {person.headline}
                  </p>
                )}

                {/* Contact Row */}
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  {person.email && (
                    <a
                      href={`mailto:${person.email}`}
                      className="flex items-center gap-2 text-sm transition-colors hover:text-indigo-400"
                      style={{ color: tokens.textSecondary }}
                    >
                      <Mail className="w-4 h-4" />
                      {person.email}
                    </a>
                  )}
                  {person.phone && (
                    <span
                      className="flex items-center gap-2 text-sm"
                      style={{ color: tokens.textSecondary }}
                    >
                      <Phone className="w-4 h-4" />
                      {person.phone}
                    </span>
                  )}
                  {person.location && (
                    <span
                      className="flex items-center gap-2 text-sm"
                      style={{ color: tokens.textSecondary }}
                    >
                      <MapPin className="w-4 h-4" />
                      {person.location}
                    </span>
                  )}
                </div>

                {/* Key Stats */}
                <div className="flex flex-wrap items-center gap-4">
                  {person.current_company && (
                    <span
                      className="flex items-center gap-2 text-sm"
                      style={{ color: tokens.textMuted }}
                    >
                      <Building2 className="w-4 h-4" />
                      {person.current_title && `${person.current_title} at `}
                      {person.current_company}
                    </span>
                  )}
                  {person.years_experience && (
                    <span
                      className="flex items-center gap-2 text-sm"
                      style={{ color: tokens.textMuted }}
                    >
                      <Clock className="w-4 h-4" />
                      {person.years_experience} years exp
                    </span>
                  )}
                  {person.applications.length > 0 && (
                    <span
                      className="flex items-center gap-2 text-sm"
                      style={{ color: tokens.textMuted }}
                    >
                      <Briefcase className="w-4 h-4" />
                      {person.applications.length} application{person.applications.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {/* Links */}
                {(person.linkedin_url || person.resume_url) && (
                  <div className="flex gap-3 mt-6">
                    {person.linkedin_url && (
                      <a
                        href={person.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={<ExternalLink className="w-3 h-3" />}
                        >
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
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<ExternalLink className="w-3 h-3" />}
                        >
                          Resume
                        </Button>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Global Performance */}
              <GlobalPerformanceSection profile={globalProfile} />

              {/* About */}
              {person.summary && (
                <SectionCard icon={User} title="About" delay={0.15}>
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
                <SectionCard icon={Briefcase} title="Work Experience" delay={0.2}>
                  <div className="space-y-4">
                    {person.work_history.map((job, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.25 + index * 0.05 }}
                        className="pl-4"
                        style={{
                          borderLeft: `2px solid ${job.is_current ? tokens.brandPrimary : tokens.borderSubtle}`,
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium" style={{ color: tokens.textPrimary }}>
                              {job.title || "Position"}
                              {job.is_current && (
                                <span
                                  className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-medium"
                                  style={{
                                    backgroundColor: tokens.brandGlow,
                                    color: tokens.brandPrimary,
                                  }}
                                >
                                  Current
                                </span>
                              )}
                            </h4>
                            <p className="text-sm" style={{ color: tokens.textSecondary }}>
                              {job.company || "Company"}
                            </p>
                          </div>
                          {(job.start_date || job.end_date) && (
                            <span className="text-xs" style={{ color: tokens.textMuted }}>
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
                <SectionCard icon={GraduationCap} title="Education" delay={0.25}>
                  <div className="space-y-4">
                    {person.education.map((edu, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + index * 0.05 }}
                        className="pl-4"
                        style={{ borderLeft: `2px solid ${tokens.borderSubtle}` }}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium" style={{ color: tokens.textPrimary }}>
                              {edu.school || "School"}
                            </h4>
                            <p className="text-sm" style={{ color: tokens.textSecondary }}>
                              {edu.degree}
                              {edu.degree && edu.field_of_study && " in "}
                              {edu.field_of_study}
                            </p>
                          </div>
                          {(edu.start_date || edu.end_date) && (
                            <span className="text-xs" style={{ color: tokens.textMuted }}>
                              {edu.start_date || "?"} - {edu.end_date || "?"}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </SectionCard>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Skills */}
              {person.skills && person.skills.length > 0 && (
                <SectionCard icon={Award} title="Skills" delay={0.15}>
                  <div className="flex flex-wrap gap-2">
                    {person.skills.map((skill, index) => (
                      <motion.span
                        key={skill}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 + index * 0.02 }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{
                          backgroundColor: tokens.brandGlow,
                          color: tokens.brandSecondary,
                          border: `1px solid ${tokens.brandPrimary}30`,
                        }}
                      >
                        {skill}
                      </motion.span>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Applications */}
              {person.applications && person.applications.length > 0 && (
                <SectionCard icon={Target} title={`Applications (${person.applications.length})`} delay={0.2}>
                  <div className="space-y-3">
                    {person.applications.map((app, index) => (
                      <ApplicationCard key={app.candidate_id} application={app} index={index} />
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Empty state */}
              {!person.summary &&
                (!person.work_history || person.work_history.length === 0) &&
                (!person.education || person.education.length === 0) &&
                (!person.skills || person.skills.length === 0) &&
                (!person.applications || person.applications.length === 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="p-8 rounded-2xl text-center"
                    style={{
                      backgroundColor: tokens.bgCard,
                      border: `1px solid ${tokens.borderDefault}`,
                    }}
                  >
                    <motion.div
                      animate={!shouldReduceMotion ? { y: [0, -4, 0] } : {}}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                      style={{ backgroundColor: tokens.brandGlow }}
                    >
                      <User className="w-8 h-8" style={{ color: tokens.brandPrimary }} />
                    </motion.div>
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
