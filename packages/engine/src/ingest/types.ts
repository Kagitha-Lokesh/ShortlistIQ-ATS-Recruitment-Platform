export type ParseStatus = 'OK' | 'PARTIAL' | 'UNREADABLE';

export interface PositionedTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily?: string;
  page: number; // 1-indexed
  dir?: 'ltr' | 'rtl' | 'ttb';
  hasEOL?: boolean;
}

export interface EvidenceLocation {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IntegrityFlag {
  type: 'KEYWORD_STUFFING' | 'INVISIBLE_TEXT' | 'PROMPT_INJECTION';
  severity: 'low' | 'medium' | 'high';
  details: string;
  snippets: string[];
}

export interface ParseQualityReport {
  status: ParseStatus;
  characterCount: number;
  wordCount: number;
  pageCount: number;
  language: string;
  sectionsFound: string[];
  contactInfoFound: {
    email: boolean;
    phone: boolean;
    linksCount: number;
  };
  garbledCharacterRatio: number;
  privateUseGlyphCount: number;
  ligatureIssueCount: number;
  suspectedMultiColumn: boolean;
  suspectedTableLayout: boolean;
  suspectedHiddenText: boolean;
  isImageOnly: boolean;
  reasons: string[];
  integrityFlags: IntegrityFlag[];
}

export interface IngestedResumeResult {
  rawText: string;
  normalizedText: string;
  cleanedTextForLlm: string;
  report: ParseQualityReport;
  sourceMap: Array<EvidenceLocation | null>;
}

