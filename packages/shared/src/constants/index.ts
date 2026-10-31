export const APP_NAME = 'ShortlistIQ';

export const USER_ROLES = {
  HR: 'hr',
  CANDIDATE: 'candidate',
  HR_ADMIN: 'hr',
  HR_MEMBER: 'hr'
} as const;

export type UserRole = 'hr' | 'candidate';

export const RETENTION_PERIODS = {
  DAYS_30: 30,
  DAYS_60: 60,
  DAYS_90: 90,
  DAYS_180: 180
} as const;
