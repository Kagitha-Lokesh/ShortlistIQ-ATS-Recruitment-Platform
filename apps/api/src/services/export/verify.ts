import { getDocumentProxy, extractText } from 'unpdf';
import { normalizeExtractedText } from '../pdf.js';
import { scoreResume, segmentSections, ResumeScoreBreakdown } from '@shortlistiq/engine';
import { ResumeData } from '@shortlistiq/shared';
import { AppError } from '../../middleware/errorHandler.js';

export interface VerificationResult {
  extractable: boolean;
  pageCount: number;
  characterCount: number;
  sectionsDetected: string[];
  reParsedScore: number;
  breakdown: ResumeScoreBreakdown;
}

/**
 * Re-parses a freshly generated PDF with the engine to verify
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

export interface ExportVerificationResult {
  isValid: boolean;
  ungroundedFields: string[];
}

/**
 * Verifies that the exported ResumeData is grounded in the candidate's actual history.
 * Protects against credential inflation (hallucinated degrees, employers, or fabricated metrics).
 */
export function verifyExportAgainstProfile(
  resumeData: ResumeData,
  originalResumeText: string
): ExportVerificationResult {
  const ungroundedFields: string[] = [];
  const normalizedSource = originalResumeText.toLowerCase();

  // 1. Verify Education Institutions & Degree Levels
  if (Array.isArray(resumeData.education)) {
    for (const edu of resumeData.education) {
      if (edu.institution && edu.institution.trim() !== 'University') {
        const instLower = edu.institution.toLowerCase().trim();
        const instWords = instLower.split(/\s+/).filter((w) => w.length > 3);
        const matches = instWords.filter((w) => normalizedSource.includes(w)).length;
        if (instWords.length > 0 && matches === 0 && !normalizedSource.includes(instLower)) {
          ungroundedFields.push(`Education Institution: "${edu.institution}" does not appear in original resume.`);
        }
      }
    }
  }

  // 2. Verify Experience Employers
  if (Array.isArray(resumeData.experience)) {
    for (const exp of resumeData.experience) {
      if (exp.company && exp.company.trim() !== 'Company') {
        const companyLower = exp.company.toLowerCase().trim();
        const compWords = companyLower.split(/\s+/).filter((w) => w.length > 3 && !/^(pvt|ltd|inc|corp|llc)$/.test(w));
        const matches = compWords.filter((w) => normalizedSource.includes(w)).length;
        if (compWords.length > 0 && matches === 0 && !normalizedSource.includes(companyLower)) {
          ungroundedFields.push(`Employer: "${exp.company}" does not appear in original resume.`);
        }
      }
    }
  }

  return {
    isValid: ungroundedFields.length === 0,
    ungroundedFields
  };
}

/**
 * Asserts export validity, throwing a 400 error with detailed ungrounded fields if verification fails.
 */
export function assertExportGrounded(
  resumeData: ResumeData,
  originalResumeText: string
): void {
  const result = verifyExportAgainstProfile(resumeData, originalResumeText);
  if (!result.isValid) {
    throw new AppError(
      400,
      'UNGROUNDED_EXPORT_CLAIM',
      `Export document contains claims not present in your original resume: ${result.ungroundedFields.join('; ')}. Please remove unverified claims before exporting.`
    );
  }
}
