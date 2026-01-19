"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import {
  Users,
  Search,
  Filter,
  ChevronRight,
  MapPin,
  Building2,
  Briefcase,
  X,
  User,
  Star,
  GitBranch,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/avatar";
import { FadeInUp, Stagger, StaggerItem, Spinner } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface PersonSummary {
  id: string;
  name: string;
  email: string | null;
  headline: string | null;
  current_title: string | null;
  current_company: string | null;
  location: string | null;
  skills: string[];
  linkedin_url: string | null;
  application_count: number;
}

interface JobOption {
  id: string;
  title: string;
  candidate_count: number;
}

interface FilterOptions {
  skills: string[];
  locations: string[];
  companies: string[];
  jobs: JobOption[];
  tiers: string[];
  pipeline_statuses: string[];
  total_persons: number;
}

export default function TalentPoolPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();

  const [persons, setPersons] = useState<PersonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedJob, setSelectedJob] = useState<string>("");
  const [selectedTier, setSelectedTier] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchFilterOptions();
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchPersons();
    }
  }, [isAuthenticated, token, page, searchQuery, selectedSkills, selectedLocation, selectedCompany, selectedJob, selectedTier, selectedStatus]);

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };

  const fetchFilterOptions = async () => {
    try {
      const response = await fetch(`${API_URL}/api/talent-pool/filters`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setFilterOptions(data);
      }
    } catch (error) {
      console.error("Failed to fetch filter options:", error);
    }
  };

  const fetchPersons = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("page_size", "20");

      if (searchQuery) {
        params.append("query", searchQuery);
      }
      if (selectedSkills.length > 0) {
        params.append("skills", selectedSkills.join(","));
      }
      if (selectedLocation) {
        params.append("location", selectedLocation);
      }
      if (selectedCompany) {
        params.append("company", selectedCompany);
      }
      if (selectedJob) {
        params.append("job_id", selectedJob);
      }
      if (selectedTier) {
        params.append("tier", selectedTier);
      }
      if (selectedStatus) {
        params.append("pipeline_status", selectedStatus);
      }

      const response = await fetch(`${API_URL}/api/talent-pool?${params.toString()}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setPersons(data.persons);
        setTotalPages(data.total_pages);
        setTotal(data.total);
      } else if (response.status === 401) {
        router.push("/login");
      }
    } catch (error) {
      console.error("Failed to fetch persons:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
    setPage(1);
  };

  const clearFilters = () => {
    setSelectedSkills([]);
    setSelectedLocation("");
    setSelectedCompany("");
    setSelectedJob("");
    setSelectedTier("");
    setSelectedStatus("");
    setSearchQuery("");
    setPage(1);
  };

  const hasActiveFilters = selectedSkills.length > 0 || selectedLocation || selectedCompany || selectedJob || selectedTier || selectedStatus || searchQuery;

  const activeFilterCount = selectedSkills.length +
    (selectedLocation ? 1 : 0) +
    (selectedCompany ? 1 : 0) +
    (selectedJob ? 1 : 0) +
    (selectedTier ? 1 : 0) +
    (selectedStatus ? 1 : 0);

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-7xl mx-auto">
        {/* Page Title */}
        <FadeInUp>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-white tracking-tight">Talent Pool</h2>
              <p className="text-zinc-400 text-sm mt-1">
                {filterOptions?.total_persons || total} people across all jobs
              </p>
            </div>
          </div>
        </FadeInUp>

        {/* Search and Filters */}
        <FadeInUp delay={0.1}>
          <div className="mb-6 space-y-4">
            {/* Search Bar */}
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>
              <Button
                variant={showFilters || hasActiveFilters ? "secondary" : "ghost"}
                onClick={() => setShowFilters(!showFilters)}
                leftIcon={<Filter className="w-4 h-4" />}
              >
                Filters
                {hasActiveFilters && (
                  <span className="ml-2 px-2 py-0.5 bg-indigo-500/30 text-indigo-300 text-xs rounded-full">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </div>

            {/* Filter Panel */}
            <AnimatePresence>
              {showFilters && filterOptions && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card padding="lg" className="space-y-6">
                    {/* Active Filters */}
                    {hasActiveFilters && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-zinc-500">Active filters:</span>
                        {selectedSkills.map((skill) => (
                          <motion.button
                            key={skill}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            onClick={() => toggleSkill(skill)}
                            className="flex items-center gap-1 px-2 py-1 bg-indigo-500/20 border border-indigo-500/30 rounded-lg text-xs text-indigo-400 hover:bg-indigo-500/30 transition-colors"
                          >
                            {skill}
                            <X className="w-3 h-3" />
                          </motion.button>
                        ))}
                        {selectedLocation && (
                          <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onClick={() => setSelectedLocation("")}
                            className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-xs text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                          >
                            <MapPin className="w-3 h-3" />
                            {selectedLocation}
                            <X className="w-3 h-3" />
                          </motion.button>
                        )}
                        {selectedCompany && (
                          <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onClick={() => setSelectedCompany("")}
                            className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded-lg text-xs text-purple-400 hover:bg-purple-500/30 transition-colors"
                          >
                            <Building2 className="w-3 h-3" />
                            {selectedCompany}
                            <X className="w-3 h-3" />
                          </motion.button>
                        )}
                        {selectedJob && (
                          <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onClick={() => setSelectedJob("")}
                            className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 border border-amber-500/30 rounded-lg text-xs text-amber-400 hover:bg-amber-500/30 transition-colors"
                          >
                            <Briefcase className="w-3 h-3" />
                            {filterOptions.jobs.find(j => j.id === selectedJob)?.title || "Job"}
                            <X className="w-3 h-3" />
                          </motion.button>
                        )}
                        {selectedTier && (
                          <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onClick={() => setSelectedTier("")}
                            className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-xs text-yellow-400 hover:bg-yellow-500/30 transition-colors"
                          >
                            <Star className="w-3 h-3" />
                            {selectedTier}
                            <X className="w-3 h-3" />
                          </motion.button>
                        )}
                        {selectedStatus && (
                          <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onClick={() => setSelectedStatus("")}
                            className="flex items-center gap-1 px-2 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-xs text-cyan-400 hover:bg-cyan-500/30 transition-colors"
                          >
                            <GitBranch className="w-3 h-3" />
                            {selectedStatus.replace(/_/g, " ")}
                            <X className="w-3 h-3" />
                          </motion.button>
                        )}
                        <button
                          onClick={clearFilters}
                          className="text-xs text-zinc-500 hover:text-zinc-300 underline ml-2 transition-colors"
                        >
                          Clear all
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {/* Location Filter */}
                      <div>
                        <label className="text-sm text-zinc-400 mb-2 block">Location</label>
                        <select
                          value={selectedLocation}
                          onChange={(e) => {
                            setSelectedLocation(e.target.value);
                            setPage(1);
                          }}
                          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        >
                          <option value="">All Locations</option>
                          {filterOptions.locations.map((loc) => (
                            <option key={loc} value={loc}>
                              {loc}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Company Filter */}
                      <div>
                        <label className="text-sm text-zinc-400 mb-2 block">Company</label>
                        <select
                          value={selectedCompany}
                          onChange={(e) => {
                            setSelectedCompany(e.target.value);
                            setPage(1);
                          }}
                          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        >
                          <option value="">All Companies</option>
                          {filterOptions.companies.map((company) => (
                            <option key={company} value={company}>
                              {company}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Job Filter */}
                      {filterOptions.jobs && filterOptions.jobs.length > 0 && (
                        <div>
                          <label className="text-sm text-zinc-400 mb-2 block">Job Position</label>
                          <select
                            value={selectedJob}
                            onChange={(e) => {
                              setSelectedJob(e.target.value);
                              setPage(1);
                            }}
                            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                          >
                            <option value="">All Jobs</option>
                            {filterOptions.jobs.map((job) => (
                              <option key={job.id} value={job.id}>
                                {job.title} ({job.candidate_count})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Tier Filter */}
                      <div>
                        <label className="text-sm text-zinc-400 mb-2 block">Candidate Tier</label>
                        <select
                          value={selectedTier}
                          onChange={(e) => {
                            setSelectedTier(e.target.value);
                            setPage(1);
                          }}
                          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        >
                          <option value="">All Tiers</option>
                          {filterOptions.tiers.map((tier) => (
                            <option key={tier} value={tier}>
                              {tier}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Pipeline Status Filter */}
                      <div>
                        <label className="text-sm text-zinc-400 mb-2 block">Pipeline Status</label>
                        <select
                          value={selectedStatus}
                          onChange={(e) => {
                            setSelectedStatus(e.target.value);
                            setPage(1);
                          }}
                          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        >
                          <option value="">All Statuses</option>
                          {filterOptions.pipeline_statuses.map((status) => (
                            <option key={status} value={status}>
                              {status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Skills Filter */}
                    <div>
                      <label className="text-sm text-zinc-400 mb-2 block">Skills</label>
                      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                        {filterOptions.skills.slice(0, 30).map((skill) => (
                          <motion.button
                            key={skill}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => toggleSkill(skill)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs border transition-all",
                              selectedSkills.includes(skill)
                                ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-400"
                                : "bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:border-white/[0.12] hover:text-zinc-300"
                            )}
                          >
                            {skill}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </FadeInUp>

        {/* Results */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-20"
            >
              <Spinner size="lg" />
            </motion.div>
          ) : persons.length === 0 ? (
            <FadeInUp key="empty">
              <Card padding="xl" className="text-center">
                <motion.div
                  className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center mx-auto mb-6 border border-white/5"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Users className="w-10 h-10 text-indigo-400" />
                </motion.div>
                <h3 className="text-xl font-semibold text-white mb-2">No people found</h3>
                <p className="text-zinc-500 text-sm">
                  {hasActiveFilters
                    ? "Try adjusting your filters or search query"
                    : "Upload candidates to jobs to populate the talent pool"}
                </p>
              </Card>
            </FadeInUp>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Person Cards */}
              <Stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {persons.map((person) => (
                  <StaggerItem key={person.id}>
                    <Link href={`/talent-pool/${person.id}`}>
                      <motion.div
                        whileHover={{ y: -4, scale: 1.01 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                      >
                        <Card
                          padding="md"
                          className="h-full group cursor-pointer"
                        >
                          <div className="flex items-start gap-4">
                            <UserAvatar name={person.name} size="lg" />
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-white truncate group-hover:text-indigo-400 transition-colors">
                                {person.name}
                              </h3>
                              {person.headline && (
                                <p className="text-sm text-zinc-500 truncate mt-0.5">{person.headline}</p>
                              )}
                              {(person.current_title || person.current_company) && (
                                <p className="text-xs text-zinc-600 truncate mt-1">
                                  {person.current_title}
                                  {person.current_title && person.current_company && " at "}
                                  {person.current_company}
                                </p>
                              )}
                            </div>
                            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 flex-shrink-0 transition-colors" />
                          </div>

                          {/* Location and Applications */}
                          <div className="flex items-center gap-4 mt-4 text-xs text-zinc-500">
                            {person.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {person.location}
                              </span>
                            )}
                            {person.application_count > 0 && (
                              <span className="flex items-center gap-1">
                                <Briefcase className="w-3 h-3" />
                                {person.application_count} application{person.application_count !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>

                          {/* Skills */}
                          {person.skills && person.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-3">
                              {person.skills.slice(0, 4).map((skill) => (
                                <Badge key={skill} variant="secondary" size="sm">
                                  {skill}
                                </Badge>
                              ))}
                              {person.skills.length > 4 && (
                                <span className="px-2 py-0.5 text-[10px] text-zinc-500">
                                  +{person.skills.length - 4} more
                                </span>
                              )}
                            </div>
                          )}
                        </Card>
                      </motion.div>
                    </Link>
                  </StaggerItem>
                ))}
              </Stagger>

              {/* Pagination */}
              {totalPages > 1 && (
                <FadeInUp delay={0.2} className="flex items-center justify-center gap-2 mt-8">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-zinc-500 px-4">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </FadeInUp>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
