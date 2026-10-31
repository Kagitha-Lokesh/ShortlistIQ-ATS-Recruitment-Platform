import { CandidateBasics } from '../basics/index.js';
import { ResumeSections } from '../sections/index.js';
import {
  ResumeData,
  ExperienceItem,
  EducationItem,
  SkillCategory,
  ProjectItem,
  CertificationItem
} from '@shortlistiq/shared';

export interface ConverterResult {
  data: ResumeData;
  isConfident: boolean;
  missingFields: string[];
}

/**
 * Normalizes bullets into standard array of highlight strings
 */
function extractHighlights(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 5)
    .map((line) => line.replace(/^[•*\-–—]\s*/, '').trim())
    .filter((line) => line.length > 0);
}

/**
 * Extracts structured experience entries from experience section text
 */
function parseExperienceEntries(text: string): ExperienceItem[] {
  if (!text || text.trim().length === 0) return [];

  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const entries: ExperienceItem[] = [];
  let currentEntry: Partial<ExperienceItem> | null = null;
  let currentHighlights: string[] = [];

  const datePattern = /(?:(20[0-2]\d|199\d)|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(?:20[0-2]\d|199\d)?)\s*[-–—to]+\s*(?:(20[0-2]\d|199\d|present|current)|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(?:20[0-2]\d|199\d)?)/i;

  for (const line of lines) {
    const isBullet = /^[•*\-–—]/.test(line);
    const hasDate = datePattern.test(line);
    const hasPipe = line.includes('|');

    // Header candidate (role title and company, e.g. "Senior Software Engineer | Apex Solutions (2020 - Present)")
    if (!isBullet && (hasDate || hasPipe || entries.length === 0 && !currentEntry)) {
      if (currentEntry) {
        currentEntry.highlights = currentHighlights;
        entries.push(currentEntry as ExperienceItem);
        currentHighlights = [];
      }

      let title = 'Software Engineer';
      let company = 'Company';
      let startDate = '2020';
      let endDate = 'Present';
      let current = true;

      // Extract dates if present
      const dateMatch = line.match(datePattern);
      if (dateMatch) {
        const fullDateStr = dateMatch[0];
        const parts = fullDateStr.split(/[-–—to]+/i).map((s) => s.trim());
        startDate = parts[0] || '2020';
        endDate = parts[1] || 'Present';
        current = /present|current/i.test(endDate);
      }

      // Extract title and company
      const cleanHeader = line
        .replace(datePattern, '')
        .replace(/[()]/g, '')
        .trim();

      if (cleanHeader.includes('|')) {
        const parts = cleanHeader.split('|').map((s) => s.trim());
        title = parts[0] || title;
        company = parts[1] || company;
      } else if (cleanHeader.includes(' at ')) {
        const parts = cleanHeader.split(' at ').map((s) => s.trim());
        title = parts[0] || title;
        company = parts[1] || company;
      } else if (cleanHeader.includes(' - ')) {
        const parts = cleanHeader.split(' - ').map((s) => s.trim());
        title = parts[0] || title;
        company = parts[1] || company;
      } else if (cleanHeader.length > 2) {
        title = cleanHeader;
      }

      currentEntry = {
        title,
        company,
        location: '',
        startDate,
        endDate,
        current,
        highlights: []
      };
    } else if (isBullet || currentEntry) {
      const cleanBullet = line.replace(/^[•*\-–—]\s*/, '').trim();
      if (cleanBullet.length > 0) {
        currentHighlights.push(cleanBullet);
      }
    }
  }

  if (currentEntry) {
    currentEntry.highlights = currentHighlights;
    entries.push(currentEntry as ExperienceItem);
  }

  // Fallback: If no structured headers were separated, treat lines as one job entry
  if (entries.length === 0 && lines.length > 0) {
    entries.push({
      title: 'Professional Experience',
      company: 'Organization',
      location: '',
      startDate: '',
      endDate: 'Present',
      current: true,
      highlights: extractHighlights(text)
    });
  }

  return entries;
}

/**
 * Extracts structured education entries from education section text
 */
function parseEducationEntries(text: string): EducationItem[] {
  if (!text || text.trim().length === 0) return [];

  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const entries: EducationItem[] = [];

  for (const line of lines) {
    if (line.length < 5) continue;

    let degree = 'Degree in Field';
    let institution = 'University / College';
    let endDate = '';

    const yearMatch = line.match(/\b(20[0-2]\d|199\d)\b/);
    if (yearMatch) {
      endDate = yearMatch[0];
    }

    const cleanLine = line.replace(/\b(20[0-2]\d|199\d)\b/g, '').replace(/[-–—()|]/g, ' ').trim();

    if (line.includes('|')) {
      const parts = line.split('|').map((s) => s.trim());
      degree = parts[0] || degree;
      institution = parts[1]?.replace(/\b(20[0-2]\d|199\d)\b.*$/, '').trim() || institution;
    } else if (line.includes(',')) {
      const parts = line.split(',').map((s) => s.trim());
      degree = parts[0] || degree;
      institution = parts[1]?.trim() || institution;
    } else {
      degree = cleanLine;
    }

    entries.push({
      degree,
      institution,
      location: '',
      startDate: '',
      endDate,
      highlights: []
    });
  }

  return entries.length > 0
    ? entries
    : [
        {
          degree: 'Bachelor of Science',
          institution: 'University',
          location: '',
          startDate: '',
          endDate: ''
        }
      ];
}

/**
 * Parses skills section into categories (e.g. Frontend, Backend, Tools)
 */
function parseSkillCategories(text: string): SkillCategory[] {
  if (!text || text.trim().length === 0) return [];

  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const categories: SkillCategory[] = [];

  for (const line of lines) {
    // Check for "Category: item1, item2, item3"
    const colonIndex = line.indexOf(':');
    if (colonIndex > 1 && colonIndex < 35) {
      const categoryName = line.slice(0, colonIndex).replace(/^[•*\-–—]\s*/, '').trim();
      const itemsString = line.slice(colonIndex + 1).trim();
      const items = itemsString
        .split(/[,•|/]+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 2);

      if (items.length > 0) {
        categories.push({
          category: categoryName,
          items
        });
      }
    } else {
      // Direct comma/bullet separated list
      const items = line
        .replace(/^[•*\-–—]\s*/, '')
        .split(/[,•|/]+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 2);

      if (items.length > 0) {
        categories.push({
          category: categories.length === 0 ? 'Technical Skills' : 'Additional Skills',
          items
        });
      }
    }
  }

  return categories.length > 0
    ? categories
    : [{ category: 'Core Skills', items: ['JavaScript', 'TypeScript', 'Software Engineering'] }];
}

/**
 * Converts parsed resume text, candidate basics, and accepted suggestions
 * into a structured, editable ResumeData object.
 */
export function convertParsedToResumeData(
  rawText: string,
  basics: CandidateBasics,
  sections: ResumeSections,
  acceptedSuggestions?: Array<{ originalText: string; proposedText: string; finalText?: string | null }>
): ConverterResult {
  // 1. Apply accepted/edited suggestions to sections
  let summaryText = sections.summary || '';
  let expText = sections.experience || '';
  let skillsText = sections.skills || '';
  let eduText = sections.education || '';
  let projText = sections.projects || '';
  let certText = sections.certifications || '';

  if (acceptedSuggestions && acceptedSuggestions.length > 0) {
    for (const s of acceptedSuggestions) {
      const replacement = s.finalText || s.proposedText;
      if (!s.originalText || !replacement) continue;

      if (summaryText.includes(s.originalText)) {
        summaryText = summaryText.replace(s.originalText, replacement);
      }
      if (expText.includes(s.originalText)) {
        expText = expText.replace(s.originalText, replacement);
      }
      if (skillsText.includes(s.originalText)) {
        skillsText = skillsText.replace(s.originalText, replacement);
      }
      if (eduText.includes(s.originalText)) {
        eduText = eduText.replace(s.originalText, replacement);
      }
      if (projText.includes(s.originalText)) {
        projText = projText.replace(s.originalText, replacement);
      }
    }
  }

  // 2. Parse Structured Sections
  const experience = parseExperienceEntries(expText);
  const education = parseEducationEntries(eduText);
  const skills = parseSkillCategories(skillsText);

  const projects: ProjectItem[] = projText.trim()
    ? [
        {
          name: 'Featured Projects',
          description: '',
          highlights: extractHighlights(projText)
        }
      ]
    : [];

  const certifications: CertificationItem[] = certText.trim()
    ? extractHighlights(certText).map((c) => ({ name: c, issuer: '', date: '' }))
    : [];

  const missingFields: string[] = [];
  if (!basics.name || basics.name === 'Candidate') missingFields.push('Candidate Name');
  if (basics.email === 'NO_EMAIL') missingFields.push('Email Address');
  if (experience.length === 0) missingFields.push('Work Experience');
  if (education.length === 0) missingFields.push('Education');

  const isConfident = missingFields.length === 0;

  const data: ResumeData = {
    contact: {
      fullName: basics.name || 'Candidate Name',
      email: basics.email,
      phone: basics.phone || '',
      location: '',
      linkedin: basics.links.linkedin || '',
      github: basics.links.github || '',
      website: basics.links.portfolio || ''
    },
    summary: summaryText.trim(),
    experience,
    education,
    skills,
    projects,
    certifications
  };

  return {
    data,
    isConfident,
    missingFields
  };
}
