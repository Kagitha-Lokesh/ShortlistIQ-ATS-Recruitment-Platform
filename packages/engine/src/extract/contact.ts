import { ContactInfo, ExtractedEmail, ExtractedPhone, ExtractedLink, EvidenceSnippet } from './types.js';

const EMAIL_TYPO_MAP: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'iclud.com': 'icloud.com'
};

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|\+\d{1,3}[-.\s]?\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g;
const URL_REGEX = /\bhttps?:\/\/[^\s<>"{}|\\^`]+|\bwww\.[^\s<>"{}|\\^`]+|\blinkedin\.com\/in\/[^\s<>"{}|\\^`]+|\bgithub\.com\/[^\s<>"{}|\\^`]+/gi;

/**
 * Extracts validated contact information with exact source snippets and typo warnings
 */
export function extractContactInfo(text: string, page = 1): ContactInfo {
  const lines = text.split('\n');

  // 1. Emails
  const emails: ExtractedEmail[] = [];
  const foundEmailMatches = text.match(EMAIL_REGEX) || [];

  for (const rawEmail of foundEmailMatches) {
    const cleanEmail = rawEmail.toLowerCase().trim();
    if (emails.some((e) => e.email === cleanEmail)) continue;

    const domain = cleanEmail.split('@')[1];
    let typoWarning: string | undefined;
    if (domain && EMAIL_TYPO_MAP[domain]) {
      typoWarning = `Possible typo in email domain '${domain}'. Did you mean '${EMAIL_TYPO_MAP[domain]}'?`;
    }

    const snippet = lines.find((l) => l.toLowerCase().includes(cleanEmail)) || cleanEmail;

    emails.push({
      email: cleanEmail,
      isValid: Boolean(domain && domain.includes('.')),
      typoWarning,
      confidence: typoWarning ? 0.75 : 0.98,
      evidence: { page, snippet: snippet.trim() }
    });
  }

  // 2. Phones
  const phones: ExtractedPhone[] = [];
  const phoneMatches = text.match(PHONE_REGEX) || [];

  for (const rawPhone of phoneMatches) {
    const clean = rawPhone.trim();
    if (phones.some((p) => p.phone === clean)) continue;

    // Filter out date ranges like 2020-2024 that might falsely trigger
    if (/^(19|20)\d\d[-–—](19|20)\d\d$/.test(clean.replace(/\s+/g, ''))) continue;

    const snippet = lines.find((l) => l.includes(clean)) || clean;
    phones.push({
      phone: clean,
      confidence: 0.95,
      evidence: { page, snippet: snippet.trim() }
    });
  }

  // 3. Links
  const links: ExtractedLink[] = [];
  const rawUrls = text.match(URL_REGEX) || [];

  for (const rawUrl of rawUrls) {
    const cleaned = rawUrl.replace(/[.,;)]+$/, '');
    if (links.some((l) => l.url === cleaned)) continue;

    let platform: 'linkedin' | 'github' | 'portfolio' | 'other' = 'other';
    if (/linkedin\.com\/in\//i.test(cleaned)) platform = 'linkedin';
    else if (/github\.com\//i.test(cleaned)) platform = 'github';
    else if (/portfolio|vercel\.app|netlify\.app|github\.io/i.test(cleaned)) platform = 'portfolio';

    const fullUrl = cleaned.startsWith('http') ? cleaned : `https://${cleaned}`;
    const snippet = lines.find((l) => l.includes(cleaned)) || cleaned;

    links.push({
      url: fullUrl,
      platform,
      confidence: 0.95,
      evidence: { page, snippet: snippet.trim() }
    });
  }

  // 4. Location extraction (Stored, but marked for scoring exclusion)
  let locationValue: string | null = null;
  let locationSnippet: string | null = null;

  // Search first 8 lines for location clues (City, State / Country)
  const locationPattern = /\b([A-Z][a-zA-Z\s]+,\s*[A-Z]{2}\b|[A-Z][a-zA-Z\s]+,\s*(?:India|USA|United States|UK|Canada|Germany|Australia|Singapore|Remote)\b)/i;
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const l = lines[i];
    const locM = l.match(locationPattern);
    if (locM) {
      locationValue = locM[0].trim();
      locationSnippet = l.trim();
      break;
    }
  }

  return {
    emails,
    primaryEmail: emails[0]?.email || null,
    phones,
    primaryPhone: phones[0]?.phone || null,
    links,
    location: {
      value: locationValue,
      confidence: locationValue ? 0.85 : 0.0,
      evidence: locationSnippet ? { page, snippet: locationSnippet } : null
    }
  };
}

