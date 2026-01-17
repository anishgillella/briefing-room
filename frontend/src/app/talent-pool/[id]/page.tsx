"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

  // Redirect to login if not authenticated
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

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "completed":
        return "bg-green-500/10 border-green-500/30 text-green-400";
      case "in_progress":
        return "bg-blue-500/10 border-blue-500/30 text-blue-400";
      case "pending":
        return "bg-yellow-500/10 border-yellow-500/30 text-yellow-400";
      case "rejected":
        return "bg-red-500/10 border-red-500/30 text-red-400";
      default:
        return "bg-gray-500/10 border-gray-500/30 text-gray-400";
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <main className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </main>
    );
  }

  // Don't render for unauthenticated users
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen gradient-bg text-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </main>
    );
  }

  if (!person) {
    return (
      <main className="min-h-screen gradient-bg text-white flex items-center justify-center">
        <p className="text-white/50">Person not found</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen gradient-bg text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#000000]/80 backdrop-blur-md border-b border-white/5 py-4">
        <div className="flex items-center gap-4 max-w-5xl mx-auto px-6">
          <Link
            href="/talent-pool"
            className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white/60" />
          </Link>
          <div>
            <h1 className="text-lg font-light tracking-wide text-white">{person.name}</h1>
            <p className="text-xs text-white/50">{person.headline || person.current_title || "Profile"}</p>
          </div>
        </div>
      </header>

      <div className="pt-28 px-6 pb-12 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Profile Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Profile Card */}
            <div className="glass-panel rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-white/10">
                  <User className="w-8 h-8 text-white/60" />
                </div>
                <div>
                  <h2 className="text-xl font-light">{person.name}</h2>
                  {person.headline && (
                    <p className="text-sm text-white/50 mt-1">{person.headline}</p>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-3">
                {person.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="w-4 h-4 text-white/40" />
                    <a href={`mailto:${person.email}`} className="text-white/70 hover:text-white">
                      {person.email}
                    </a>
                  </div>
                )}
                {person.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="w-4 h-4 text-white/40" />
                    <span className="text-white/70">{person.phone}</span>
                  </div>
                )}
                {person.location && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-white/40" />
                    <span className="text-white/70">{person.location}</span>
                  </div>
                )}
                {person.current_company && (
                  <div className="flex items-center gap-3 text-sm">
                    <Building2 className="w-4 h-4 text-white/40" />
                    <span className="text-white/70">
                      {person.current_title && `${person.current_title} at `}
                      {person.current_company}
                    </span>
                  </div>
                )}
                {person.years_experience && (
                  <div className="flex items-center gap-3 text-sm">
                    <Clock className="w-4 h-4 text-white/40" />
                    <span className="text-white/70">{person.years_experience} years experience</span>
                  </div>
                )}
              </div>

              {/* Links */}
              {(person.linkedin_url || person.resume_url) && (
                <div className="flex gap-3 mt-6 pt-6 border-t border-white/10">
                  {person.linkedin_url && (
                    <a
                      href={person.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm text-blue-400 hover:bg-blue-500/20 transition-colors"
                    >
                      LinkedIn
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {person.resume_url && (
                    <a
                      href={person.resume_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/60 hover:bg-white/10 transition-colors"
                    >
                      Resume
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Skills */}
            {person.skills && person.skills.length > 0 && (
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="text-sm font-medium text-white/60 mb-4">Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {person.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white/70"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Summary */}
            {person.summary && (
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="text-sm font-medium text-white/60 mb-4">About</h3>
                <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">
                  {person.summary}
                </p>
              </div>
            )}

            {/* Work History */}
            {person.work_history && person.work_history.length > 0 && (
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="text-sm font-medium text-white/60 mb-4 flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  Work Experience
                </h3>
                <div className="space-y-4">
                  {person.work_history.map((job, index) => (
                    <div
                      key={index}
                      className={`pl-4 border-l-2 ${
                        job.is_current ? "border-blue-500/50" : "border-white/10"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-white">
                            {job.title || "Position"}
                            {job.is_current && (
                              <span className="ml-2 text-xs text-blue-400">(Current)</span>
                            )}
                          </h4>
                          <p className="text-sm text-white/60">{job.company || "Company"}</p>
                        </div>
                        {(job.start_date || job.end_date) && (
                          <span className="text-xs text-white/40">
                            {job.start_date || "?"} - {job.is_current ? "Present" : job.end_date || "?"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Education */}
            {person.education && person.education.length > 0 && (
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="text-sm font-medium text-white/60 mb-4 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" />
                  Education
                </h3>
                <div className="space-y-4">
                  {person.education.map((edu, index) => (
                    <div key={index} className="pl-4 border-l-2 border-white/10">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-white">{edu.school || "School"}</h4>
                          <p className="text-sm text-white/60">
                            {edu.degree}
                            {edu.degree && edu.field_of_study && " in "}
                            {edu.field_of_study}
                          </p>
                        </div>
                        {(edu.start_date || edu.end_date) && (
                          <span className="text-xs text-white/40">
                            {edu.start_date || "?"} - {edu.end_date || "?"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Job Applications */}
            {person.applications && person.applications.length > 0 && (
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="text-sm font-medium text-white/60 mb-4">
                  Job Applications ({person.applications.length})
                </h3>
                <div className="space-y-3">
                  {person.applications.map((app) => (
                    <Link
                      key={app.candidate_id}
                      href={app.job_id ? `/jobs/${app.job_id}` : "#"}
                      className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors group"
                    >
                      <div>
                        <h4 className="font-medium text-white group-hover:text-blue-400 transition-colors">
                          {app.job_title || "Unknown Job"}
                        </h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusColor(
                              app.interview_status
                            )}`}
                          >
                            {(app.interview_status || "pending").replace("_", " ")}
                          </span>
                          {app.ranking_score && (
                            <span className="flex items-center gap-1 text-xs text-white/40">
                              <Star className="w-3 h-3" />
                              {app.ranking_score}%
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state if no work history, education, or applications */}
            {!person.summary &&
              (!person.work_history || person.work_history.length === 0) &&
              (!person.education || person.education.length === 0) &&
              (!person.applications || person.applications.length === 0) && (
                <div className="glass-panel rounded-2xl p-12 text-center">
                  <p className="text-white/40">No additional profile information available</p>
                </div>
              )}
          </div>
        </div>
      </div>
    </main>
  );
}
