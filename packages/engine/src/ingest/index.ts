export * from './types.js';
export * from './layout.js';
export * from './normalizer.js';
export * from './integrity.js';
export * from './quality.js';

import { PositionedTextItem, IngestedResumeResult, EvidenceLocation } from './types.js';
import { reconstructPageLayout, ReconstructedPage } from './layout.js';
import { normalizeTextWithSourceMap } from './normalizer.js';
import { evaluateIntegrity } from './integrity.js';
import { produceParseQualityReport } from './quality.js';

/**
 * End-to-end ingestion pipeline for 2D positioned PDF items:
 * 1. Layout reconstruction (reading order, multi-column and table handling)
 * 2. Safe normalization with coordinate source map
 * 3. Adversarial integrity check & LLM sanitization
 * 4. Parse-quality report generation
 */
export function ingestResumeItems(pagesItems: PositionedTextItem[][]): IngestedResumeResult {
  const reconstructedPages: ReconstructedPage[] = [];
  const allItems: PositionedTextItem[] = [];

  for (let pIdx = 0; pIdx < pagesItems.length; pIdx++) {
    const pageNum = pIdx + 1;
    const items = pagesItems[pIdx] || [];
    // Stamp page number if not already present
    const stampedItems = items.map((it) => ({ ...it, page: it.page || pageNum }));
    allItems.push(...stampedItems);

    const pageLayout = reconstructPageLayout(stampedItems, pageNum);
    reconstructedPages.push(pageLayout);
  }

  // Combine lines from all pages
  const allLines = reconstructedPages.flatMap((p) => p.lines);

  // Normalize with coordinate source map
  const normalized = normalizeTextWithSourceMap(allLines);

  // Evaluate integrity (prompt injections, microscopic text, keyword stuffing)
  const integrity = evaluateIntegrity(normalized.text, allItems);

  // Produce Parse Quality Report
  const report = produceParseQualityReport({
    normalizedText: normalized.text,
    pages: reconstructedPages,
    allItems,
    ligatureIssueCount: normalized.ligatureIssueCount,
    integrityFlags: integrity.integrityFlags
  });

  return {
    rawText: allLines.map((l) => l.text).join('\n'),
    normalizedText: normalized.text,
    cleanedTextForLlm: integrity.cleanedTextForLlm,
    report,
    sourceMap: normalized.sourceMap
  };
}

/**
 * Fallback ingestion for raw text strings (e.g. pasted text or direct string input)
 */
export function ingestResumeText(rawText: string): IngestedResumeResult {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items: PositionedTextItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    items.push({
      str: lines[i],
      x: 50,
      y: 800 - i * 16,
      width: Math.min(500, lines[i].length * 7),
      height: 12,
      fontSize: 10,
      page: 1
    });
  }

  return ingestResumeItems([items]);
}

