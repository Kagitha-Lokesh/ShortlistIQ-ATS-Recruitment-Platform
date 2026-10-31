import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  FolderUp,
  Pause,
  Play,
  RotateCcw,
  Clock,
  ShieldCheck,
  Server
} from 'lucide-react';
import { shortlistApi } from '../../lib/api.js';
import { Button } from '../ui/Button.js';

export interface FileUploadItem {
  id: string;
  file: File;
  name: string;
  size: number;
  status: 'queued' | 'uploading' | 'completed' | 'failed';
  error?: string;
}

interface BulkUploaderProps {
  batchId?: string;
  onFilesSelected?: (files: File[]) => void;
  onUploadComplete?: (uploadedCount: number) => void;
  autoUpload?: boolean;
}

export const BulkUploader: React.FC<BulkUploaderProps> = ({
  batchId,
  onFilesSelected,
  onUploadComplete,
  autoUpload = false
}) => {
  const [items, setItems] = useState<FileUploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  isPausedRef.current = isPaused;

  const [uploadStartTime, setUploadStartTime] = useState<number | null>(null);
  const [estimatedSecondsRemaining, setEstimatedSecondsRemaining] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: File[]) => {
    // Filter to only PDF files
    const validPdfs = newFiles.filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );

    if (validPdfs.length === 0) return;

    const newItems: FileUploadItem[] = validPdfs.map((file, idx) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${idx}`,
      file,
      name: file.name,
      size: file.size,
      status: 'queued'
    }));

    setItems((prev) => [...prev, ...newItems]);
    onFilesSelected?.(validPdfs);

    if (autoUpload && batchId && !isUploading) {
      startChunkedUpload([...items, ...newItems], batchId);
    }
  }, [batchId, autoUpload, isUploading, items, onFilesSelected]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  /**
   * Concurrency-limited chunked uploader with Pause/Resume and honest ETA
   */
  const startChunkedUpload = async (queueToUpload: FileUploadItem[], targetBatchId: string) => {
    if (isUploading) return;
    setIsUploading(true);
    setIsPaused(false);
    const startTime = Date.now();
    setUploadStartTime(startTime);

    const CHUNK_SIZE = 6;
    const CONCURRENCY_LIMIT = 3;

    // Filter items that are queued
    const pendingItems = queueToUpload.filter((i) => i.status === 'queued' || i.status === 'failed');
    const chunks: FileUploadItem[][] = [];
    for (let i = 0; i < pendingItems.length; i += CHUNK_SIZE) {
      chunks.push(pendingItems.slice(i, i + CHUNK_SIZE));
    }

    let chunkIdx = 0;
    let completedTotal = 0;

    const processNextChunk = async (): Promise<void> => {
      while (chunkIdx < chunks.length) {
        if (isPausedRef.current) {
          // Wait while paused
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }

        const currentChunk = chunks[chunkIdx++];
        const chunkFileIds = new Set(currentChunk.map((it) => it.id));

        // Mark items as uploading
        setItems((prev) =>
          prev.map((it) => (chunkFileIds.has(it.id) ? { ...it, status: 'uploading' } : it))
        );

        try {
          const files = currentChunk.map((it) => it.file);
          await shortlistApi.uploadCandidateChunk(targetBatchId, files);

          // Mark items as completed
          completedTotal += currentChunk.length;
          setItems((prev) =>
            prev.map((it) => (chunkFileIds.has(it.id) ? { ...it, status: 'completed' } : it))
          );

          // Calculate honest ETA
          const elapsedSeconds = (Date.now() - startTime) / 1000;
          const filesRemaining = pendingItems.length - completedTotal;
          if (completedTotal > 0 && filesRemaining > 0) {
            const avgSecondsPerFile = elapsedSeconds / completedTotal;
            setEstimatedSecondsRemaining(Math.ceil(avgSecondsPerFile * filesRemaining));
          } else {
            setEstimatedSecondsRemaining(null);
          }
        } catch (err: any) {
          // Mark items as failed with exact server message
          setItems((prev) =>
            prev.map((it) =>
              chunkFileIds.has(it.id)
                ? { ...it, status: 'failed', error: err?.message || 'Network error / corrupt file' }
                : it
            )
          );
        }
      }
    };

    // Run up to CONCURRENCY_LIMIT workers in parallel
    const workers = Array.from(
      { length: Math.min(CONCURRENCY_LIMIT, chunks.length) },
      () => processNextChunk()
    );

    await Promise.all(workers);
    setIsUploading(false);
    setEstimatedSecondsRemaining(null);
    onUploadComplete?.(completedTotal);
  };

  const handlePauseResume = () => {
    setIsPaused((prev) => !prev);
  };

  const handleRetryFailed = () => {
    if (!batchId) return;
    const failedItems = items.filter((i) => i.status === 'failed');
    if (failedItems.length === 0) return;

    setItems((prev) =>
      prev.map((it) => (it.status === 'failed' ? { ...it, status: 'queued', error: undefined } : it))
    );

    startChunkedUpload(items.filter((i) => i.status === 'failed'), batchId);
  };

  const completedCount = items.filter((i) => i.status === 'completed').length;
  const failedCount = items.filter((i) => i.status === 'failed').length;
  const queuedCount = items.filter((i) => i.status === 'queued').length;
  const uploadingCount = items.filter((i) => i.status === 'uploading').length;
  const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Background Processing Honest Disclosure */}
      <div className="bg-surface-subtle border border-border rounded-xl p-3.5 flex items-start gap-3 shadow-2xs">
        <Server className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-ink-secondary leading-relaxed">
          <strong className="text-ink-primary font-semibold">Continuous Background Processing:</strong> Once resumes are uploaded, parsing, text reconstruction, and scoring execute on server workers. You can safely close or navigate away from this tab at any time; progress continues uninterrupted.
        </div>
      </div>

      {/* Large Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          isDragging
            ? 'border-primary bg-primary/5 scale-[1.005]'
            : 'border-border hover:border-border-strong bg-surface'
        }`}
      >
        <div className="w-12 h-12 rounded-full bg-surface-muted border border-border text-primary flex items-center justify-center mx-auto mb-3 shadow-xs">
          <Upload className="w-6 h-6" />
        </div>

        <h4 className="text-sm font-semibold text-ink-primary mb-1">
          Drag and drop candidate resumes here, or select files
        </h4>
        <p className="text-xs text-ink-muted mb-4 max-w-md mx-auto">
          Upload up to 500+ text-based PDF resumes (max 5 MB per file). Clean digital PDFs are recommended.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg text-primary-foreground bg-primary hover:bg-primary-hover transition-colors shadow-xs"
          >
            <FileText className="w-3.5 h-3.5" />
            Select PDF Files
          </button>

          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg text-ink-primary bg-surface border border-border hover:bg-surface-hover transition-colors shadow-xs"
          >
            <FolderUp className="w-3.5 h-3.5" />
            Select Entire Folder
          </button>

          {/* Hidden Inputs */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(Array.from(e.target.files));
            }}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            // @ts-expect-error webkitdirectory supported in modern browsers
            webkitdirectory=""
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(Array.from(e.target.files));
            }}
          />
        </div>
      </div>

      {/* Upload Status & Progress */}
      {items.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div>
              <div className="font-semibold text-ink-primary flex items-center gap-2">
                <span>{items.length} Files Selected</span>
                {isUploading && (
                  <span className="text-[11px] font-normal text-primary">
                    ({isPaused ? 'Paused' : 'Uploading in chunks of 6, concurrency 3...'})
                  </span>
                )}
              </div>
              <div className="text-ink-secondary mt-0.5">
                {completedCount} completed • {queuedCount + uploadingCount} in progress {failedCount > 0 && `• ${failedCount} failed`}
              </div>
            </div>

            {/* Honest ETA and Pause/Resume/Retry buttons */}
            <div className="flex items-center gap-2">
              {estimatedSecondsRemaining !== null && isUploading && !isPaused && (
                <div className="flex items-center gap-1 text-[11px] font-medium text-ink-secondary bg-surface-muted px-2.5 py-1 rounded-md border border-border">
                  <Clock className="w-3 h-3 text-ink-muted" />
                  <span>ETA: ~{estimatedSecondsRemaining}s</span>
                </div>
              )}

              {isUploading && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePauseResume}
                  leftIcon={isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                >
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
              )}

              {failedCount > 0 && !isUploading && batchId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRetryFailed}
                  leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                >
                  Retry {failedCount} Failed
                </Button>
              )}

              {!autoUpload && batchId && !isUploading && completedCount < items.length && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => startChunkedUpload(items.filter((i) => i.status === 'queued'), batchId)}
                  leftIcon={<Upload className="w-3.5 h-3.5" />}
                >
                  Upload Remaining
                </Button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-surface-muted h-2 rounded-full overflow-hidden border border-border/50">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                isPaused
                  ? 'bg-amber-500'
                  : isUploading
                  ? 'bg-primary'
                  : 'bg-status-shortlist-text'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* File list preview (with status icons and reason for failure) */}
          <div className="max-h-60 overflow-y-auto divide-y divide-border border border-border rounded-lg bg-surface-subtle/30">
            {items.map((item) => (
              <div key={item.id} className="py-2.5 px-3 flex items-center justify-between text-xs hover:bg-surface-hover/50 transition-colors">
                <div className="flex items-center gap-2.5 truncate pr-2">
                  <FileText className="w-4 h-4 text-ink-muted shrink-0" />
                  <div className="truncate">
                    <span className="truncate text-ink-primary font-medium block">{item.name}</span>
                    {item.error && (
                      <span className="text-[11px] text-status-danger-text block truncate">
                        Reason: {item.error}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-ink-muted shrink-0 font-mono">
                    ({(item.size / 1024).toFixed(0)} KB)
                  </span>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {item.status === 'completed' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-status-shortlist-text font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Scored / Ready
                    </span>
                  )}
                  {item.status === 'uploading' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-primary font-medium bg-primary/10 px-2 py-0.5 rounded">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Parsing & Uploading
                    </span>
                  )}
                  {item.status === 'failed' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-status-danger-text font-medium bg-red-50 px-2 py-0.5 rounded border border-red-200">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Failed
                    </span>
                  )}
                  {item.status === 'queued' && (
                    <span className="text-[11px] text-ink-muted inline-flex items-center gap-1 bg-surface-muted px-2 py-0.5 rounded border border-border">
                      <Clock className="w-3 h-3" />
                      Queued
                    </span>
                  )}

                  {!isUploading && item.status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                      className="p-1 text-ink-muted hover:text-ink-primary rounded"
                      title="Remove file"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
