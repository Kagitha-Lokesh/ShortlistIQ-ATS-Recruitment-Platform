import { PositionedTextItem, EvidenceLocation } from './types.js';
import { ReconstructedLine } from './layout.js';

export interface NormalizedResult {
  text: string;
  sourceMap: Array<EvidenceLocation | null>;
  ligatureIssueCount: number;
}

const LIGATURE_MAP: Record<string, string> = {
  '\uFB00': 'ff',
  '\uFB01': 'fi',
  '\uFB02': 'fl',
  '\uFB03': 'ffi',
  '\uFB04': 'ffl',
  '\uFB05': 'ft',
  '\uFB06': 'st',
  'æ': 'ae',
  'Æ': 'AE',
  'œ': 'oe',
  'Œ': 'OE'
};

const BULLET_PATTERN = /[\u2022\u2023\u25E6\u2043\u2219\u25AA\u25AB\u25CF\u25CB\u25B6\u25C6\u27A2\u279C\u27A4\u204c\u204d]/g;
const SMART_QUOTES_DOUBLE = /[\u201C\u201D\u201E\u00AB\u00BB\u201F]/g;
const SMART_QUOTES_SINGLE = /[\u2018\u2019\u201A\u201B\u2039\u203A]/g;
const DASHES = /[\u2013\u2014\u2015\u2212]/g;

/**
 * Normalizes text extracted from resumes while preserving verbatim character-to-coordinate mapping:
 * - Ligature unrolling (fi, fl, ffi, etc.)
 * - Smart quotes, dashes, and bullet points
 * - NFKC unicode normalization
 * - Collapsing spaced-out terms (e.g. "P Y T H O N" -> "PYTHON")
 * - Un-hyphenating line breaks ("devel-\noper" -> "developer")
 */
export function normalizeTextWithSourceMap(lines: ReconstructedLine[]): NormalizedResult {
  let ligatureCount = 0;
  const chars: string[] = [];
  const locations: Array<EvidenceLocation | null> = [];

  for (let lIdx = 0; lIdx < lines.length; lIdx++) {
    const line = lines[lIdx];

    for (let itIdx = 0; itIdx < line.items.length; itIdx++) {
      const it = line.items[itIdx];
      const str = it.str;
      const charWidth = it.str.length > 0 ? it.width / it.str.length : it.width;

      for (let cIdx = 0; cIdx < str.length; cIdx++) {
        const rawChar = str[cIdx];
        const charBox: EvidenceLocation = {
          page: it.page,
          x: it.x + cIdx * charWidth,
          y: it.y,
          width: charWidth,
          height: it.height
        };

        // Check ligatures
        if (LIGATURE_MAP[rawChar]) {
          ligatureCount++;
          const replacement = LIGATURE_MAP[rawChar];
          for (let r = 0; r < replacement.length; r++) {
            chars.push(replacement[r]);
            locations.push(charBox);
          }
        } else {
          chars.push(rawChar);
          locations.push(charBox);
        }
      }

      // Add a space between horizontal items in the same line if gap exists
      if (itIdx < line.items.length - 1) {
        const nextIt = line.items[itIdx + 1];
        if (nextIt.x - (it.x + it.width) > 2.0) {
          chars.push(' ');
          locations.push(null);
        }
      }
    }

    // Add newline at end of line
    chars.push('\n');
    locations.push(null);
  }

  // Join into raw string
  let text = chars.join('');
  let map = locations;

  // 1. Standard Unicode NFKC Normalization
  try {
    const nfkc = text.normalize('NFKC');
    if (nfkc.length === text.length) {
      text = nfkc;
    }
  } catch {
    // Fallback gracefully
  }

  // 2. Normalize smart quotes, dashes, bullets
  text = text
    .replace(SMART_QUOTES_DOUBLE, '"')
    .replace(SMART_QUOTES_SINGLE, "'")
    .replace(DASHES, '-')
    .replace(BULLET_PATTERN, '• ')
    .replace(/(^|\n)\s*[-*–—]\s+/g, '$1• ');

  // 3. Un-hyphenate words broken across line ends (e.g. "architec-\nture" -> "architecture")
  const hyphenRegex = /(\b[a-zA-Z]{2,})-\n\s*([a-zA-Z]{2,}\b)/g;
  let match: RegExpExecArray | null;
  while ((match = hyphenRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const combined = match[1] + match[2];
    const startIndex = match.index;
    const deleteCount = fullMatch.length;

    text = text.slice(0, startIndex) + combined + text.slice(startIndex + deleteCount);
    // Splice coordinate map to match
    const newLocs = map.slice(startIndex, startIndex + match[1].length).concat(
      map.slice(startIndex + match[1].length + 2, startIndex + deleteCount)
    );
    map.splice(startIndex, deleteCount, ...newLocs);
    hyphenRegex.lastIndex = startIndex + combined.length;
  }

  // 4. Collapse spaced-out words (e.g., "P Y T H O N" -> "PYTHON")
  const spacedWordRegex = /\b([A-Za-z])\s+([A-Za-z])\s+([A-Za-z])(?:\s+([A-Za-z]))*(?:\s+([A-Za-z]))*\b/g;
  while ((match = spacedWordRegex.exec(text)) !== null) {
    const originalSpaced = match[0];
    // Check if it's not normal single letter words like "a I am"
    const collapsed = originalSpaced.replace(/\s+/g, '');
    if (collapsed.length >= 3 && /^[A-Z0-9]+$/i.test(collapsed)) {
      const startIndex = match.index;
      text = text.slice(0, startIndex) + collapsed + text.slice(startIndex + originalSpaced.length);

      const updatedLocs: Array<EvidenceLocation | null> = [];
      let c = 0;
      for (let i = 0; i < originalSpaced.length; i++) {
        if (originalSpaced[i] !== ' ') {
          updatedLocs.push(map[startIndex + i] || null);
          c++;
        }
      }
      map.splice(startIndex, originalSpaced.length, ...updatedLocs);
      spacedWordRegex.lastIndex = startIndex + collapsed.length;
    }
  }

  // 5. Clean up extra whitespace safely
  text = text.replace(/[^\S\r\n]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  return {
    text,
    sourceMap: map,
    ligatureIssueCount: ligatureCount
  };
}

