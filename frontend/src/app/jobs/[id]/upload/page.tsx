"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { tokens, springConfig, easeOutCustom } from "@/lib/design-tokens";
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
  const { isAuthenticated, isLoading: authLoading, token } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchJob();
    }
  }, [resolvedParams.id, isAuthenticated, token]);

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };

  const fetchJob = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/jobs/${resolvedParams.id}`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setJob(data);
      } else if (response.status === 401) {
        router.push("/login");
        return;
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

      const response = await fetch(`${API_URL}/api/jobs/${job.id}/candidates/upload`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        setProcessedCount(result.created || result.total_processed || 0);
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

  // Show loading while checking auth
  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!job) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-white mb-2">Job Not Found</h2>
            <Link href="/jobs" className="text-indigo-400 hover:text-indigo-300">
              Back to Jobs
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-2xl mx-auto">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: easeOutCustom }}
          className="flex items-center gap-4 mb-8"
        >
          <Link
            href={`/jobs/${resolvedParams.id}`}
            className="p-2 rounded-xl transition-all duration-200"
            style={{
              backgroundColor: tokens.bgSurface,
              border: `1px solid ${tokens.borderSubtle}`,
            }}
          >
            <ArrowLeft className="w-5 h-5" style={{ color: tokens.textMuted }} />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: tokens.textPrimary }}>Upload Candidates</h1>
            <p className="text-sm" style={{ color: tokens.textMuted }}>{job.title}</p>
          </div>
        </motion.div>

        {success ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: easeOutCustom }}
            className="rounded-3xl p-12 text-center"
            style={{
              backgroundColor: tokens.bgSurface,
              border: `1px solid ${tokens.statusSuccess}30`,
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: tokens.statusSuccessBg }}
            >
              <CheckCircle className="w-8 h-8" style={{ color: tokens.statusSuccess }} />
            </div>
            <h3 className="text-xl font-medium mb-2" style={{ color: tokens.textPrimary }}>Upload Successful!</h3>
            <p className="mb-6" style={{ color: tokens.textMuted }}>
              {processedCount} candidates have been added to <strong style={{ color: tokens.textSecondary }}>{job.title}</strong>.
            </p>
            <div className="flex items-center justify-center gap-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setSuccess(false);
                  setFile(null);
                  setProcessedCount(0);
                }}
                className="px-6 py-3 rounded-xl font-medium transition-colors"
                style={{
                  backgroundColor: tokens.bgCard,
                  border: `1px solid ${tokens.borderDefault}`,
                  color: tokens.textSecondary,
                }}
              >
                Upload More
              </motion.button>
              <Link
                href={`/jobs/${resolvedParams.id}/candidates`}
                className="px-6 py-3 rounded-xl font-medium transition-colors text-white"
                style={{
                  background: tokens.gradientPrimary,
                }}
              >
                View Candidates
              </Link>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {/* Error Alert */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-4 rounded-xl"
                style={{
                  backgroundColor: tokens.statusDangerBg,
                  border: `1px solid ${tokens.statusDanger}30`,
                }}
              >
                <AlertCircle className="w-5 h-5 shrink-0" style={{ color: tokens.statusDanger }} />
                <p className="text-sm" style={{ color: tokens.statusDanger }}>{error}</p>
              </motion.div>
            )}

            {/* Drop Zone */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1, ease: easeOutCustom }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="rounded-3xl p-12 text-center border-2 border-dashed transition-all cursor-pointer"
              style={{
                backgroundColor: isDragging
                  ? `${tokens.brandPrimary}10`
                  : file
                  ? `${tokens.statusSuccess}08`
                  : tokens.bgSurface,
                borderColor: isDragging
                  ? tokens.brandPrimary
                  : file
                  ? `${tokens.statusSuccess}50`
                  : tokens.borderDefault,
              }}
            >
              {file ? (
                <div className="flex items-center justify-center gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: tokens.statusSuccessBg }}
                  >
                    <FileText className="w-6 h-6" style={{ color: tokens.statusSuccess }} />
                  </div>
                  <div className="text-left">
                    <p className="font-medium" style={{ color: tokens.textPrimary }}>{file.name}</p>
                    <p className="text-sm" style={{ color: tokens.textMuted }}>
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="p-2 rounded-lg transition-colors"
                    style={{ backgroundColor: tokens.bgCard }}
                  >
                    <X className="w-5 h-5" style={{ color: tokens.textMuted }} />
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                    style={{ backgroundColor: tokens.brandGlow }}
                  >
                    <Upload className="w-8 h-8" style={{ color: tokens.brandPrimary }} />
                  </div>
                  <h3 className="text-xl font-medium mb-2" style={{ color: tokens.textPrimary }}>
                    Drop your CSV file here
                  </h3>
                  <p className="mb-6" style={{ color: tokens.textMuted }}>or click to browse</p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-input"
                  />
                  <label
                    htmlFor="file-input"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium cursor-pointer transition-colors"
                    style={{
                      backgroundColor: tokens.bgCard,
                      border: `1px solid ${tokens.borderDefault}`,
                      color: tokens.textSecondary,
                    }}
                  >
                    <FileText className="w-4 h-4" />
                    Browse Files
                  </label>
                </>
              )}
            </motion.div>

            {/* CSV Format Guide */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2, ease: easeOutCustom }}
              className="rounded-2xl p-6"
              style={{
                backgroundColor: tokens.bgSurface,
                border: `1px solid ${tokens.borderDefault}`,
              }}
            >
              <h4 className="text-sm font-medium uppercase tracking-wider mb-4" style={{ color: tokens.textMuted }}>
                CSV Format
              </h4>
              <p className="text-sm mb-4" style={{ color: tokens.textMuted }}>
                Your CSV should include these columns:
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: tokens.bgCard }}
                >
                  <code style={{ color: tokens.brandSecondary }}>name</code>
                  <span className="ml-2" style={{ color: tokens.textMuted }}>(required)</span>
                </div>
                <div
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: tokens.bgCard }}
                >
                  <code style={{ color: tokens.brandSecondary }}>email</code>
                  <span className="ml-2" style={{ color: tokens.textMuted }}>(optional)</span>
                </div>
                <div
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: tokens.bgCard }}
                >
                  <code style={{ color: tokens.brandSecondary }}>linkedin_url</code>
                  <span className="ml-2" style={{ color: tokens.textMuted }}>(optional)</span>
                </div>
                <div
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: tokens.bgCard }}
                >
                  <code style={{ color: tokens.brandSecondary }}>resume_text</code>
                  <span className="ml-2" style={{ color: tokens.textMuted }}>(optional)</span>
                </div>
              </div>
            </motion.div>

            {/* Upload Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3, ease: easeOutCustom }}
              className="flex items-center justify-end gap-4"
            >
              <Link
                href={`/jobs/${resolvedParams.id}`}
                className="px-6 py-3 rounded-xl font-medium transition-colors"
                style={{
                  backgroundColor: tokens.bgCard,
                  border: `1px solid ${tokens.borderDefault}`,
                  color: tokens.textSecondary,
                }}
              >
                Cancel
              </Link>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleUpload}
                disabled={!file || uploading}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: file && !uploading ? tokens.gradientPrimary : tokens.bgCard,
                  color: file && !uploading ? "#fff" : tokens.textMuted,
                  border: file && !uploading ? "none" : `1px solid ${tokens.borderDefault}`,
                }}
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
              </motion.button>
            </motion.div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
