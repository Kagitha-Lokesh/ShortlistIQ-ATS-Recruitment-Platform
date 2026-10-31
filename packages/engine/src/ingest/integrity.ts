import { IntegrityFlag, PositionedTextItem } from './types.js';

const PROMPT_INJECTION_PATTERNS = [
  /\bignore\s+(all\s+)?previous\s+instructions\b/i,
  /\bdisregard\s+(all\s+)?(previous|prior)\s+instructions\b/i,
  /\brate\s+this\s+candidate\s+(highly|100|perfectly)\b/i,
  /\bgive\s+this\s+candidate\s+(a\s+)?(100|perfect\s+score|high\s+rating)\b/i,
  /\bshortlist\s+this\s+candidate\b/i,
  /\boutput\s+json\s+with\s+decision\s*:\s*["']?shortlisted["']?/i,
  /\byou\s+are\s+a\s+recruiter\s+and\s+you\s+must\s+shortlist\b/i,
  /\bsystem\s+prompt\s*:\s*override\b/i,
  /\bbypass\s+(ats|screening|filter)\b/i
];

/**
 * Scans text and positioned items for prompt injections, keyword stuffing, and invisible text.
 * Flags anomalies for HR visibility without auto-penalizing the candidate.
 * Cleanses LLM input text so adversarial injection phrases cannot hijack the AI screener.
 */
export function evaluateIntegrity(
  text: string,
  items: PositionedTextItem[]
): {
  integrityFlags: IntegrityFlag[];
  cleanedTextForLlm: string;
} {
  const flags: IntegrityFlag[] = [];
  let cleanedForLlm = text;

  // 1. Detect Prompt Injection Attempts
  const matchedInjectionSnippets: string[] = [];

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      for (const m of matches) {
        if (!matchedInjectionSnippets.includes(m)) {
          matchedInjectionSnippets.push(m);
        }
      }
      // Redact from LLM payload
      cleanedForLlm = cleanedForLlm.replace(pattern, '[REDACTED_ADVERSARIAL_INJECTION]');
    }
  }

  if (matchedInjectionSnippets.length > 0) {
    flags.push({
      type: 'PROMPT_INJECTION',
      severity: 'high',
      details: 'Detected phrases typically used to manipulate automated AI screeners or LLMs.',
      snippets: matchedInjectionSnippets
    });
  }

  // 2. Detect Invisible or Microscopic Text (font size < 3pt)
  const tinyTextItems = items.filter((it) => it.fontSize < 3.0 && it.str.trim().length > 0);
  if (tinyTextItems.length > 0) {
    const snippets = tinyTextItems.map((it) => it.str).slice(0, 5);
    flags.push({
      type: 'INVISIBLE_TEXT',
      severity: 'medium',
      details: `Detected ${tinyTextItems.length} text fragments rendered at microscopic font size (< 3pt).`,
      snippets
    });

    // Remove microscopic text from LLM input
    for (const item of tinyTextItems) {
      if (item.str.trim().length > 2) {
        cleanedForLlm = cleanedForLlm.replace(item.str, '');
      }
    }
  }

  // 3. Detect Keyword Stuffing (e.g. term repeated > 8 times in rapid succession)
  const words = text.toLowerCase().match(/\b[a-z0-9+#.]{2,}\b/g) || [];
  const wordFreq: Record<string, number> = {};
  for (const w of words) {
    // Ignore common stop words
    if (/^(and|the|for|with|from|this|that|have|been|were|will|more)$/.test(w)) continue;
    wordFreq[w] = (wordFreq[w] || 0) + 1;
  }

  const stuffedTerms: string[] = [];
  for (const [w, count] of Object.entries(wordFreq)) {
    // If a non-trivial term appears more than 15 times, check if it occurs in high-density blocks
    if (count >= 15 && w.length >= 3) {
      const repeatedRegex = new RegExp(`(\\b${w}\\b[^a-z0-9]*){4,}`, 'gi');
      if (repeatedRegex.test(text)) {
        stuffedTerms.push(`${w} (${count}x)`);
      }
    }
  }

  if (stuffedTerms.length > 0) {
    flags.push({
      type: 'KEYWORD_STUFFING',
      severity: 'low',
      details: 'Detected unusually dense repetition of technical terms without descriptive context.',
      snippets: stuffedTerms
    });
  }

  return {
    integrityFlags: flags,
    cleanedTextForLlm: cleanedForLlm
  };
}

