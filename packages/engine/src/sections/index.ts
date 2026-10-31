export interface ResumeSections {
  summary: string;
  experience: string;
  skills: string;
  education: string;
  projects: string;
  certifications: string;
  other: string;
}

interface SectionDefinition {
  key: keyof Omit<ResumeSections, 'other'>;
  patterns: RegExp[];
}

const SECTION_DEFINITIONS: SectionDefinition[] = [
  {
    key: 'summary',
    patterns: [
      /^(professional\s+)?summary$/i,
      /^(career\s+)?objective$/i,
      /^about(\s+me)?$/i,
      /^profile$/i,
      /^(personal\s+)?statement$/i,
      /^executive\s+summary$/i
    ]
  },
  {
    key: 'experience',
    patterns: [
      /^(work\s+|professional\s+|employment\s+|career\s+)?experience$/i,
      /^(work|employment|career)\s+history$/i,
      /^professional\s+background$/i,
      /^positions\s+held$/i
    ]
  },
  {
    key: 'skills',
    patterns: [
      /^(technical\s+|key\s+|core\s+)?skills$/i,
      /^technologies(\s+and\s+tools)?$/i,
      /^tech(nical)?\s+stack$/i,
      /^(core\s+|key\s+)?competencies(\s+and\s+skills)?$/i,
      /^proficiencies$/i,
      /^tools(\s+and\s+technologies)?$/i
    ]
  },
  {
    key: 'education',
    patterns: [
      /^education(al\s+background)?$/i,
      /^academic\s+(history|background|qualifications)$/i,
      /^degrees(\s+and\s+credentials)?$/i,
      /^qualifications$/i
    ]
  },
  {
    key: 'projects',
    patterns: [
      /^(key\s+|featured\s+|personal\s+|academic\s+)?projects$/i,
      /^open\s+source(\s+contributions)?$/i,
      /^portfolio(\s+projects)?$/i
    ]
  },
  {
    key: 'certifications',
    patterns: [
      /^(licenses\s+and\s+)?certifications?$/i,
      /^certificates?$/i,
      /^credentials$/i,
      /^accreditations$/i,
      /^training(\s+and\s+certifications)?$/i
    ]
  }
];

function isHeadingLine(line: string): keyof ResumeSections | null {
  const clean = line
    .replace(/^[\d#*•\-_\s:]+|[:\s#*•\-_]+$/g, '')
    .trim();

  if (!clean || clean.length > 45) return null;

  for (const def of SECTION_DEFINITIONS) {
    if (def.patterns.some((pattern) => pattern.test(clean))) {
      return def.key;
    }
  }

  return null;
}

/**
 * Segments resume text into distinct sections based on semantic heading synonyms.
 * Framework-free pure TypeScript.
 */
export function segmentSections(text: string): ResumeSections {
  const sections: ResumeSections = {
    summary: '',
    experience: '',
    skills: '',
    education: '',
    projects: '',
    certifications: '',
    other: ''
  };

  const lines = text.split('\n');
  let currentSection: keyof ResumeSections = 'other';
  const accumulators: Record<keyof ResumeSections, string[]> = {
    summary: [],
    experience: [],
    skills: [],
    education: [],
    projects: [],
    certifications: [],
    other: []
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const detectedHeading = isHeadingLine(trimmed);
    if (detectedHeading) {
      currentSection = detectedHeading;
      continue;
    }

    accumulators[currentSection].push(trimmed);
  }

  // If initial lines (before any heading) were in 'other', check if they resemble a summary
  if (accumulators.other.length > 0 && accumulators.summary.length === 0) {
    const firstLines = accumulators.other.slice(0, 5).join(' ');
    if (firstLines.length > 100) {
      sections.summary = firstLines;
      accumulators.other = accumulators.other.slice(5);
    }
  }

  for (const key of Object.keys(accumulators) as Array<keyof ResumeSections>) {
    sections[key] = (sections[key] ? sections[key] + '\n' : '') + accumulators[key].join('\n');
  }

  return sections;
}
