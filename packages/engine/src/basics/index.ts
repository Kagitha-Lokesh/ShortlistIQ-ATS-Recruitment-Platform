export interface CandidateBasics {
  name: string | null;
  email: string | 'NO_EMAIL';
  phone: string | null;
  links: {
    linkedin: string | null;
    github: string | null;
    portfolio: string | null;
    all: string[];
  };
}

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|\+\d{1,3}[-.\s]?\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/;
const URL_REGEX = /\bhttps?:\/\/[^\s<>"{}|\\^`]+|\bwww\.[^\s<>"{}|\\^`]+|\blinkedin\.com\/in\/[^\s<>"{}|\\^`]+|\bgithub\.com\/[^\s<>"{}|\\^`]+/gi;

const HEADER_IGNORE_PATTERNS = [
  /^(resume|curriculum vitae|cv|page \d+|profile|personal info)/i,
  /^contact/i,
  /^phone|email|address/i
];

/**
 * Extracts candidate name, email, phone, and links from resume text.
 * Pure framework-free implementation with no Node-only APIs.
 */
export function extractBasics(text: string): CandidateBasics {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // 1. Email extraction
  const emailMatch = text.match(EMAIL_REGEX);
  const email = emailMatch ? emailMatch[0].toLowerCase() : 'NO_EMAIL';

  // 2. Phone extraction
  const phoneMatch = text.match(PHONE_REGEX);
  const phone = phoneMatch ? phoneMatch[0].trim() : null;

  // 3. Links extraction
  let linkedin: string | null = null;
  let github: string | null = null;
  let portfolio: string | null = null;
  const allLinks: string[] = [];

  const rawMatches = text.match(URL_REGEX) || [];
  for (const rawUrl of rawMatches) {
    const cleaned = rawUrl.replace(/[.,;)]+$/, '');
    if (!allLinks.includes(cleaned)) {
      allLinks.push(cleaned);
    }

    if (/linkedin\.com\/in\//i.test(cleaned) && !linkedin) {
      linkedin = cleaned.startsWith('http') ? cleaned : `https://${cleaned}`;
    } else if (/github\.com\//i.test(cleaned) && !github) {
      github = cleaned.startsWith('http') ? cleaned : `https://${cleaned}`;
    } else if (!portfolio && !/linkedin|github/i.test(cleaned)) {
      portfolio = cleaned.startsWith('http') ? cleaned : `https://${cleaned}`;
    }
  }

  // 4. Name extraction from first 5 lines
  let name: string | null = null;
  for (let i = 0; i < Math.min(6, lines.length); i++) {
    const line = lines[i];

    // Skip lines with email or URL
    if (EMAIL_REGEX.test(line) || URL_REGEX.test(line) || PHONE_REGEX.test(line)) {
      continue;
    }

    // Skip lines matching header keywords
    if (HEADER_IGNORE_PATTERNS.some((pat) => pat.test(line))) {
      continue;
    }

    // A valid name typically has 2 to 4 capitalized words, length 3 to 40 characters
    const words = line.split(/\s+/);
    if (
      words.length >= 2 &&
      words.length <= 4 &&
      line.length >= 3 &&
      line.length <= 40 &&
      /^[A-Za-zÀ-ÖØ-öø-ÿ'.\s-]+$/.test(line)
    ) {
      name = line;
      break;
    }
  }

  return {
    name,
    email,
    phone,
    links: {
      linkedin,
      github,
      portfolio,
      all: allLinks
    }
  };
}

/**
 * Validates whether raw extracted text meets the readable character threshold (~200 characters).
 * Framework-free pure TypeScript usable in browser live previews and node.
 */
export function validateResumeText(text: string): { isValid: boolean; error?: string } {
  const trimmed = text.trim();
  const readable = (trimmed.match(/[a-zA-Z0-9]/g) || []).length;
  if (!trimmed || readable < 200) {
    return {
      isValid: false,
      error: 'Resume contains no extractable text or is an image-only scan. Please upload a text-based PDF.'
    };
  }
  return { isValid: true };
}

export const validateExtractedText = validateResumeText;

