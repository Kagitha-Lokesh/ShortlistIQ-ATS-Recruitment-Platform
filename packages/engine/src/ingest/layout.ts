import { PositionedTextItem, EvidenceLocation } from './types.js';

export interface ReconstructedLine {
  text: string;
  items: PositionedTextItem[];
  y: number;
  minX: number;
  maxX: number;
  height: number;
}

export interface ReconstructedPage {
  pageNumber: number;
  lines: ReconstructedLine[];
  isMultiColumn: boolean;
  isTable: boolean;
  hasHiddenText: boolean;
}

const LINE_Y_TOLERANCE = 3.5;
const MIN_COLUMN_GUTTER = 15.0;

/**
 * Reconstructs 2D positioned PDF items into natural reading order:
 * - Detects header, columns (e.g. sidebar + main content), and footer
 * - Preserves reading order: Header -> Left Column (top-down) -> Right Column (top-down) -> Footer
 * - Never joins multi-column lines horizontally across the page
 */
export function reconstructPageLayout(
  items: PositionedTextItem[],
  pageNumber = 1
): ReconstructedPage {
  if (!items || items.length === 0) {
    return {
      pageNumber,
      lines: [],
      isMultiColumn: false,
      isTable: false,
      hasHiddenText: false
    };
  }

  let hasHiddenText = false;
  const validItems: PositionedTextItem[] = [];

  for (const item of items) {
    if (item.fontSize < 3.0 && item.str.trim().length > 0) {
      hasHiddenText = true;
    }
    validItems.push(item);
  }

  // 1. Group items into physical horizontal lines based on Y coordinate
  const sortedByY = [...validItems].sort((a, b) => b.y - a.y);
  const rawLineBuckets: PositionedTextItem[][] = [];

  for (const item of sortedByY) {
    let placed = false;
    for (const bucket of rawLineBuckets) {
      const ref = bucket[0];
      if (Math.abs(ref.y - item.y) <= LINE_Y_TOLERANCE) {
        bucket.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) {
      rawLineBuckets.push([item]);
    }
  }

  // Sort each line bucket left to right (ascending X)
  for (const bucket of rawLineBuckets) {
    bucket.sort((a, b) => a.x - b.x);
  }

  // 2. Multi-column detection based on consistent horizontal gutters across lines
  interface LineGaps {
    y: number;
    gaps: Array<{ start: number; end: number; width: number }>;
  }

  const multiItemLines: LineGaps[] = [];
  for (const bucket of rawLineBuckets) {
    if (bucket.length >= 2) {
      const gaps: Array<{ start: number; end: number; width: number }> = [];
      for (let i = 0; i < bucket.length - 1; i++) {
        const leftItem = bucket[i];
        const rightItem = bucket[i + 1];
        const gapStart = leftItem.x + leftItem.width;
        const gapEnd = rightItem.x;
        const gapWidth = gapEnd - gapStart;
        if (gapWidth >= MIN_COLUMN_GUTTER) {
          gaps.push({ start: gapStart, end: gapEnd, width: gapWidth });
        }
      }
      if (gaps.length > 0) {
        multiItemLines.push({ y: bucket[0].y, gaps });
      }
    }
  }

  let isMultiColumn = false;
  let columnSplitX = 0;

  if (multiItemLines.length >= 2) {
    // Check if there is an overlapping gutter across lines
    const allGaps = multiItemLines.flatMap((l) => l.gaps);
    let bestOverlapCount = 0;
    let bestSplit = 0;

    for (const candidate of allGaps) {
      const mid = (candidate.start + candidate.end) / 2;
      let matchingLines = 0;

      for (const line of multiItemLines) {
        const hasMatchingGap = line.gaps.some(
          (g) => mid >= g.start - 5 && mid <= g.end + 5
        );
        if (hasMatchingGap) matchingLines++;
      }

      if (matchingLines > bestOverlapCount) {
        bestOverlapCount = matchingLines;
        bestSplit = mid;
      }
    }

    if (bestOverlapCount >= 2) {
      isMultiColumn = true;
      columnSplitX = bestSplit;
    }
  }

  const clusterItemsIntoLines = (groupItems: PositionedTextItem[]): ReconstructedLine[] => {
    if (groupItems.length === 0) return [];

    const sorted = [...groupItems].sort((a, b) => b.y - a.y);
    const lineBuckets: PositionedTextItem[][] = [];

    for (const item of sorted) {
      let placed = false;
      for (const bucket of lineBuckets) {
        const ref = bucket[0];
        if (Math.abs(ref.y - item.y) <= LINE_Y_TOLERANCE) {
          bucket.push(item);
          placed = true;
          break;
        }
      }
      if (!placed) {
        lineBuckets.push([item]);
      }
    }

    lineBuckets.sort((a, b) => b[0].y - a[0].y);

    const result: ReconstructedLine[] = [];
    for (const bucket of lineBuckets) {
      bucket.sort((a, b) => a.x - b.x);

      let lineText = '';
      let lMinX = Infinity;
      let lMaxX = -Infinity;
      let lMaxHeight = 0;

      for (let i = 0; i < bucket.length; i++) {
        const it = bucket[i];
        if (it.x < lMinX) lMinX = it.x;
        if (it.x + it.width > lMaxX) lMaxX = it.x + it.width;
        if (it.height > lMaxHeight) lMaxHeight = it.height;

        if (i > 0) {
          const prev = bucket[i - 1];
          const gap = it.x - (prev.x + prev.width);
          if (gap > 2.0 && !lineText.endsWith(' ') && !it.str.startsWith(' ')) {
            lineText += ' ';
          }
        }
        lineText += it.str;
      }

      result.push({
        text: lineText,
        items: bucket,
        y: bucket[0].y,
        minX: lMinX,
        maxX: lMaxX,
        height: lMaxHeight
      });
    }

    return result;
  };

  const lines: ReconstructedLine[] = [];

  if (isMultiColumn) {
    // Find highest Y and lowest Y of the column items
    const splitLines = multiItemLines.filter((l) =>
      l.gaps.some((g) => columnSplitX >= g.start - 5 && columnSplitX <= g.end + 5)
    );
    const topColumnY = Math.max(...splitLines.map((l) => l.y));
    const bottomColumnY = Math.min(...splitLines.map((l) => l.y));

    const headerItems: PositionedTextItem[] = [];
    const leftColItems: PositionedTextItem[] = [];
    const rightColItems: PositionedTextItem[] = [];
    const footerItems: PositionedTextItem[] = [];

    for (const it of validItems) {
      if (it.y > topColumnY + LINE_Y_TOLERANCE) {
        headerItems.push(it);
      } else if (it.y < bottomColumnY - LINE_Y_TOLERANCE) {
        footerItems.push(it);
      } else if (it.x + it.width <= columnSplitX + 5) {
        leftColItems.push(it);
      } else {
        rightColItems.push(it);
      }
    }

    const headerLines = clusterItemsIntoLines(headerItems);
    const leftLines = clusterItemsIntoLines(leftColItems);
    const rightLines = clusterItemsIntoLines(rightColItems);
    const footerLines = clusterItemsIntoLines(footerItems);

    lines.push(...headerLines, ...leftLines, ...rightLines, ...footerLines);
  } else {
    // Single column reading order
    lines.push(...clusterItemsIntoLines(validItems));
  }

  // Detect table layouts
  let isTable = false;
  if (lines.length >= 4) {
    let multiItemLineCount = 0;
    for (const l of lines) {
      if (l.items.length >= 3) multiItemLineCount++;
    }
    if (multiItemLineCount >= lines.length * 0.4) {
      isTable = true;
    }
  }

  return {
    pageNumber,
    lines,
    isMultiColumn,
    isTable,
    hasHiddenText
  };
}
