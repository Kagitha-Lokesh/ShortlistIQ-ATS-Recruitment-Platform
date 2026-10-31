import { DegreeLevel } from '../extract/types.js';

export type RequirementStrength = 'must_have' | 'nice_to_have' | 'dealbreaker';
export type SeniorityLevel = 'entry' | 'mid' | 'senior' | 'lead' | 'executive' | 'unknown';

export interface SkillRequirement {
  id: string;
  raw: string;
  canonical: string;
  alternatives: string[]; // e.g. ["Angular"] for "React or Angular"
  minYears?: number;
  strength: RequirementStrength;
  isNegated?: boolean; // e.g. "no PHP" or "without Angular"
}

export interface EducationRequirement {
  level: DegreeLevel;
  field?: string;
  allowEquivalentExperience: boolean; // e.g. "or equivalent experience"
  strength: RequirementStrength;
}

export type JdQualityIssueType =
  | 'UNREALISTIC_EXPERIENCE'
  | 'CONTRADICTION'
  | 'VAGUE_REQUIREMENT'
  | 'LONG_MUST_HAVE_LIST'
  | 'DISCRIMINATORY_LANGUAGE'
  | 'NOT_A_JOB_DESCRIPTION';

export interface JdQualityIssue {
  type: JdQualityIssueType;
  severity: 'warning' | 'error' | 'info';
  message: string;
  snippet?: string;
}

export interface JobRequirements {
  title: string | null;
  seniority: SeniorityLevel;
  employmentType: 'full-time' | 'contract' | 'part-time' | 'internship' | 'remote' | 'unknown';
  minTotalYearsExperience: number;
  mustHaveSkills: SkillRequirement[];
  niceToHaveSkills: SkillRequirement[];
  education: EducationRequirement | null;
  certifications: string[];
  languages: string[];
  locationConstraints: string[];
  responsibilities: string[];
  domainKeywords: string[];
  qualityIssues: JdQualityIssue[];
  isValidJobDescription: boolean;
  validationReason?: string;
  version: number;
  isConfirmedByHr?: boolean;
}

