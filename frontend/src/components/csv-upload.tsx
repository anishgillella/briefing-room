"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { uploadCandidatesCsv, getProcessingStatus } from "@/lib/api";
import { ProcessingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CsvUploadProps {
    onUploadComplete?: () => void;
    onProcessingStart?: () => void;
}

export default function CsvUpload({ onUploadComplete, onProcessingStart }: CsvUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [status, setStatus] = useState<ProcessingStatus | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

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

        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.csv')) {
            setSelectedFile(file);
            setError(null);
        } else {
            setError("Please upload a CSV file");
        }
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.name.endsWith('.csv')) {
                setSelectedFile(file);
                setError(null);
            } else {
                setError("Please upload a CSV file");
            }
        }
    };

    const pollStatus = useCallback(async () => {
        try {
            const processingStatus = await getProcessingStatus();
            setStatus(processingStatus);

            if (processingStatus.status === "complete") {
                // Stop polling
                if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                }
                onUploadComplete?.();
            } else if (processingStatus.status === "error") {
                if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                }
                setError(processingStatus.error || "Processing failed");
            }
        } catch (err) {
            console.error("Failed to poll status:", err);
        }
    }, [onUploadComplete]);

    const handleUpload = async () => {
        if (!selectedFile) return;

        setIsUploading(true);
        setError(null);

        try {
            await uploadCandidatesCsv(selectedFile);
            onProcessingStart?.();

            // Start polling for status
            pollingRef.current = setInterval(pollStatus, 2000);
            pollStatus(); // Initial poll
        } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed");
            setIsUploading(false);
        }
    };

    const isProcessing = status?.status === "extracting" || status?.status === "scoring";
    const isComplete = status?.status === "complete";

    return (
        <div className="w-full max-w-xl mx-auto">
            {/* Drop Zone */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !isProcessing && !isComplete && fileInputRef.current?.click()}
                className={cn(
                    "relative rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer",
                    isDragging && "border-primary bg-primary/5",
                    !isDragging && !selectedFile && "border-border hover:border-primary/50 hover:bg-muted/50",
                    selectedFile && !isProcessing && !isComplete && "border-primary/50 bg-primary/5",
                    isProcessing && "border-blue-500/50 bg-blue-500/5 cursor-default",
                    isComplete && "border-green-500/50 bg-green-500/5 cursor-default",
                    error && "border-destructive/50 bg-destructive/5"
                )}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={isProcessing || isComplete}
                />

                {/* Icon */}
                <div className="mb-4">
                    {isComplete ? (
                        <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
                    ) : isProcessing ? (
                        <Loader2 className="w-12 h-12 mx-auto text-blue-500 animate-spin" />
                    ) : selectedFile ? (
                        <FileText className="w-12 h-12 mx-auto text-primary" />
                    ) : (
                        <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                    )}
                </div>

                {/* Text */}
                {isComplete ? (
                    <>
                        <p className="text-lg font-medium text-green-400 mb-1">
                            Processing Complete!
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {status?.candidates_total} candidates processed and ranked
                        </p>
                    </>
                ) : isProcessing ? (
                    <>
                        <p className="text-lg font-medium text-blue-400 mb-1">
                            {status?.phase === "extracting" ? "Extracting Data..." : "Scoring Candidates..."}
                        </p>
                        <p className="text-sm text-muted-foreground mb-3">
                            {status?.message}
                        </p>
                        {/* Progress bar */}
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 transition-all duration-300"
                                style={{ width: `${status?.progress || 0}%` }}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            {status?.progress}% complete
                        </p>
                    </>
                ) : selectedFile ? (
                    <>
                        <p className="text-lg font-medium mb-1">{selectedFile.name}</p>
                        <p className="text-sm text-muted-foreground mb-4">
                            {(selectedFile.size / 1024).toFixed(1)} KB
                        </p>
                    </>
                ) : (
                    <>
                        <p className="text-lg font-medium mb-1">
                            Drop your CSV file here
                        </p>
                        <p className="text-sm text-muted-foreground">
                            or click to browse
                        </p>
                    </>
                )}

                {/* Error */}
                {error && (
                    <div className="flex items-center justify-center gap-2 mt-4 text-destructive">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">{error}</span>
                    </div>
                )}
            </div>

            {/* Upload Button */}
            {selectedFile && !isProcessing && !isComplete && (
                <button
                    onClick={handleUpload}
                    disabled={isUploading}
                    className={cn(
                        "mt-4 w-full py-3 rounded-lg font-medium transition-all",
                        "bg-primary text-primary-foreground hover:bg-primary/90",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        "flex items-center justify-center gap-2"
                    )}
                >
                    {isUploading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Uploading...
                        </>
                    ) : (
                        <>
                            <Upload className="w-4 h-4" />
                            Process Candidates
                        </>
                    )}
                </button>
            )}
        </div>
    );
}
