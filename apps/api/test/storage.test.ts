import { describe, it, expect, beforeEach } from 'vitest';
import { storageService, STORAGE_BUCKETS } from '../src/services/storage.js';

describe('Phase 2 Storage Layer & File Validation', () => {
  beforeEach(() => {
    storageService.resetMockStorage();
  });

  const createFakePdfBuffer = (content = 'Sample PDF Content'): Buffer => {
    // Magic bytes %PDF + content
    return Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from(content)]);
  };

  describe('Upload Validation Rules', () => {
    it('rejects uploads with non-PDF MIME type', () => {
      const buf = createFakePdfBuffer();
      expect(() =>
        storageService.validatePdfBuffer(buf, 'image/png')
      ).toThrow('Only PDF files (application/pdf) are supported');
    });

    it('rejects spoofed files that do not have %PDF magic bytes', () => {
      const spoofedBuffer = Buffer.from('NOT A REAL PDF FILE HEADER');
      expect(() =>
        storageService.validatePdfBuffer(spoofedBuffer, 'application/pdf')
      ).toThrow('Magic bytes do not match a valid PDF file');
    });

    it('rejects files exceeding the 5 MB limit', () => {
      const oversizedBuffer = Buffer.alloc(5.5 * 1024 * 1024);
      oversizedBuffer[0] = 0x25; // %
      oversizedBuffer[1] = 0x50; // P
      oversizedBuffer[2] = 0x44; // D
      oversizedBuffer[3] = 0x46; // F

      expect(() =>
        storageService.validatePdfBuffer(oversizedBuffer, 'application/pdf')
      ).toThrow('exceeds maximum permitted size of 5 MB');
    });

    it('accepts valid PDF buffer under 5 MB with %PDF header', () => {
      const validBuffer = createFakePdfBuffer();
      expect(() =>
        storageService.validatePdfBuffer(validBuffer, 'application/pdf')
      ).not.toThrow();
    });
  });

  describe('Storage Path & Tenancy Isolation', () => {
    const orgAId = 'org-apex-111';
    const orgBId = 'org-beacon-222';

    it('stores files using {ownerId}/{uuid}.pdf format', async () => {
      const buffer = createFakePdfBuffer('Resume Text for Org A');
      const { path } = await storageService.uploadFile(
        STORAGE_BUCKETS.RESUMES,
        orgAId,
        buffer,
        'application/pdf'
      );

      expect(path).toMatch(new RegExp(`^${orgAId}/[0-9a-f-]{36}\\.pdf$`));
    });

    it('proves Org A cannot access or generate signed URLs for Org B files', async () => {
      const bufferB = createFakePdfBuffer('Resume for Org B');
      const { path: pathB } = await storageService.uploadFile(
        STORAGE_BUCKETS.RESUMES,
        orgBId,
        bufferB,
        'application/pdf'
      );

      // Org A attempting to generate a signed URL for Org B's file
      await expect(
        storageService.createSignedUrl(STORAGE_BUCKETS.RESUMES, pathB, orgAId)
      ).rejects.toThrow('Tenant boundary violation: you do not have permission to access files in this storage path');
    });

    it('generates short-lived signed URL when caller owns the file', async () => {
      const bufferA = createFakePdfBuffer('Resume for Org A');
      const { path: pathA } = await storageService.uploadFile(
        STORAGE_BUCKETS.RESUMES,
        orgAId,
        bufferA,
        'application/pdf'
      );

      const result = await storageService.createSignedUrl(
        STORAGE_BUCKETS.RESUMES,
        pathA,
        orgAId,
        300
      );

      expect(result.signedUrl).toBeDefined();
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });
});

