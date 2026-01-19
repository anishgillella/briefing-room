"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
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
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/avatar";
import { FadeInUp, Stagger, StaggerItem, Spinner } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

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

export default function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();

  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchPerson();
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

  const getStatusVariant = (status: string | null): "default" | "success" | "warning" | "error" | "info" => {
    switch (status) {
      case "completed":
        return "success";
      case "in_progress":
        return "info";
      case "pending":
        return "warning";
      case "rejected":
        return "error";
      default:
        return "default";
    }
  };

  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <main className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Spinner size="lg" />
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <Spinner size="lg" />
      </main>
    );
  }

  if (!person) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <FadeInUp>
          <Card padding="lg" className="text-center">
            <User className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400">Person not found</p>
            <Button
              variant="ghost"
              className="mt-4"
              onClick={() => router.push("/talent-pool")}
            >
              Back to Talent Pool
            </Button>
          </Card>
        </FadeInUp>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-white/[0.06] py-4">
        <div className="flex items-center gap-4 max-w-5xl mx-auto px-6">
          <motion.div whileHover={{ x: -2 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="/talent-pool"
              className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center hover:bg-white/[0.08] transition-colors border border-white/[0.06]"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </Link>
          </motion.div>
          <div>
            <h1 className="text-lg font-medium text-white">{person.name}</h1>
            <p className="text-xs text-zinc-500">{person.headline || person.current_title || "Profile"}</p>
          </div>
        </div>
      </header>

      <div className="pt-28 px-6 pb-12 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Profile Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Profile Card */}
            <FadeInUp>
              <Card padding="lg">
                <div className="flex items-center gap-4 mb-6">
                  <UserAvatar name={person.name} size="xl" />
                  <div>
                    <h2 className="text-xl font-semibold text-white">{person.name}</h2>
                    {person.headline && (
                      <p className="text-sm text-zinc-400 mt-1">{person.headline}</p>
                    )}
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-3">
                  {person.email && (
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="w-4 h-4 text-zinc-500" />
                      <a href={`mailto:${person.email}`} className="text-zinc-300 hover:text-indigo-400 transition-colors">
                        {person.email}
                      </a>
                    </div>
                  )}
                  {person.phone && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="w-4 h-4 text-zinc-500" />
                      <span className="text-zinc-300">{person.phone}</span>
                    </div>
                  )}
                  {person.location && (
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="w-4 h-4 text-zinc-500" />
                      <span className="text-zinc-300">{person.location}</span>
                    </div>
                  )}
                  {person.current_company && (
                    <div className="flex items-center gap-3 text-sm">
                      <Building2 className="w-4 h-4 text-zinc-500" />
                      <span className="text-zinc-300">
                        {person.current_title && `${person.current_title} at `}
                        {person.current_company}
                      </span>
                    </div>
                  )}
                  {person.years_experience && (
                    <div className="flex items-center gap-3 text-sm">
                      <Clock className="w-4 h-4 text-zinc-500" />
                      <span className="text-zinc-300">{person.years_experience} years experience</span>
                    </div>
                  )}
                </div>

                {/* Links */}
                {(person.linkedin_url || person.resume_url) && (
                  <div className="flex gap-3 mt-6 pt-6 border-t border-white/[0.06]">
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
              </Card>
            </FadeInUp>

            {/* Skills */}
            {person.skills && person.skills.length > 0 && (
              <FadeInUp delay={0.1}>
                <Card padding="lg">
                  <h3 className="text-sm font-medium text-zinc-400 mb-4">Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {person.skills.map((skill, index) => (
                      <motion.div
                        key={skill}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.03 }}
                      >
                        <Badge variant="secondary">{skill}</Badge>
                      </motion.div>
                    ))}
                  </div>
                </Card>
              </FadeInUp>
            )}
          </div>

          {/* Right Column - Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Summary */}
            {person.summary && (
              <FadeInUp delay={0.15}>
                <Card padding="lg">
                  <h3 className="text-sm font-medium text-zinc-400 mb-4">About</h3>
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                    {person.summary}
                  </p>
                </Card>
              </FadeInUp>
            )}

            {/* Work History */}
            {person.work_history && person.work_history.length > 0 && (
              <FadeInUp delay={0.2}>
                <Card padding="lg">
                  <h3 className="text-sm font-medium text-zinc-400 mb-4 flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    Work Experience
                  </h3>
                  <Stagger className="space-y-4">
                    {person.work_history.map((job, index) => (
                      <StaggerItem key={index}>
                        <div
                          className={cn(
                            "pl-4 border-l-2 transition-colors",
                            job.is_current ? "border-indigo-500" : "border-white/[0.08]"
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium text-white">
                                {job.title || "Position"}
                                {job.is_current && (
                                  <Badge variant="info" size="sm" className="ml-2">Current</Badge>
                                )}
                              </h4>
                              <p className="text-sm text-zinc-400">{job.company || "Company"}</p>
                            </div>
                            {(job.start_date || job.end_date) && (
                              <span className="text-xs text-zinc-500">
                                {job.start_date || "?"} - {job.is_current ? "Present" : job.end_date || "?"}
                              </span>
                            )}
                          </div>
                        </div>
                      </StaggerItem>
                    ))}
                  </Stagger>
                </Card>
              </FadeInUp>
            )}

            {/* Education */}
            {person.education && person.education.length > 0 && (
              <FadeInUp delay={0.25}>
                <Card padding="lg">
                  <h3 className="text-sm font-medium text-zinc-400 mb-4 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4" />
                    Education
                  </h3>
                  <Stagger className="space-y-4">
                    {person.education.map((edu, index) => (
                      <StaggerItem key={index}>
                        <div className="pl-4 border-l-2 border-white/[0.08]">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium text-white">{edu.school || "School"}</h4>
                              <p className="text-sm text-zinc-400">
                                {edu.degree}
                                {edu.degree && edu.field_of_study && " in "}
                                {edu.field_of_study}
                              </p>
                            </div>
                            {(edu.start_date || edu.end_date) && (
                              <span className="text-xs text-zinc-500">
                                {edu.start_date || "?"} - {edu.end_date || "?"}
                              </span>
                            )}
                          </div>
                        </div>
                      </StaggerItem>
                    ))}
                  </Stagger>
                </Card>
              </FadeInUp>
            )}

            {/* Job Applications */}
            {person.applications && person.applications.length > 0 && (
              <FadeInUp delay={0.3}>
                <Card padding="lg">
                  <h3 className="text-sm font-medium text-zinc-400 mb-4">
                    Job Applications ({person.applications.length})
                  </h3>
                  <Stagger className="space-y-3">
                    {person.applications.map((app) => (
                      <StaggerItem key={app.candidate_id}>
                        <Link
                          href={app.job_id ? `/jobs/${app.job_id}` : "#"}
                        >
                          <motion.div
                            className="flex items-center justify-between p-4 bg-white/[0.03] rounded-xl border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all group cursor-pointer"
                            whileHover={{ x: 4 }}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                          >
                            <div>
                              <h4 className="font-medium text-white group-hover:text-indigo-400 transition-colors">
                                {app.job_title || "Unknown Job"}
                              </h4>
                              <div className="flex items-center gap-3 mt-1">
                                <StatusBadge
                                  status={(app.interview_status || "pending").replace("_", " ")}
                                  variant={getStatusVariant(app.interview_status)}
                                  size="sm"
                                />
                                {app.ranking_score && (
                                  <span className="flex items-center gap-1 text-xs text-zinc-500">
                                    <Star className="w-3 h-3" />
                                    {app.ranking_score}%
                                  </span>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                          </motion.div>
                        </Link>
                      </StaggerItem>
                    ))}
                  </Stagger>
                </Card>
              </FadeInUp>
            )}

            {/* Empty state if no work history, education, or applications */}
            {!person.summary &&
              (!person.work_history || person.work_history.length === 0) &&
              (!person.education || person.education.length === 0) &&
              (!person.applications || person.applications.length === 0) && (
                <FadeInUp delay={0.15}>
                  <Card padding="xl" className="text-center">
                    <motion.div
                      className="w-16 h-16 rounded-2xl bg-gradient-to-br from-zinc-500/10 to-zinc-600/10 flex items-center justify-center mx-auto mb-4 border border-white/5"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <User className="w-8 h-8 text-zinc-500" />
                    </motion.div>
                    <p className="text-zinc-500">No additional profile information available</p>
                  </Card>
                </FadeInUp>
              )}
          </div>
        </div>
      </div>
    </main>
  );
}
