import { extractText, extractTextItems, getDocumentProxy } from 'unpdf';
import {
  ingestResumeItems,
  ingestResumeText,
  PositionedTextItem,
  ParseQualityReport,
  EvidenceLocation
} from '@shortlistiq/engine';
import { AppError } from '../middleware/errorHandler.js';

export interface ParsePdfResult {
  text: string;
  pageCount: number;
  characterCount: number;
  report: ParseQualityReport;
  cleanedTextForLlm: string;
  sourceMap: Array<EvidenceLocation | null>;
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

export interface ParsePdfOptions {
  allowUnreadable?: boolean;
}

/**
 * Parses a PDF buffer using 2D coordinate-aware text extraction from unpdf,
 * reconstructs multi-column and sidebar reading order without horizontal line interleaving,
 * enforces per-file timeout, and produces a complete parse-quality gate report.
 */
export async function parsePdf(
  buffer: Buffer | Uint8Array,
  timeoutMs = 5000,
  options?: ParsePdfOptions
): Promise<ParsePdfResult> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      reject(new AppError(408, 'PARSE_TIMEOUT', `PDF parsing timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();
  });

  const parsePromise = (async (): Promise<ParsePdfResult> => {
    try {
      // Clone bytes so unpdf/pdfjs cannot detach the caller's underlying ArrayBuffer
      const data = new Uint8Array(buffer).slice();
      const doc = await getDocumentProxy(data);
      const pageCount = doc.numPages;

      let ingestedResult;

      try {
        // 1. Attempt 2D positioned extraction
        const { items: pageItems } = await extractTextItems(doc);
        const structuredPages: PositionedTextItem[][] = pageItems.map((page, pIdx) =>
          page.map((item) => ({
            str: item.str,
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
            fontSize: item.fontSize,
            fontFamily: item.fontFamily,
            dir: item.dir,
            hasEOL: item.hasEOL,
            page: pIdx + 1
          }))
        );

        ingestedResult = ingestResumeItems(structuredPages);
      } catch {
        // Fallback to linear text extraction if text-items failed
        const { text: rawText } = await extractText(doc, { mergePages: true });
        const fullText = Array.isArray(rawText) ? rawText.join('\n') : String(rawText || '');
        ingestedResult = ingestResumeText(fullText);
      }

      const normalized = ingestedResult.normalizedText;
      const readableChars = (normalized.match(/[a-zA-Z0-9]/g) || []).length;

      // In legacy mode (ENGINE_V2 false and allowUnreadable false), maintain strict 422 for < 200 chars
      const isEngineV2 = process.env.ENGINE_V2 === 'true' || process.env.ENGINE_V2 === 'shadow';
      const allowUnreadable = options?.allowUnreadable || isEngineV2;

      if (!allowUnreadable && (readableChars < 200 || ingestedResult.report.isImageOnly)) {
        throw new AppError(
          422,
          'NO_TEXT',
          'Resume contains no extractable text or is an image-only scan. Please upload a text-based PDF.'
        );
      }

      return {
        text: normalized,
        pageCount,
        characterCount: normalized.length,
        report: ingestedResult.report,
        cleanedTextForLlm: ingestedResult.cleanedTextForLlm,
        sourceMap: ingestedResult.sourceMap
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
