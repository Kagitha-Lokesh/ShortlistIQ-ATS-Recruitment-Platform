import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button.js';

export interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSizeBytes?: number;
  isLoading?: boolean;
  progress?: number;
  selectedFile?: File | null;
  onClearFile?: () => void;
  error?: string | null;
  title?: string;
  description?: string;
  className?: string;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFileSelect,
  accept = '.pdf,.docx,.txt',
  maxSizeBytes = 10 * 1024 * 1024, // 10MB
  isLoading = false,
  progress,
  selectedFile,
  onClearFile,
  error,
  title = 'Upload Candidate Resume',
  description = 'Drag & drop a PDF or DOCX file, or click to browse',
  className = ''
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const validateAndProcessFile = (file: File) => {
    setInternalError(null);
    if (file.size > maxSizeBytes) {
      setInternalError(`File size exceeds ${(maxSizeBytes / (1024 * 1024)).toFixed(0)}MB limit.`);
      return;
    }
    onFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const activeError = error || internalError;

  return (
    <div className={`w-full ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
        aria-label="Upload resume file"
        disabled={isLoading}
      />

      {selectedFile ? (
        <div className="rounded-lg border border-border bg-surface p-4 flex items-center justify-between gap-3 shadow-subtle">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded bg-surface-subtle border border-border flex items-center justify-center text-primary flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink-primary truncate">{selectedFile.name}</p>
              <p className="text-[11px] text-ink-muted tabular-nums">
                {formatFileSize(selectedFile.size)} • Ready for parsing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isLoading ? (
              <div className="flex items-center gap-2 text-xs font-medium text-ink-secondary">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Parsing… {progress != null ? `${progress}%` : ''}</span>
              </div>
            ) : (
              onClearFile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearFile}
                  aria-label="Remove selected file"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )
            )}
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          tabIndex={0}
          role="button"
          className={`rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-all select-none focus-visible:outline-2 focus-visible:outline-offset-2 ${
            isDragging
              ? 'border-primary bg-surface-subtle'
              : 'border-border bg-surface hover:border-border-strong hover:bg-surface-subtle/50'
          } ${activeError ? 'border-destructive/60 bg-red-50/20' : ''}`}
        >
          <div className="w-10 h-10 rounded-full bg-surface-subtle border border-border flex items-center justify-center text-ink-secondary mx-auto mb-3">
            <Upload className="w-5 h-5" />
          </div>
          <h4 className="text-xs font-semibold text-ink-primary">{title}</h4>
          <p className="text-[11px] text-ink-secondary mt-1">{description}</p>
          <span className="inline-block mt-3 px-2 py-0.5 text-[10px] font-medium text-ink-secondary bg-surface-subtle rounded border border-border">
            PDF, DOCX up to 10MB
          </span>
        </div>
      )}

      {activeError && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{activeError}</span>
        </div>
      )}
    </div>
  );
};

