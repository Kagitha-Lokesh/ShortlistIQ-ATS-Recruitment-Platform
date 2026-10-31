import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, X, FolderUp } from 'lucide-react';
import { shortlistApi } from '../../lib/api.js';

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
  // If batchId is provided, upload immediately in chunks with concurrency 3
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

    if (autoUpload && batchId) {
      startChunkedUpload(newItems, batchId);
    }
  }, [batchId, autoUpload, onFilesSelected]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  /**
   * Concurrency-limited chunked uploader:
   * Chunks of 6 files per request with concurrency of 3
   */
  const startChunkedUpload = async (queueToUpload: FileUploadItem[], targetBatchId: string) => {
    if (isUploading) return;
    setIsUploading(true);

    const CHUNK_SIZE = 6;
    const CONCURRENCY_LIMIT = 3;

    // Split queued items into chunks
    const chunks: FileUploadItem[][] = [];
    for (let i = 0; i < queueToUpload.length; i += CHUNK_SIZE) {
      chunks.push(queueToUpload.slice(i, i + CHUNK_SIZE));
    }

    let chunkIdx = 0;
    let completedTotal = 0;

    const processNextChunk = async (): Promise<void> => {
      while (chunkIdx < chunks.length) {
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
        } catch (err: any) {
          // Mark items as failed
          setItems((prev) =>
            prev.map((it) =>
              chunkFileIds.has(it.id)
                ? { ...it, status: 'failed', error: err?.message || 'Upload failed' }
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
    onUploadComplete?.(completedTotal);
  };

  const completedCount = items.filter((i) => i.status === 'completed').length;
  const failedCount = items.filter((i) => i.status === 'failed').length;
  const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
          isDragging
            ? 'border-brand-indigo bg-indigo-50/50 scale-[1.005]'
            : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
        }`}
      >
        <div className="w-12 h-12 rounded-full bg-white border border-slate-200 text-brand-indigo flex items-center justify-center mx-auto mb-3 shadow-soft">
          <Upload className="w-6 h-6" />
        </div>

        <h4 className="text-sm font-semibold text-slate-primary mb-1">
          Drag and drop resumes here, or select files
        </h4>
        <p className="text-xs text-slate-secondary mb-4">
          Upload up to 500+ text-based PDF resumes (max 5 MB per file).
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded text-white bg-brand-indigo hover:bg-brand-hover transition-colors shadow-sm"
          >
            <FileText className="w-3.5 h-3.5" />
            Select PDF Files
          </button>

          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded text-slate-primary bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-sm"
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
        <div className="bg-white border border-slate-border rounded-lg p-4 space-y-3 shadow-soft">
          <div className="flex items-center justify-between text-xs">
            <div className="font-semibold text-slate-primary">
              {items.length} Files Selected
              {isUploading && <span className="text-brand-indigo ml-2 font-normal">(Uploading in chunks of 6, concurrency 3...)</span>}
            </div>
            <div className="text-slate-secondary">
              {completedCount} uploaded {failedCount > 0 && `• ${failedCount} failed`}
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                isUploading ? 'bg-brand-indigo' : 'bg-state-success'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Manual start upload button if not auto-uploaded */}
          {!autoUpload && batchId && !isUploading && completedCount < items.length && (
            <button
              type="button"
              onClick={() => startChunkedUpload(items.filter((i) => i.status === 'queued'), batchId)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded text-white bg-brand-indigo hover:bg-brand-hover transition-colors shadow-sm"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload All ({items.length}) Resumes Now
            </button>
          )}

          {/* File list preview (max 8 visible with scroll) */}
          <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded">
            {items.map((item) => (
              <div key={item.id} className="py-2 px-3 flex items-center justify-between text-xs hover:bg-slate-50/50">
                <div className="flex items-center gap-2 truncate pr-2">
                  <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate text-slate-primary font-medium">{item.name}</span>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    ({(item.size / 1024).toFixed(0)} KB)
                  </span>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  {item.status === 'completed' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-state-success font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Uploaded
                    </span>
                  )}
                  {item.status === 'uploading' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-brand-indigo font-medium">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Uploading
                    </span>
                  )}
                  {item.status === 'failed' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-state-danger font-medium">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Failed
                    </span>
                  )}
                  {item.status === 'queued' && (
                    <span className="text-[11px] text-slate-400">Queued</span>
                  )}

                  {!isUploading && item.status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded"
                    >
                      <X className="w-3 h-3" />
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

