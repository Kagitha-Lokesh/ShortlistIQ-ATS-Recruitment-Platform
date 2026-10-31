export interface ReadabilityMetrics {
  score: number; // 0 - 100
  readingEase: number;
  averageSentenceLength: number;
  wordCount: number;
  sentenceCount: number;
}

function countSyllables(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!clean || clean.length <= 2) return 1;

  // Simple syllable count heuristic
  const vowels = clean.match(/[aeiouy]{1,2}/g);
  let count = vowels ? vowels.length : 1;

  if (clean.endsWith('e') && !clean.endsWith('le') && count > 1) {
    count--;
  }
  return Math.max(1, count);
}

/**
 * Calculates deterministic readability score based on Flesch Reading Ease
 * and professional sentence structure suited for resumes.
 */
export function calculateReadability(text: string): ReadabilityMetrics {
  const sentences = text
    .split(/(?:[.!?]+(?:\s+|$))|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  const words = text
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);

  const wordCount = words.length;
  const sentenceCount = Math.max(1, sentences.length);

  if (wordCount < 10) {
    return {
      score: 30,
      readingEase: 30,
      averageSentenceLength: wordCount,
      wordCount,
      sentenceCount
    };
  }

  const averageSentenceLength = wordCount / sentenceCount;

  let totalSyllables = 0;
  for (const word of words) {
    totalSyllables += countSyllables(word);
  }

  const syllablesPerWord = totalSyllables / wordCount;

  // Flesch Reading Ease formula
  // Score = 206.835 - (1.015 * ASL) - (84.6 * ASW)
  const readingEase = Math.round(
    206.835 - 1.015 * averageSentenceLength - 84.6 * syllablesPerWord
  );

  // Resume readability is optimal when reading ease is 20-75 (professional tech resumes contain multi-syllable domain terms)
  let score = 85;
  if (averageSentenceLength > 32) {
    score -= 15; // Run-on sentences
  } else if (averageSentenceLength < 4) {
    score -= 10; // Too fragmented
  }

  if (readingEase < 15) {
    score -= 20; // Overly dense or impenetrable
  } else if (readingEase > 90) {
    score -= 10; // Overly simplistic
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    readingEase: Math.min(100, Math.max(0, readingEase)),
    averageSentenceLength: Math.round(averageSentenceLength * 10) / 10,
    wordCount,
    sentenceCount
  };
}
