import { ParseQualityReport, ParseStatus, IntegrityFlag, PositionedTextItem } from './types.js';
import { extractBasics } from '../basics/index.js';
import { segmentSections } from '../sections/index.js';
import { ReconstructedPage } from './layout.js';

const GARBLED_PATTERN = /[\uFFFD\uE000-\uF8FF\uFFF0-\uFFFF\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

/**
 * Produces a rigorous parse-quality gate report for an ingested resume.
 * Identifies OCR defects, private-use glyphs, image-only scans, and formatting anomalies.
 */
export function produceParseQualityReport(params: {
  normalizedText: string;
  pages: ReconstructedPage[];
  allItems: PositionedTextItem[];
  ligatureIssueCount: number;
  integrityFlags: IntegrityFlag[];
}): ParseQualityReport {
  const { normalizedText, pages, allItems, ligatureIssueCount, integrityFlags } = params;

  const characterCount = normalizedText.length;
  const words = normalizedText.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const pageCount = Math.max(1, pages.length);

  // 1. Detect image-only content (scanned PDFs without OCR layer)
  const readableChars = (normalizedText.match(/[a-zA-Z0-9]/g) || []).length;
  const isImageOnly = readableChars < 60 && allItems.length < 25;

  // 2. Garbled / Private-Use Character Ratio
  const garbledMatches = normalizedText.match(GARBLED_PATTERN) || [];
  const privateUseMatches = normalizedText.match(/[\uE000-\uF8FF]/g) || [];
  const garbledCharacterRatio = characterCount > 0 ? garbledMatches.length / characterCount : 0;
  const privateUseGlyphCount = privateUseMatches.length;

  // 3. Section and Contact Detection
  const sections = segmentSections(normalizedText);
  const sectionsFound: string[] = [];
  const sectionKeys: Array<keyof typeof sections> = [
    'experience',
    'skills',
    'education',
    'summary',
    'projects',
    'certifications'
  ];

  for (const k of sectionKeys) {
    if (sections[k] && sections[k].trim().length > 20) {
      sectionsFound.push(k);
    }
  }

  const basics = extractBasics(normalizedText);
  const contactInfoFound = {
    email: basics.email !== 'NO_EMAIL',
    phone: Boolean(basics.phone),
    linksCount: basics.links.all.length
  };

  // 4. Layout Flags across all pages
  const suspectedMultiColumn = pages.some((p) => p.isMultiColumn);
  const suspectedTableLayout = pages.some((p) => p.isTable);
  const suspectedHiddenText = pages.some((p) => p.hasHiddenText);

  // 5. Language Detection Heuristic (English detection via common function words)
  const englishStopWords = ['and', 'the', 'in', 'of', 'to', 'with', 'for', 'at', 'on', 'by'];
  const lowerWords = words.map((w) => w.toLowerCase());
  const englishMatches = englishStopWords.filter((sw) => lowerWords.includes(sw)).length;
  const language = englishMatches >= 3 ? 'en' : 'unknown';

  // 6. Status Determination & Specific Reasons
  const reasons: string[] = [];
  let status: ParseStatus = 'OK';

  if (isImageOnly) {
    status = 'UNREADABLE';
    reasons.push('Resume contains no extractable text or is an image-only scan. Human review or re-upload required.');
  } else if (garbledCharacterRatio > 0.20) {
    status = 'UNREADABLE';
    reasons.push(`Severely garbled document encoding (${Math.round(garbledCharacterRatio * 100)}% unreadable glyphs).`);
  } else if (characterCount < 120) {
    status = 'UNREADABLE';
    reasons.push(`Insufficient extractable content (${characterCount} characters detected).`);
  } else {
    // Check PARTIAL conditions
    if (characterCount < 300) {
      status = 'PARTIAL';
      reasons.push(`Document is unusually brief (${characterCount} characters).`);
    }
    if (garbledCharacterRatio > 0.04) {
      status = 'PARTIAL';
      reasons.push(`Minor glyph encoding errors detected (${Math.round(garbledCharacterRatio * 100)}% corrupted characters).`);
    }
    if (sectionsFound.length === 0) {
      status = 'PARTIAL';
      reasons.push('No standard section headings detected (experience, skills, or education).');
    }
    if (!contactInfoFound.email) {
      status = 'PARTIAL';
      reasons.push('No contact email could be extracted from text.');
    }
    if (suspectedHiddenText) {
      status = 'PARTIAL';
      reasons.push('Suspected hidden or microscopic text (< 3pt) detected.');
    }
  }

  return {
    status,
    characterCount,
    wordCount,
    pageCount,
    language,
    sectionsFound,
    contactInfoFound,
    garbledCharacterRatio: Math.round(garbledCharacterRatio * 1000) / 1000,
    privateUseGlyphCount,
    ligatureIssueCount,
    suspectedMultiColumn,
    suspectedTableLayout,
    suspectedHiddenText,
    isImageOnly,
    reasons,
    integrityFlags
  };
}

