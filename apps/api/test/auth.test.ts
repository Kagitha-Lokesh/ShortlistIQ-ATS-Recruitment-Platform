import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { dbService } from '../src/services/db.js';

describe('Auth & Tenancy Flow', () => {
  beforeEach(() => {
    dbService.resetMockStore();
  });

  it('allows HR sign up and creates their organization', async () => {
    const payload = {
      email: 'recruiter@techcorp.com',
      password: 'Password123!',
      fullName: 'Alice HR',
      organizationName: 'TechCorp Solutions'
    };

    const res = await request(app)
      .post('/api/v1/auth/signup-hr')
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.profile.role).toBe('hr');
    expect(res.body.data.profile.email).toBe('recruiter@techcorp.com');
    expect(res.body.data.organization.name).toBe('TechCorp Solutions');
    expect(res.body.data.profile.orgId).toBe(res.body.data.organization.id);
    expect(res.body.data.token).toBeDefined();
  });

  it('rejects duplicate email sign up with 409', async () => {
    const payload = {
      email: 'duplicate@test.com',
      password: 'Password123!',
      fullName: 'First User',
      organizationName: 'First Org'
    };

    await request(app).post('/api/v1/auth/signup-hr').send(payload);
    const res = await request(app).post('/api/v1/auth/signup-hr').send(payload);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('USER_ALREADY_EXISTS');
  });

  it('allows signing in with registered credentials', async () => {
    await request(app).post('/api/v1/auth/signup-hr').send({
      email: 'user@company.com',
      password: 'Password123!',
      fullName: 'User Name',
      organizationName: 'My Company'
    });

    const res = await request(app)
      .post('/api/v1/auth/signin')
      .send({
        email: 'user@company.com',
        password: 'Password123!'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
  });

  it('blocks unauthenticated access to /api/v1/auth/me with 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('allows authenticated HR to access /api/v1/hr/dashboard', async () => {
    const signupRes = await request(app).post('/api/v1/auth/signup-hr').send({
      email: 'hr@work.com',
      password: 'Password123!',
      fullName: 'HR Officer',
      organizationName: 'Work Inc'
    });

    const token = signupRes.body.data.token;

    const res = await request(app)
      .get('/api/v1/hr/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.organizationId).toBe(signupRes.body.data.organization.id);
  });

  it('automatically provisions organization and HR profile on oauth-sync', async () => {
    const res = await request(app)
      .post('/api/v1/auth/oauth-sync')
      .send({
        email: 'google-user@domain.com',
        fullName: 'Google User',
        id: 'google-oauth-sub-123'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.profile.email).toBe('google-user@domain.com');
    expect(res.body.data.organization.name).toBe("Google User's Organization");
    expect(res.body.data.token).toBeDefined();

    // Repeated call returns existing profile and org
    const repeatRes = await request(app)
      .post('/api/v1/auth/oauth-sync')
      .send({
        email: 'google-user@domain.com'
      });

    expect(repeatRes.status).toBe(200);
    expect(repeatRes.body.data.profile.id).toBe(res.body.data.profile.id);
  });
});

