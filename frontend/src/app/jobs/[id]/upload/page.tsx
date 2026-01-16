"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRecruiter } from "@/contexts/RecruiterContext";
import RecruiterSelector from "@/components/RecruiterSelector";
import {
  ArrowLeft,
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  Users,
  X,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Job {
  id: string;
  title: string;
  status: string;
}

export default function JobUploadPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetchJob();
  }, [resolvedParams.id]);

  const fetchJob = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/jobs/${resolvedParams.id}`);
      if (response.ok) {
        const data = await response.json();
        setJob(data);
      }
    } catch (error) {
      console.error("Failed to fetch job:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === "text/csv" || droppedFile?.name.endsWith(".csv")) {
      setFile(droppedFile);
      setError(null);
    } else {
      setError("Please upload a CSV file");
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === "text/csv" || selectedFile.name.endsWith(".csv")) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError("Please upload a CSV file");
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !job) return;

    try {
      setUploading(true);
      setError(null);
      setUploadProgress("Uploading file...");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("job_id", job.id);

      const response = await fetch(`${API_URL}/api/jobs/${job.id}/upload-candidates`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        setProcessedCount(result.candidates_created || result.count || 0);
        setSuccess(true);
        setUploadProgress("Processing complete!");
      } else {
        const err = await response.json();
        setError(err.detail || "Upload failed");
      }
    } catch (err) {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen gradient-bg text-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </main>
    );
  }

  if (!job) {
    return (
      <main className="min-h-screen gradient-bg text-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-white mb-2">Job Not Found</h2>
          <Link href="/jobs" className="text-indigo-400 hover:text-indigo-300">
            Back to Jobs
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen gradient-bg text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#000000]/80 backdrop-blur-md border-b border-white/5 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-4">
            <Link
              href={`/jobs/${resolvedParams.id}`}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white/60" />
            </Link>
            <div>
              <h1 className="text-lg font-light tracking-wide text-white">Upload Candidates</h1>
              <p className="text-xs text-white/50">{job.title}</p>
            </div>
          </div>

          <RecruiterSelector />
        </div>
      </header>

      <div className="pt-28 px-6 pb-12 max-w-2xl mx-auto">
        {success ? (
          <div className="glass-panel rounded-3xl p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">Upload Successful!</h3>
            <p className="text-white/50 mb-6">
              {processedCount} candidates have been added to <strong>{job.title}</strong>.
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => {
                  setSuccess(false);
                  setFile(null);
                  setProcessedCount(0);
                }}
                className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-medium transition-colors"
              >
                Upload More
              </button>
              <Link
                href={`/jobs/${resolvedParams.id}/candidates`}
                className="px-6 py-3 bg-white text-black rounded-xl font-medium hover:bg-gray-100 transition-colors"
              >
                View Candidates
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Error Alert */}
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`glass-panel rounded-3xl p-12 text-center border-2 border-dashed transition-all ${
                isDragging
                  ? "border-indigo-500 bg-indigo-500/10"
                  : file
                  ? "border-green-500/50 bg-green-500/5"
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              {file ? (
                <div className="flex items-center justify-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-green-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-white">{file.name}</p>
                    <p className="text-sm text-white/50">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-white/40" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center mx-auto mb-6">
                    <Upload className="w-8 h-8 text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-medium text-white mb-2">
                    Drop your CSV file here
                  </h3>
                  <p className="text-white/50 mb-6">or click to browse</p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-input"
                  />
                  <label
                    htmlFor="file-input"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-medium cursor-pointer transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Browse Files
                  </label>
                </>
              )}
            </div>

            {/* CSV Format Guide */}
            <div className="glass-panel rounded-2xl p-6">
              <h4 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4">
                CSV Format
              </h4>
              <p className="text-sm text-white/50 mb-4">
                Your CSV should include these columns:
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 bg-white/5 rounded-lg">
                  <code className="text-indigo-300">name</code>
                  <span className="text-white/40 ml-2">(required)</span>
                </div>
                <div className="p-2 bg-white/5 rounded-lg">
                  <code className="text-indigo-300">email</code>
                  <span className="text-white/40 ml-2">(optional)</span>
                </div>
                <div className="p-2 bg-white/5 rounded-lg">
                  <code className="text-indigo-300">linkedin_url</code>
                  <span className="text-white/40 ml-2">(optional)</span>
                </div>
                <div className="p-2 bg-white/5 rounded-lg">
                  <code className="text-indigo-300">resume_text</code>
                  <span className="text-white/40 ml-2">(optional)</span>
                </div>
              </div>
            </div>

            {/* Upload Button */}
            <div className="flex items-center justify-end gap-4">
              <Link
                href={`/jobs/${resolvedParams.id}`}
                className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-medium transition-colors"
              >
                Cancel
              </Link>
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {uploadProgress}
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4" />
                    Upload Candidates
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
