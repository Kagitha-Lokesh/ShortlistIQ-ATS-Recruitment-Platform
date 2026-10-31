import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Centralized Error Handler & Rate Limiter', () => {
  it('returns 404 with standardized JSON error for unknown routes', async () => {
    const res = await request(app).get('/api/v1/unknown-endpoint');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.requestId).toBeDefined();
  });

  it('returns 400 with VALIDATION_ERROR when payload is invalid', async () => {
    const res = await request(app).post('/api/v1/auth/signup-hr').send({
      email: 'not-an-email',
      password: 'short'
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeDefined();
  });
});

