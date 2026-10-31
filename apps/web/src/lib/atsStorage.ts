import { ResumeData } from '@shortlistiq/shared';
import { CandidateCheckData, SuggestionItem } from './api';

export interface StoredAtsCheck {
  id: string;
  createdAt: string;
  jobTitle: string;
  company?: string | null;
  scoreBefore?: number | null;
  scoreAfter?: number | null;
  breakdown?: any;
  resumeText?: string | null;
  jdText: string;
  candidateName?: string;
  resumeData?: ResumeData | null;
  suggestions?: SuggestionItem[];
  latexSource?: string | null;
  updatedAt?: string;
}

export interface StoredAtsCheckSummary {
  id: string;
  createdAt: string;
  jobTitle: string;
  company?: string | null;
  scoreBefore?: number | null;
  scoreAfter?: number | null;
  candidateName?: string;
}

const STORAGE_KEY_PREFIX = 'shortlistiq_ats_check_';
const RECENT_CHECKS_KEY = 'shortlistiq_recent_checks';
const MAX_RECENT_CHECKS = 20;

/**
 * Saves or updates a full ATS check in localStorage
 */
export function saveAtsCheck(data: StoredAtsCheck): void {
  if (!data || !data.id) return;
  try {
    const payload: StoredAtsCheck = {
      ...data,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${data.id}`, JSON.stringify(payload));

    // Update recent checks list
    const recent = getRecentAtsChecks();
    const summary: StoredAtsCheckSummary = {
      id: data.id,
      createdAt: data.createdAt || new Date().toISOString(),
      jobTitle: data.jobTitle || 'ATS Evaluation',
      company: data.company || null,
      scoreBefore: data.scoreBefore ?? null,
      scoreAfter: data.scoreAfter ?? null,
      candidateName: data.candidateName || data.resumeData?.contact?.fullName || 'Candidate'
    };

    const filtered = recent.filter((c) => c.id !== data.id);
    const updated = [summary, ...filtered].slice(0, MAX_RECENT_CHECKS);
    localStorage.setItem(RECENT_CHECKS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[atsStorage] Failed to save ATS check to localStorage:', err);
  }
}

/**
 * Retrieves a stored ATS check by ID
 */
export function getAtsCheck(id: string): StoredAtsCheck | null {
  if (!id) return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as StoredAtsCheck;
  } catch (err) {
    console.warn('[atsStorage] Failed to read ATS check from localStorage:', err);
    return null;
  }
}

/**
 * Updates specific fields of an existing stored ATS check
 */
export function updateAtsCheck(id: string, updates: Partial<StoredAtsCheck>): StoredAtsCheck | null {
  if (!id) return null;
  try {
    const existing = getAtsCheck(id) || {
      id,
      createdAt: new Date().toISOString(),
      jobTitle: updates.jobTitle || 'ATS Check',
      jdText: updates.jdText || ''
    };
    const merged: StoredAtsCheck = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };
    saveAtsCheck(merged);
    return merged;
  } catch (err) {
    console.warn('[atsStorage] Failed to update ATS check in localStorage:', err);
    return null;
  }
}

/**
 * Returns list of recent ATS check summaries
 */
export function getRecentAtsChecks(): StoredAtsCheckSummary[] {
  try {
    const raw = localStorage.getItem(RECENT_CHECKS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredAtsCheckSummary[];
  } catch (err) {
    console.warn('[atsStorage] Failed to read recent checks from localStorage:', err);
    return [];
  }
}

/**
 * Removes a specific ATS check from localStorage
 */
export function removeAtsCheck(id: string): void {
  if (!id) return;
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${id}`);
    const recent = getRecentAtsChecks().filter((c) => c.id !== id);
    localStorage.setItem(RECENT_CHECKS_KEY, JSON.stringify(recent));
  } catch (err) {
    console.warn('[atsStorage] Failed to remove ATS check from localStorage:', err);
  }
}

/**
 * Clears all ATS checks from localStorage
 */
export function clearAllAtsChecks(): void {
  try {
    const recent = getRecentAtsChecks();
    for (const c of recent) {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${c.id}`);
    }
    localStorage.removeItem(RECENT_CHECKS_KEY);
  } catch (err) {
    console.warn('[atsStorage] Failed to clear ATS checks from localStorage:', err);
  }
}
