import { SKILL_DICTIONARY } from '../skills/index.js';

// Ambiguous short tokens that must NOT match casual English words
export const AMBIGUOUS_SHORT_TOKENS = new Set(['c', 'r', 'go', 'next', 'rest', 'git', 'vue']);

export const DISTINCT_SKILL_PAIRS = [
  ['Java', 'JavaScript'],
  ['C', 'C++'],
  ['C', 'C#'],
  ['C++', 'C#'],
  ['SQL', 'NoSQL'],
  ['React', 'React Native']
];

/**
 * Validates whether an alias match occurs in a legitimate skill context,
 * specifically guarding against short English words ("go", "r", "c").
 */
export function isSkillContextMatch(text: string, term: string, matchIndex: number): boolean {
  const lowerTerm = term.toLowerCase();

  // If not ambiguous, standard word boundary check suffices
  if (!AMBIGUOUS_SHORT_TOKENS.has(lowerTerm)) {
    return true;
  }

  // Ambiguous tokens require strict contextual guards
  const windowStart = Math.max(0, matchIndex - 25);
  const windowEnd = Math.min(text.length, matchIndex + term.length + 25);
  const context = text.slice(windowStart, windowEnd).toLowerCase();

  switch (lowerTerm) {
    case 'go': {
      // Must be paired with language/developer/golang or in technical skills list
      return (
        /\b(golang|go\s*lang|go\s+language|go\s+developer|go\s+code|go\s+backend)\b/i.test(context) ||
        /[/,•|]\s*go\s*[/,•|]/i.test(context) ||
        /languages?\s*:.*?\bgo\b/i.test(context)
      );
    }
    case 'c': {
      // Must be "C/C++", "C and C++", "C programming", "C language", "embedded C"
      return (
        /\bc\s*\/\s*c\+\+/i.test(context) ||
        /\bc\s+and\s+c\+\+/i.test(context) ||
        /\b(c\s+programming|c\s+language|embedded\s+c|ansi\s+c)\b/i.test(context) ||
        /languages?\s*:.*?\bc\b/i.test(context)
      );
    }
    case 'r': {
      // Must be "R programming", "R language", "R/Python", "R studio"
      return (
        /\b(r\s+programming|r\s+language|r\s+stats|r\s*studio|r\s*\/\s*python)\b/i.test(context) ||
        /languages?\s*:.*?\br\b/i.test(context)
      );
    }
    case 'rest': {
      return /\b(rest\s+api|restful|rest\s+services|rest\s+endpoints)\b/i.test(context);
    }
    case 'next': {
      return /\b(next\.?js|nextjs)\b/i.test(context);
    }
    default:
      return true;
  }
}

