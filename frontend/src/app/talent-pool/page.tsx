"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users,
  Search,
  Filter,
  ChevronRight,
  MapPin,
  Building2,
  Briefcase,
  LogOut,
  LayoutDashboard,
  X,
  User,
} from "lucide-react";

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

interface FilterOptions {
  skills: string[];
  locations: string[];
  companies: string[];
  total_persons: number;
}

export default function TalentPoolPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, recruiter, logout, token } = useAuth();

  const [persons, setPersons] = useState<PersonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchFilterOptions();
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchPersons();
    }
  }, [isAuthenticated, token, page, searchQuery, selectedSkills, selectedLocation, selectedCompany]);

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
    setSearchQuery("");
    setPage(1);
  };

  const hasActiveFilters = selectedSkills.length > 0 || selectedLocation || selectedCompany || searchQuery;

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

  return (
    <main className="min-h-screen gradient-bg text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#000000]/80 backdrop-blur-md border-b border-white/5 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto px-6">
          <Link href="/jobs" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/10">
              <span className="text-sm">&#9883;</span>
            </div>
            <h1 className="text-lg font-light tracking-wide text-white">Briefing Room</h1>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
            <Link
              href="/jobs"
              className="flex items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <Briefcase className="w-4 h-4" />
              Jobs
            </Link>
            <Link
              href="/talent-pool"
              className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-white/10 rounded-lg"
            >
              <Users className="w-4 h-4" />
              Talent Pool
            </Link>
            {recruiter && (
              <span className="text-sm text-white/40 px-3 py-2 border-l border-white/10">
                {recruiter.name}
              </span>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="pt-28 px-6 pb-12 max-w-7xl mx-auto">
        {/* Page Title */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-light tracking-wide">Talent Pool</h2>
            <p className="text-white/50 text-sm mt-1">
              {filterOptions?.total_persons || total} people across all jobs
            </p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          {/* Search Bar */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-white/30 placeholder:text-white/30"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-colors ${
                showFilters || hasActiveFilters
                  ? "bg-white/10 border-white/30 text-white"
                  : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                  {selectedSkills.length + (selectedLocation ? 1 : 0) + (selectedCompany ? 1 : 0)}
                </span>
              )}
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && filterOptions && (
            <div className="glass-panel rounded-2xl p-6 space-y-6">
              {/* Active Filters */}
              {hasActiveFilters && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-white/50">Active filters:</span>
                  {selectedSkills.map((skill) => (
                    <button
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded-lg text-xs text-blue-400"
                    >
                      {skill}
                      <X className="w-3 h-3" />
                    </button>
                  ))}
                  {selectedLocation && (
                    <button
                      onClick={() => setSelectedLocation("")}
                      className="flex items-center gap-1 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded-lg text-xs text-green-400"
                    >
                      <MapPin className="w-3 h-3" />
                      {selectedLocation}
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {selectedCompany && (
                    <button
                      onClick={() => setSelectedCompany("")}
                      className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded-lg text-xs text-purple-400"
                    >
                      <Building2 className="w-3 h-3" />
                      {selectedCompany}
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={clearFilters}
                    className="text-xs text-white/40 hover:text-white/60 underline ml-2"
                  >
                    Clear all
                  </button>
                </div>
              )}

              {/* Location Filter */}
              <div>
                <label className="text-sm text-white/60 mb-2 block">Location</label>
                <select
                  value={selectedLocation}
                  onChange={(e) => {
                    setSelectedLocation(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/30"
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
                <label className="text-sm text-white/60 mb-2 block">Company</label>
                <select
                  value={selectedCompany}
                  onChange={(e) => {
                    setSelectedCompany(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/30"
                >
                  <option value="">All Companies</option>
                  {filterOptions.companies.map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                </select>
              </div>

              {/* Skills Filter */}
              <div>
                <label className="text-sm text-white/60 mb-2 block">Skills</label>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {filterOptions.skills.slice(0, 30).map((skill) => (
                    <button
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                        selectedSkills.includes(skill)
                          ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                          : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
                      }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        ) : persons.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-6">
              <Users className="w-8 h-8 text-white/20" />
            </div>
            <h3 className="text-xl font-light mb-2">No people found</h3>
            <p className="text-white/50 text-sm">
              {hasActiveFilters
                ? "Try adjusting your filters or search query"
                : "Upload candidates to jobs to populate the talent pool"}
            </p>
          </div>
        ) : (
          <>
            {/* Person Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {persons.map((person) => (
                <Link
                  key={person.id}
                  href={`/talent-pool/${person.id}`}
                  className="glass-panel rounded-2xl p-5 hover:bg-white/[0.08] transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-white/10 flex-shrink-0">
                      <User className="w-6 h-6 text-white/60" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white truncate group-hover:text-blue-400 transition-colors">
                        {person.name}
                      </h3>
                      {person.headline && (
                        <p className="text-sm text-white/50 truncate mt-0.5">{person.headline}</p>
                      )}
                      {(person.current_title || person.current_company) && (
                        <p className="text-xs text-white/40 truncate mt-1">
                          {person.current_title}
                          {person.current_title && person.current_company && " at "}
                          {person.current_company}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 flex-shrink-0" />
                  </div>

                  {/* Location and Applications */}
                  <div className="flex items-center gap-4 mt-4 text-xs text-white/40">
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
                        <span
                          key={skill}
                          className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] text-white/50"
                        >
                          {skill}
                        </span>
                      ))}
                      {person.skills.length > 4 && (
                        <span className="px-2 py-0.5 text-[10px] text-white/30">
                          +{person.skills.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-white/50 px-4">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
