const STOP_WORDS = new Set([
  'a', 'about', 'above', 'across', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'cannot', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for',
  'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him',
  'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more',
  'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other',
  'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such',
  'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what',
  'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours',
  'yourself', 'yourselves', 'will', 'role', 'work', 'working', 'job', 'team', 'company', 'candidate',
  'required', 'preferred', 'experience', 'responsible', 'looking', 'join', 'opportunity', 'skills',
  'ability', 'including', 'knowledge', 'environment', 'high', 'quality', 'solutions', 'collaborate',
  'building', 'help', 'scale', 'department', 'location', 'remote', 'seeking', 'hands', 'lead',
  'closely', 'familiarity', 'strong', 'deep', 'overview', 'plus', 'nice', 'key', 'requirements',
  'qualifications', 'responsibilities', 'duties', 'ideal', 'passionate', 'years', 'year', 'modern'
]);

/**
 * Light stemmer for common English inflections in resumes and job descriptions.
 */
export function stem(word: string): string {
  return word
    .toLowerCase()
    .replace(/(?:ing|tion|tions|ment|ments|ies|ied|ed|es|s|ly|ive|al|ity)$/, '')
    .trim();
}

/**
 * Tokenizes text into normalized words, splitting on hyphens and punctuation.
 * Filters out stop words, purely numeric tokens (e.g. "4+", "2020"), and single characters.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    // Replace hyphens, slashes, and underscores with space so "full-stack", "ci/cd", "hands-on" split
    .replace(/[-/\\_]/g, ' ')
    // Keep alphanumeric and special tech markers like + and #
    .replace(/[^a-z0-9+#.]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[-.]+|[-.]+$/g, ''))
    // Strip trailing .js for matching (e.g. express.js -> express)
    .map((w) => w.endsWith('.js') && w.length > 3 ? w.slice(0, -3) : w)
    // Filter out purely numeric tokens (e.g. 4, 4+, 2024), single chars, and stop words
    .filter((w) => w.length >= 2 && !/^\d+\+?$/.test(w) && !STOP_WORDS.has(w));
}

/**
 * Computes frequency map for token list
 */
export function computeTermFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  return tf;
}

export interface TfIdfResult {
  score: number; // 0 - 100
  matchedKeywords: string[];
  missingKeywords: string[];
}

/**
 * Calculates deterministic TF-IDF weighted overlap between resume and job description.
 * Pure framework-free TypeScript.
 */
export function calculateTfIdfMatch(resumeText: string, jdText: string): TfIdfResult {
  const resumeTokens = tokenize(resumeText);
  const jdtokens = tokenize(jdText);

  if (jdtokens.length === 0 || resumeTokens.length === 0) {
    return { score: 0, matchedKeywords: [], missingKeywords: [] };
  }

  const resumeTf = computeTermFrequency(resumeTokens);
  const jdTf = computeTermFrequency(jdtokens);

  // Build stem lookup map for resume tokens
  const resumeStemMap = new Map<string, string>();
  for (const token of resumeTokens) {
    const s = stem(token);
    if (s.length >= 3 && !resumeStemMap.has(s)) {
      resumeStemMap.set(s, token);
    }
  }

  // Extract top JD significant keywords by frequency (up to 40 salient terms)
  const sortedJdTerms = Array.from(jdTf.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40);

  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  let totalJdWeight = 0;
  let matchedWeight = 0;

  for (const [term, freq] of sortedJdTerms) {
    // Term weight in JD (sublinear TF scaling)
    const weight = 1 + Math.log(freq);
    totalJdWeight += weight;

    const termStem = stem(term);
    const hasDirectMatch = resumeTf.has(term);
    const hasStemMatch = termStem.length >= 3 && resumeStemMap.has(termStem);

    if (hasDirectMatch || hasStemMatch) {
      matchedKeywords.push(term);
      matchedWeight += weight;
    } else {
      missingKeywords.push(term);
    }
  }

  const score = totalJdWeight > 0 ? Math.round((matchedWeight / totalJdWeight) * 100) : 0;

  return {
    score: Math.min(100, Math.max(0, score)),
    matchedKeywords,
    missingKeywords
  };
}
