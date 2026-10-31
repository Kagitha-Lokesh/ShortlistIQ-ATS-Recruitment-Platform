import { describe, it, expect } from 'vitest';
import { HealthCheckResponseSchema, SignUpHRInputSchema, ApiErrorResponseSchema } from '../src/index.js';

describe('Shared Schemas', () => {
  it('validates health check payload successfully', () => {
    const valid = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'api',
      version: '1.0.0'
    };

    const parsed = HealthCheckResponseSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('validates HR sign up input with valid fields', () => {
    const valid = {
      email: 'recruiter@company.com',
      password: 'SecurePassword123!',
      fullName: 'Jane Recruiter',
      organizationName: 'Acme Corp'
    };
    const parsed = SignUpHRInputSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid email or too short password', () => {
    const invalid = {
      email: 'not-an-email',
      password: '123',
      fullName: 'A',
      organizationName: ''
    };
    const parsed = SignUpHRInputSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('validates standard ApiErrorResponseSchema', () => {
    const errorPayload = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input'
      }
    };
    const parsed = ApiErrorResponseSchema.safeParse(errorPayload);
    expect(parsed.success).toBe(true);
  });
});
