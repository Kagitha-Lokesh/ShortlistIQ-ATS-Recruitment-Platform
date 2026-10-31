export interface ParsedDateRange {
  startDate: Date;
  endDate: Date;
  startStr: string;
  endStr: string;
  isCurrent: boolean;
  durationMonths: number;
}

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11
};

const SEASON_MAP: Record<string, number> = {
  spring: 2, // March
  summer: 5, // June
  fall: 8,   // September
  autumn: 8,
  winter: 11 // December
};

const QUARTER_MAP: Record<string, number> = {
  q1: 0, // Jan
  q2: 3, // Apr
  q3: 6, // Jul
  q4: 9  // Oct
};

/**
 * Parses a single date token into a Date object
 */
export function parseSingleDate(token: string, isEnd = false): Date | null {
  const clean = token.trim().toLowerCase();
  if (!clean) return null;

  if (clean === 'present' || clean === 'current' || clean === 'now') {
    return new Date();
  }

  // 1. Check Month Year / Quarter / Season: e.g. "Jan 2021", "Q3 2019", "Summer 2018", "01/2021"
  const monthYearRegex = /^([a-z0-9]+)[\s\/-]+(\d{4})$/;
  const m1 = clean.match(monthYearRegex);
  if (m1) {
    let month = 0;
    const year = parseInt(m1[2], 10);
    const mStr = m1[1];

    if (MONTH_MAP[mStr] !== undefined) {
      month = MONTH_MAP[mStr];
    } else if (SEASON_MAP[mStr] !== undefined) {
      month = SEASON_MAP[mStr];
    } else if (QUARTER_MAP[mStr] !== undefined) {
      month = QUARTER_MAP[mStr];
    } else {
      const parsedM = parseInt(mStr, 10);
      if (!isNaN(parsedM) && parsedM >= 1 && parsedM <= 12) {
        month = parsedM - 1;
      }
    }

    const day = isEnd ? 28 : 1;
    return new Date(Date.UTC(year, month, day));
  }

  // 2. Check Year Month: e.g. "2021-01" or "2021/01"
  const yearMonthRegex = /^(\d{4})[\s\/-]+(\d{1,2})$/;
  const m2 = clean.match(yearMonthRegex);
  if (m2) {
    const year = parseInt(m2[1], 10);
    const month = Math.max(0, Math.min(11, parseInt(m2[2], 10) - 1));
    const day = isEnd ? 28 : 1;
    return new Date(Date.UTC(year, month, day));
  }

  // 3. Single Year: "2021"
  const yearRegex = /^(19\d\d|20[0-2]\d)$/;
  if (yearRegex.test(clean)) {
    const year = parseInt(clean, 10);
    return isEnd ? new Date(Date.UTC(year, 11, 31)) : new Date(Date.UTC(year, 0, 1));
  }

  return null;
}

/**
 * Parses date range string: e.g. "Jan 2021 - Present", "06/2019 to 08/2020", "2018-2022"
 */
export function parseDateRange(rangeText: string): ParsedDateRange | null {
  const parts = rangeText.split(/\s*(?:[-–—]+|\bto\b)\s*/i).map((s) => s.trim());
  if (parts.length < 2) return null;

  const startStr = parts[0];
  const endStr = parts[1];

  const startDate = parseSingleDate(startStr, false);
  const endDate = parseSingleDate(endStr, true);

  if (!startDate || !endDate) return null;
  if (endDate.getTime() < startDate.getTime()) return null;

  const isCurrent = /present|current|now/i.test(endStr);

  const months =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth()) +
    1;

  return {
    startDate,
    endDate,
    startStr,
    endStr,
    isCurrent,
    durationMonths: Math.max(1, months)
  };
}

/**
 * Merges overlapping date intervals so concurrent roles are NOT double counted.
 * Treats career gaps neutrally (no penalty).
 */
export function mergeOverlappingDateRanges(
  ranges: Array<{ startDate: Date; endDate: Date }>
): {
  mergedRanges: Array<{ startDate: Date; endDate: Date }>;
  totalMonths: number;
} {
  if (ranges.length === 0) {
    return { mergedRanges: [], totalMonths: 0 };
  }

  // Sort ranges by startDate ascending
  const sorted = [...ranges].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const merged: Array<{ startDate: Date; endDate: Date }> = [];

  for (const r of sorted) {
    if (merged.length === 0) {
      merged.push({ startDate: new Date(r.startDate), endDate: new Date(r.endDate) });
      continue;
    }

    const last = merged[merged.length - 1];
    // If current interval starts before or at the end of last interval (allowing 1 month overlap margin)
    if (r.startDate.getTime() <= last.endDate.getTime() + 31 * 24 * 60 * 60 * 1000) {
      if (r.endDate.getTime() > last.endDate.getTime()) {
        last.endDate = new Date(r.endDate);
      }
    } else {
      merged.push({ startDate: new Date(r.startDate), endDate: new Date(r.endDate) });
    }
  }

  let totalMonths = 0;
  for (const interval of merged) {
    const diffMonths =
      (interval.endDate.getFullYear() - interval.startDate.getFullYear()) * 12 +
      (interval.endDate.getMonth() - interval.startDate.getMonth()) +
      1;
    totalMonths += Math.max(1, diffMonths);
  }

  return {
    mergedRanges: merged,
    totalMonths
  };
}
