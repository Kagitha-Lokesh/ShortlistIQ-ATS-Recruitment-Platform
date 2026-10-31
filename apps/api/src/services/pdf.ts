import { extractText, getDocumentProxy } from 'unpdf';
import { AppError } from '../middleware/errorHandler.js';

export interface ParsePdfResult {
  text: string;
  pageCount: number;
  characterCount: number;
}

/**
 * Normalizes text extracted from PDF:
 * - Converts all bullet point variants (•, ●, *, -, ▪, ▫, ◦, –, —) to standard "• "
 * - Normalizes horizontal whitespace and linebreaks
 */
export function normalizeExtractedText(raw: string): string {
  return raw
    // Normalize unicode bullet points to standard bullet
    .replace(/[\u2022\u2023\u25E6\u2043\u2219\u25AA\u25AB\u25CF\u25CB]/g, '• ')
    // Normalize hyphens and dashes at start of lines to bullets
    .replace(/(^|\n)\s*[-*–—]\s+/g, '$1• ')
    // Replace tabs and multiple horizontal spaces with a single space
    .replace(/[^\S\r\n]+/g, ' ')
    // Normalize newlines (max 2 consecutive newlines)
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Parses a PDF buffer with unpdf, normalizes bullets/whitespace,
 * enforces per-file timeout, and validates readable character threshold.
 */
export async function parsePdf(
  buffer: Buffer | Uint8Array,
  timeoutMs = 5000
): Promise<ParsePdfResult> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      reject(new AppError(408, 'PARSE_TIMEOUT', `PDF parsing timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
    // Allow timer to unref in Node
    if (typeof timer.unref === 'function') timer.unref();
  });

  const parsePromise = (async (): Promise<ParsePdfResult> => {
    try {
      // Clone bytes so pdfjs/unpdf cannot detach the caller's underlying ArrayBuffer
      const data = new Uint8Array(buffer).slice();
      const doc = await getDocumentProxy(data);
      const pageCount = doc.numPages;

      const { text: rawText } = await extractText(doc, { mergePages: true });
      const fullText = Array.isArray(rawText) ? rawText.join('\n') : String(rawText || '');
      const normalized = normalizeExtractedText(fullText);

      // Check readable character threshold (~200 characters)
      const readableChars = (normalized.match(/[a-zA-Z0-9]/g) || []).length;
      if (readableChars < 200) {
        throw new AppError(
          422,
          'NO_TEXT',
          'Resume contains no extractable text or is an image-only scan. Please upload a text-based PDF.'
        );
      }

      return {
        text: normalized,
        pageCount,
        characterCount: normalized.length
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        422,
        'CORRUPT_FILE',
        'Corrupted or unreadable PDF document. Please verify the file integrity.'
      );
    }
  })();

  return Promise.race([parsePromise, timeoutPromise]);
}

