"use client";

import { useState } from "react";
import { useRecruiter } from "@/contexts/RecruiterContext";
import { ChevronDown, User, Plus, Check, Briefcase } from "lucide-react";

interface RecruiterSelectorProps {
  showJobCount?: boolean;
  className?: string;
}

export default function RecruiterSelector({ showJobCount = true, className = "" }: RecruiterSelectorProps) {
  const { currentRecruiter, recruiters, loading, setCurrentRecruiter, createRecruiter } = useRecruiter();
  const [isOpen, setIsOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newName.trim() || !newEmail.trim()) {
      setError("Name and email are required");
      return;
    }

    try {
      setCreating(true);
      setError(null);
      const recruiter = await createRecruiter(newName.trim(), newEmail.trim().toLowerCase());
      setCurrentRecruiter(recruiter);
      setShowCreate(false);
      setNewName("");
      setNewEmail("");
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create recruiter");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10 ${className}`}>
        <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        <span className="text-sm text-white/50">Loading...</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors min-w-[200px]"
      >
        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
          <User className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="flex-1 text-left">
          {currentRecruiter ? (
            <>
              <div className="text-sm font-medium text-white">{currentRecruiter.name}</div>
              {showJobCount && (
                <div className="text-xs text-white/50 flex items-center gap-1">
                  <Briefcase className="w-3 h-3" />
                  {currentRecruiter.active_job_count || 0} active jobs
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-white/50">Select Recruiter</div>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Menu */}
          <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#1a1a20] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
            {/* Recruiter List */}
            <div className="max-h-64 overflow-y-auto">
              {recruiters.length === 0 ? (
                <div className="p-4 text-center text-white/40 text-sm">
                  No recruiters yet. Create one below.
                </div>
              ) : (
                recruiters.map((recruiter) => (
                  <button
                    key={recruiter.id}
                    onClick={() => {
                      setCurrentRecruiter(recruiter);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60">
                      {recruiter.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">{recruiter.name}</div>
                      <div className="text-xs text-white/40">{recruiter.email}</div>
                    </div>
                    {showJobCount && (
                      <div className="text-xs text-white/40">
                        {recruiter.active_job_count || 0} jobs
                      </div>
                    )}
                    {currentRecruiter?.id === recruiter.id && (
                      <Check className="w-4 h-4 text-green-400" />
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-white/10" />

            {/* Create New */}
            {showCreate ? (
              <div className="p-4 space-y-3">
                <div className="text-xs font-medium text-white/60 uppercase tracking-wider">
                  Create New Recruiter
                </div>
                <input
                  type="text"
                  placeholder="Name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50"
                />
                {error && (
                  <div className="text-xs text-red-400">{error}</div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowCreate(false);
                      setNewName("");
                      setNewEmail("");
                      setError(null);
                    }}
                    className="flex-1 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white/60 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={creating}
                    className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-50"
                  >
                    {creating ? "Creating..." : "Create"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-sm text-indigo-400">Add New Recruiter</div>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
