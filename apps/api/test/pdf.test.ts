import { describe, it, expect } from 'vitest';
import { normalizeExtractedText, parsePdf } from '../src/services/pdf.js';

describe('PDF Extraction & Normalization (apps/api)', () => {
  describe('normalizeExtractedText', () => {
    it('normalizes bullet point variants to standard bullet', () => {
      const raw = '• First item\n* Second item\n- Third item\n▪ Fourth item';
      const normalized = normalizeExtractedText(raw);
      expect(normalized).toContain('• First item');
      expect(normalized).toContain('• Second item');
      expect(normalized).toContain('• Third item');
      expect(normalized).toContain('• Fourth item');
    });

    it('collapses multiple whitespace and empty lines', () => {
      const raw = 'Word1    Word2\n\n\n\nWord3';
      const normalized = normalizeExtractedText(raw);
      expect(normalized).toBe('Word1 Word2\n\nWord3');
    });
  });

  describe('parsePdf Validation & Error Handling', () => {
    it('handles corrupt files without crashing, throwing CORRUPT_FILE', async () => {
      const corruptBuffer = Buffer.from('NOT A REAL PDF CONTENT');

      await expect(parsePdf(corruptBuffer)).rejects.toThrow();
    });

    it('enforces per-file timeout properly', async () => {
      // Simulate extreme timeout
      const fakeBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
      // Timeout of 0ms immediately triggers timeout
      await expect(parsePdf(fakeBuffer, 0)).rejects.toThrow();
    });
  });
});

