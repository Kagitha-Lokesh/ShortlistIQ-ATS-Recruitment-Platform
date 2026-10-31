import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../services/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

export const STORAGE_BUCKETS = {
  RESUMES: 'resumes',
  GENERATED: 'generated'
} as const;

export type StorageBucket = typeof STORAGE_BUCKETS[keyof typeof STORAGE_BUCKETS];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// In-memory fallback mock for testing/offline runs
const mockStorage = new Map<string, { buffer: Buffer; contentType: string }>();

export const storageService = {
  /**
   * Validate PDF upload:
   * 1. 5 MB limit
   * 2. MIME type application/pdf
   * 3. Magic bytes starting with %PDF (0x25, 0x50, 0x44, 0x46)
   */
  validatePdfBuffer(buffer: Buffer, mimeType: string): void {
    if (buffer.length > MAX_FILE_SIZE) {
      throw new AppError(
        400,
        'FILE_TOO_LARGE',
        `File exceeds maximum permitted size of 5 MB (received ${(buffer.length / (1024 * 1024)).toFixed(2)} MB).`
      );
    }

    if (mimeType !== 'application/pdf') {
      throw new AppError(
        400,
        'INVALID_MIME_TYPE',
        'Only PDF files (application/pdf) are supported.'
      );
    }

    // Check PDF magic bytes: %PDF
    if (buffer.length < 4) {
      throw new AppError(400, 'CORRUPT_FILE', 'File is too small to be a valid PDF.');
    }

    const isPdfMagicBytes =
      buffer[0] === 0x25 && // %
      buffer[1] === 0x50 && // P
      buffer[2] === 0x44 && // D
      buffer[3] === 0x46;   // F

    if (!isPdfMagicBytes) {
      throw new AppError(
        400,
        'INVALID_PDF_HEADER',
        'Uploaded file failed binary verification. Magic bytes do not match a valid PDF file.'
      );
    }
  },

  /**
   * Generates secure storage path: {orgId or userId}/{uuid}.pdf
   */
  generatePath(ownerId: string, filename = `${uuidv4()}.pdf`): string {
    if (!ownerId) {
      throw new AppError(400, 'INVALID_OWNER', 'Owner ID is required for storage path.');
    }
    return `${ownerId}/${filename}`;
  },

  /**
   * Verify storage tenant boundary:
   * Ensures Org A or User A cannot view or request signed URLs for {orgBId}/... files.
   */
  verifyAccess(path: string, callerOwnerId: string): void {
    const ownerPrefix = path.split('/')[0];
    if (ownerPrefix !== callerOwnerId) {
      throw new AppError(
        403,
        'STORAGE_ACCESS_DENIED',
        'Tenant boundary violation: you do not have permission to access files in this storage path.'
      );
    }
  },

  /**
   * Uploads file to Supabase storage or mock store
   */
  async uploadFile(
    bucket: StorageBucket,
    ownerId: string,
    buffer: Buffer,
    mimeType = 'application/pdf'
  ): Promise<{ path: string }> {
    this.validatePdfBuffer(buffer, mimeType);
    const path = this.generatePath(ownerId);

    if (supabase) {
      const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
        contentType: mimeType,
        upsert: false
      });
      if (error) {
        throw new AppError(500, 'STORAGE_UPLOAD_ERROR', error.message);
      }
    } else {
      mockStorage.set(`${bucket}:${path}`, { buffer, contentType: mimeType });
    }

    return { path };
  },

  /**
   * Hands out short-lived signed URL for viewing (default 300 seconds)
   */
  async createSignedUrl(
    bucket: StorageBucket,
    path: string,
    callerOwnerId: string,
    expiresInSeconds = 300
  ): Promise<{ signedUrl: string; expiresAt: Date }> {
    // Enforce tenancy before issuing signed URL
    this.verifyAccess(path, callerOwnerId);

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    if (supabase) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresInSeconds);

      if (error || !data?.signedUrl) {
        throw new AppError(500, 'STORAGE_URL_ERROR', error?.message || 'Failed to create signed URL');
      }
      return { signedUrl: data.signedUrl, expiresAt };
    }

    // In-memory signed URL mock
    const signedUrl = `https://supabase.mock/storage/v1/object/sign/${bucket}/${path}?token=mock-signed-${Date.now()}`;
    return { signedUrl, expiresAt };
  },

  /**
   * Downloads raw file buffer from storage
   */
  async downloadFile(bucket: StorageBucket, path: string): Promise<Buffer> {
    if (supabase) {
      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (error || !data) {
        throw new AppError(404, 'FILE_NOT_FOUND', error?.message || 'File not found in storage');
      }
      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    const item = mockStorage.get(`${bucket}:${path}`);
    if (!item) {
      throw new AppError(404, 'FILE_NOT_FOUND', `File ${path} not found in mock storage`);
    }
    return item.buffer;
  },

  /**
   * Permanently deletes file object from storage
   */
  async deleteFile(bucket: StorageBucket, path: string): Promise<boolean> {
    if (supabase) {
      const { error } = await supabase.storage.from(bucket).remove([path]);
      if (error) {
        throw new AppError(500, 'STORAGE_DELETE_ERROR', error.message);
      }
      return true;
    }

    return mockStorage.delete(`${bucket}:${path}`);
  },

  resetMockStorage() {
    mockStorage.clear();
  }
};

