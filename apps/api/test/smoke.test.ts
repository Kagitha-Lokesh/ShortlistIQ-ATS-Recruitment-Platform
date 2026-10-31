import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { dbService } from '../src/services/db.js';
import { storageService } from '../src/services/storage.js';
import { generateResumePdf } from '../src/services/export/index.js';

describe('Phase 11: End-to-End Smoke Test Flow', () => {
  beforeEach(() => {
    dbService.resetMockStore();
    storageService.resetMockStorage();
  });

  it('runs complete lifecycle: probes -> signup -> check -> batch -> upload -> criteria -> test email', async () => {
    // 1. Probes
    const healthRes = await request(app).get('/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe('ok');

    const readyRes = await request(app).get('/ready');
    expect(readyRes.status).toBe(200);
    expect(readyRes.body.status).toBe('ready');

    // 2. HR Sign Up
    const signupRes = await request(app)
      .post('/api/v1/auth/signup-hr')
      .send({
        email: 'smoke-admin@acme-test.com',
        password: 'SecurePassword123!',
        fullName: 'Smoke Admin',
        organizationName: 'Acme Test Corp'
      });
    expect(signupRes.status).toBe(201);
    const token = signupRes.body.data?.token || signupRes.body.token;
    expect(token).toBeDefined();

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(meRes.status).toBe(200);
    const meProfile = meRes.body.data?.profile || meRes.body.profile;
    expect(meProfile.fullName).toBe('Smoke Admin');

    // 3. Candidate Resume ATS Check
    // Generate valid ATS-friendly PDF buffer using application export engine
    const testResumeData = {
      contact: {
        fullName: 'John Doe',
        email: 'john.doe@example.com',
        phone: '555-0199',
        location: 'San Francisco, CA',
        linkedin: 'https://linkedin.com/in/johndoe'
      },
      summary:
        'Senior Full Stack Engineer with 5+ years of experience architecting distributed cloud systems with React, TypeScript, Node.js, and PostgreSQL.',
      experience: [
        {
          title: 'Senior Software Engineer',
          company: 'Acme Innovations',
          startDate: '2020',
          endDate: 'Present',
          description:
            'Architected scalable web dashboards with React and TypeScript. Built Node.js and PostgreSQL backends.'
        }
      ],
      skills: [
        {
          category: 'Core Technologies',
          items: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'AWS']
        }
      ],
      education: [
        {
          degree: 'Bachelor of Science in Computer Science',
          institution: 'University of California',
          year: '2019'
        }
      ],
      projects: [],
      certifications: []
    };

    const resumePdfBuffer = await generateResumePdf(testResumeData, {
      template: 'modern',
      accentColor: 'indigo',
      fontSize: 'medium',
      margins: 'normal'
    });

    const checkRes = await request(app)
      .post('/api/v1/checks')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', resumePdfBuffer, 'john_doe_resume.pdf')
      .field('jobTitle', 'Senior Full Stack Engineer')
      .field('company', 'Acme Test Corp')
      .field(
        'jdText',
        'Looking for a Senior Full Stack Engineer with 4+ years building distributed React, TypeScript, Node.js, and PostgreSQL cloud applications.'
      );

    expect(checkRes.status).toBe(201);
    expect(checkRes.body.data.scoreBefore).toBeGreaterThan(0);
    const checkId = checkRes.body.data.id;

    const checkGet = await request(app)
      .get(`/api/v1/checks/${checkId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(checkGet.status).toBe(200);

    // 4. Batch Creation & Candidate Upload
    const batchRes = await request(app)
      .post('/api/v1/batches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Smoke Batch 2026',
        jobTitle: 'Senior Full Stack Engineer',
        jdText:
          'Looking for a Senior Full Stack Engineer with 4+ years building distributed React, TypeScript, Node.js, and PostgreSQL cloud applications.',
        cutoff: 75
      });
    expect(batchRes.status).toBe(201);
    const batchId = batchRes.body.data.id;

    const uploadRes = await request(app)
      .post(`/api/v1/batches/${batchId}/candidates/upload`)
      .set('Authorization', `Bearer ${token}`)
      .attach('files', resumePdfBuffer, 'candidate_jane.pdf');

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.uploadedCount).toBe(1);

    // 5. Shortlisting Criteria Run
    const criteriaRes = await request(app)
      .put(`/api/v1/batches/${batchId}/criteria`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        cutoff: 75,
        alwaysRequireAllMustHaves: true,
        criteria: [
          {
            id: 'crit-react',
            label: 'React & TypeScript frontend architecture',
            type: 'must-have',
            weight: 9,
            keywords: ['react', 'typescript']
          }
        ]
      });
    expect(criteriaRes.status).toBe(200);
    expect(criteriaRes.body.enqueuedCount).toBe(1);

    // 6. Connect Mock Email Account & Send Test Email Preview
    const connectRes = await request(app)
      .post('/api/v1/email/mock-connect')
      .set('Authorization', `Bearer ${token}`)
      .send({
        provider: 'gmail',
        address: 'hr-smoke@acme-test.com'
      });
    expect(connectRes.status).toBe(200);

    const testEmailRes = await request(app)
      .post(`/api/v1/email/batches/${batchId}/test`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        kind: 'shortlisted'
      });
    expect(testEmailRes.status).toBe(200);
    expect(testEmailRes.body.success).toBe(true);
    expect(testEmailRes.body.message).toContain('Test email sent successfully');
  });
});
