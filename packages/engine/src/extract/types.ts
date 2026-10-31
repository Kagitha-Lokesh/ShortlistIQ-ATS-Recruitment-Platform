import { EvidenceLocation } from '../ingest/types.js';

export interface EvidenceSnippet {
  page: number;
  snippet: string;
  boundingBox?: EvidenceLocation;
}

export interface ProfileField<T> {
  value: T | null;
  confidence: number; // 0.0 to 1.0 (0.0 if not found / null)
  evidence: EvidenceSnippet | null;
  llmAssisted?: boolean;
}

export interface ExtractedEmail {
  email: string;
  isValid: boolean;
  typoWarning?: string;
  confidence: number;
  evidence: EvidenceSnippet;
}

export interface ExtractedPhone {
  phone: string;
  confidence: number;
  evidence: EvidenceSnippet;
}

export interface ExtractedLink {
  url: string;
  platform: 'linkedin' | 'github' | 'portfolio' | 'other';
  confidence: number;
  evidence: EvidenceSnippet;
}

export interface ContactInfo {
  emails: ExtractedEmail[];
  primaryEmail: string | null;
  phones: ExtractedPhone[];
  primaryPhone: string | null;
  links: ExtractedLink[];
  location: ProfileField<string>; // Stored but excluded from scoring payloads
}

export interface ExperienceItem {
  employer: ProfileField<string>;
  rawTitle: string;
  normalizedTitle: ProfileField<string>;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  durationMonths: number;
  type: 'full-time' | 'internship' | 'freelance' | 'contract' | 'unknown';
  bullets: Array<{
    text: string;
    technologies: string[];
    evidence: EvidenceSnippet;
  }>;
  confidence: number;
  evidence: EvidenceSnippet | null;
}

export type DegreeLevel = 'high_school' | 'associate' | 'bachelor' | 'master' | 'doctorate' | 'other';

export interface EducationItem {
  institution: ProfileField<string>;
  normalizedDegreeLevel: DegreeLevel;
  rawDegree: string;
  fieldOfStudy: string | null;
  startYear: number | null;
  endYear: number | null;
  grade: string | null; // e.g. CGPA, GPA
  confidence: number;
  evidence: EvidenceSnippet | null;
}

export interface SkillEvidence {
  rawTerm: string;
  canonicalSkill: string;
  category?: string;
  source: 'skills_section' | 'experience' | 'project' | 'certification';
  evidenceStrength: 'listed_only' | 'used_in_job' | 'used_with_outcome';
  monthsExperience: number;
  evidence: EvidenceSnippet;
}

export interface ProjectItem {
  title: ProfileField<string>;
  technologies: string[];
  highlights: string[];
  url: string | null;
  year: number | null;
  confidence: number;
  evidence: EvidenceSnippet | null;
}

export interface CertificationItem {
  name: ProfileField<string>;
  issuer: string | null;
  year: number | null;
  confidence: number;
  evidence: EvidenceSnippet | null;
}

export interface ResumeProfile {
  contact: ContactInfo;
  summary: ProfileField<string>;
  experience: ExperienceItem[];
  totalExperienceMonths: number;
  totalExperienceYears: number;
  education: EducationItem[];
  skills: SkillEvidence[];
  projects: ProjectItem[];
  certifications: CertificationItem[];
  languages: Array<{ language: string; proficiency?: string }>;
  publications: Array<{ title: string; year?: number }>;
  awards: Array<{ title: string; year?: number }>;
  demographicsStripped: boolean;
}

