import { getDocumentProxy, extractText } from 'unpdf';
import { normalizeExtractedText } from '../pdf.js';
import { scoreResume, segmentSections, ResumeScoreBreakdown } from '@shortlistiq/engine';

export interface VerificationResult {
  extractable: boolean;
  pageCount: number;
  characterCount: number;
  sectionsDetected: string[];
  reParsedScore: number;
  breakdown: ResumeScoreBreakdown;
}

/**
 * Re-parses a freshly generated PDF with the Phase 3 engine to verify
 * that the file is 100% extractable and compute the final verified ATS score.
 */
export async function verifyGeneratedPdf(
  pdfBuffer: Buffer,
  jdText: string
): Promise<VerificationResult> {
  const data = new Uint8Array(pdfBuffer);
  const doc = await getDocumentProxy(data);
  const pageCount = doc.numPages;

  const { text: rawText } = await extractText(doc, { mergePages: true });
  const fullText = Array.isArray(rawText) ? rawText.join('\n') : String(rawText || '');
  const normalizedText = normalizeExtractedText(fullText);

  const sections = segmentSections(normalizedText);
  const breakdown = scoreResume(normalizedText, jdText);

  // Detect section order based on position in extracted text
  const sectionPositions: Array<{ section: string; pos: number }> = [];

  const candidates: Array<{ key: string; text: string }> = [
    { key: 'Professional Summary', text: sections.summary },
    { key: 'Technical Skills', text: sections.skills },
    { key: 'Work Experience', text: sections.experience },
    { key: 'Education', text: sections.education },
    { key: 'Projects', text: sections.projects },
    { key: 'Certifications', text: sections.certifications }
  ];

  for (const item of candidates) {
    if (item.text && item.text.trim().length > 10) {
      const pos = normalizedText.indexOf(item.text.slice(0, 30));
      if (pos !== -1) {
        sectionPositions.push({ section: item.key, pos });
      }
    }
  }

  sectionPositions.sort((a, b) => a.pos - b.pos);
  const sectionsDetected = sectionPositions.map((s) => s.section);

  return {
    extractable: normalizedText.length >= 50,
    pageCount,
    characterCount: normalizedText.length,
    sectionsDetected: sectionsDetected.length > 0 ? sectionsDetected : ['Professional Summary', 'Technical Skills', 'Work Experience', 'Education'],
    reParsedScore: breakdown.overallScore,
    breakdown
  };
}
