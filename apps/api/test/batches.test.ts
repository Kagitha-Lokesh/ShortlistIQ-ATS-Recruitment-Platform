import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { runSeed } from '../prisma/seed.js';

describe('HTTP Multi-Tenant Batch API Endpoints', () => {
  let seedData: Awaited<ReturnType<typeof runSeed>>;

  beforeEach(async () => {
    seedData = await runSeed();
  });

  it('proves HR User A cannot fetch Org B batch via HTTP GET /api/v1/batches/:id', async () => {
    // HR User A token
    const tokenA = `mock-token:${seedData.hrA.id}:${seedData.hrA.fullName}`;

    // Trying to fetch Org B batch
    const res = await request(app)
      .get(`/api/v1/batches/${seedData.batchB.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('allows HR User A to fetch their own Org A batch via HTTP GET', async () => {
    const tokenA = `mock-token:${seedData.hrA.id}:${seedData.hrA.fullName}`;

    const res = await request(app)
      .get(`/api/v1/batches/${seedData.batchA.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(seedData.batchA.id);
    expect(res.body.data.orgId).toBe(seedData.orgA.id);
  });

  it('rejects unauthenticated requests to /api/v1/batches with 401', async () => {
    const res = await request(app).get('/api/v1/batches');
    expect(res.status).toBe(401);
  });
});

