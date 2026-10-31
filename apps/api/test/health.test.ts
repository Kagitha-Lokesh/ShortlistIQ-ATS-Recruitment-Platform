import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { HealthCheckResponseSchema } from '@shortlistiq/shared';

describe('Health Routes', () => {
  it('GET /health returns 200 with valid health check payload', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);

    const parsed = HealthCheckResponseSchema.safeParse(res.body);
    expect(parsed.success).toBe(true);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('api');
  });

  it('GET /api/health returns 200 for frontend reverse-proxy', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
