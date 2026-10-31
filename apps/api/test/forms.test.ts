import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { runSeed } from '../prisma/seed.js';
import { generateResumePdf } from '../src/services/export/pdf.js';
import {
  getCandidateRepository
} from '../src/repositories/index.js';
import { CandidateDecision, DecisionSource, CandidateSource, CandidateStatus } from '@prisma/client';
import { LOCKED_MANDATORY_FIELDS } from '@shortlistiq/shared';

describe('Phase 8: Application Forms & Knockout Engine API', () => {
  let seedData: Awaited<ReturnType<typeof runSeed>>;
  let orgId: string;
  let hrToken: string;
  let batchId: string;
  let samplePdfBuffer: Buffer;

  beforeEach(async () => {
    seedData = await runSeed();
    orgId = seedData.orgA.id;
    hrToken = `mock-token:${seedData.hrA.id}:${seedData.hrA.fullName}`;
    batchId = seedData.batchA.id;

    // Generate real PDF with >200 characters using generateResumePdf
    samplePdfBuffer = await generateResumePdf({
      contact: {
        fullName: 'Alex Taylor',
        email: 'alex.taylor@example.com',
        phone: '+1 555-0199',
        location: 'San Francisco, CA',
        linkedin: 'linkedin.com/in/alextaylor',
        github: 'github.com/alextaylor',
        website: ''
      },
      summary: 'Experienced Senior Full Stack Engineer with strong TypeScript, React, Node.js, and cloud infrastructure experience building high performance applications.',
      experience: [
        {
          title: 'Senior Software Engineer',
          company: 'Tech Corp',
          location: 'San Francisco, CA',
          startDate: '2020',
          endDate: 'Present',
          current: true,
          highlights: [
            'Architected distributed microservices handling 500k requests daily using TypeScript and Node.js.',
            'Built responsive web interfaces with React and Tailwind CSS.'
          ]
        }
      ],
      education: [
        {
          degree: 'Bachelor of Science in Computer Science',
          institution: 'Stanford University',
          startDate: '2016',
          endDate: '2020'
        }
      ],
      skills: [
        {
          category: 'Core',
          items: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker', 'AWS']
        }
      ]
    });
  });

  it('allows HR to create a custom form with locked fields, custom questions, and knockout rules', async () => {
    const payload = {
      batchId,
      title: 'Senior Full Stack Application Form',
      slug: 'acme-fullstack-engineer',
      schema: {
        fields: [
          ...LOCKED_MANDATORY_FIELDS,
          {
            id: 'years_experience',
            label: 'Total Years of Professional Experience',
            type: 'number',
            required: true
          },
          {
            id: 'willing_to_relocate',
            label: 'Are you willing to relocate to San Francisco?',
            type: 'boolean',
            required: true
          }
        ],
        consentText: 'I consent to data collection for recruitment purposes.'
      },
      knockoutRules: [
        {
          id: 'rule-relocate',
          fieldId: 'willing_to_relocate',
          fieldLabel: 'Are you willing to relocate?',
          operator: 'equals',
          value: false,
          reason: 'Candidate is not willing to relocate to San Francisco office'
        },
        {
          id: 'rule-min-years',
          fieldId: 'years_experience',
          fieldLabel: 'Years of Experience',
          operator: 'less_than',
          value: 3,
          reason: 'Requires at least 3 years of professional experience'
        }
      ],
      isPublished: true
    };

    const res = await request(app)
      .post('/api/v1/forms')
      .set('Authorization', `Bearer ${hrToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.slug).toBe('acme-fullstack-engineer');
    expect(res.body.data.isPublished).toBe(true);
    expect(res.body.data.knockoutRules.length).toBe(2);
  });

  it('serves the public form schema without revealing internal knockout rules', async () => {
    // 1. Create form
    await request(app)
      .post('/api/v1/forms')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        batchId,
        title: 'Lead Architect',
        slug: 'lead-architect',
        schema: {
          fields: [
            ...LOCKED_MANDATORY_FIELDS,
            { id: 'relocate', label: 'Relocate?', type: 'boolean', required: true }
          ]
        },
        knockoutRules: [
          {
            id: 'ko-1',
            fieldId: 'relocate',
            operator: 'equals',
            value: false,
            reason: 'Relocation required'
          }
        ],
        isPublished: true
      });

    // 2. Fetch public form
    const publicRes = await request(app).get('/api/v1/forms/public/lead-architect');

    expect(publicRes.status).toBe(200);
    expect(publicRes.body.success).toBe(true);
    expect(publicRes.body.data.title).toBe('Lead Architect');
    expect(publicRes.body.data.slug).toBe('lead-architect');
    expect(publicRes.body.data.isPublished).toBe(true);
    expect(publicRes.body.data.schema.fields.length).toBe(4);
    // Knockout rules must NOT be in public payload to prevent reverse engineering
    expect(publicRes.body.data.knockoutRules).toBeUndefined();
  });

  it('immediately auto-rejects a candidate who triggers a knockout rule and preserves reason', async () => {
    // Create form with knockout rule
    await request(app)
      .post('/api/v1/forms')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        batchId,
        title: 'Backend Engineer',
        slug: 'backend-engineer',
        schema: {
          fields: [
            ...LOCKED_MANDATORY_FIELDS,
            { id: 'relocate', label: 'Relocate?', type: 'boolean', required: true }
          ]
        },
        knockoutRules: [
          {
            id: 'ko-relocate',
            fieldId: 'relocate',
            operator: 'equals',
            value: false,
            reason: 'Candidate answered No to mandatory relocation'
          }
        ],
        isPublished: true
      });

    // Submit with relocate = false
    const submitRes = await request(app)
      .post('/api/v1/forms/public/backend-engineer/submit')
      .field('fullName', 'John Rejectable')
      .field('email', 'john.rejectable@example.com')
      .field('phone', '+1 555-0199')
      .field('consent', 'true')
      .field('answers', JSON.stringify({ relocate: false }))
      .attach('resume', samplePdfBuffer, 'john_resume.pdf');

    expect(submitRes.status).toBe(201);
    expect(submitRes.body.success).toBe(true);
    expect(submitRes.body.knockout).toBe(true);
    expect(submitRes.body.decision).toBe('unshortlisted');
    expect(submitRes.body.referenceNumber).toMatch(/^APP-/);

    // Verify candidate in DB
    const candidateRepo = getCandidateRepository(orgId);
    const candidates = await candidateRepo.findManyByBatch(batchId);
    const knockedOutCandidate = candidates.find((c) => c.email === 'john.rejectable@example.com');

    expect(knockedOutCandidate).toBeDefined();
    expect(knockedOutCandidate?.source).toBe(CandidateSource.form);
    expect(knockedOutCandidate?.decision).toBe(CandidateDecision.unshortlisted);
    expect(knockedOutCandidate?.decisionSource).toBe(DecisionSource.knockout);
    expect(knockedOutCandidate?.failureReason).toBe('Knockout: Candidate answered No to mandatory relocation');
    expect(knockedOutCandidate?.consentAt).toBeInstanceOf(Date);
  });

  it('accepts passing candidate submissions, enqueues them for background scoring, and records consent', async () => {
    // Create form with knockout rule
    await request(app)
      .post('/api/v1/forms')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        batchId,
        title: 'Frontend Engineer',
        slug: 'frontend-engineer',
        schema: {
          fields: [
            ...LOCKED_MANDATORY_FIELDS,
            { id: 'relocate', label: 'Relocate?', type: 'boolean', required: true }
          ]
        },
        knockoutRules: [
          {
            id: 'ko-relocate',
            fieldId: 'relocate',
            operator: 'equals',
            value: false,
            reason: 'Relocation required'
          }
        ],
        isPublished: true
      });

    // Submit with relocate = true (passes knockout)
    const submitRes = await request(app)
      .post('/api/v1/forms/public/frontend-engineer/submit')
      .field('fullName', 'Alice Passer')
      .field('email', 'alice.passer@example.com')
      .field('phone', '+1 555-0244')
      .field('consent', 'true')
      .field('answers', JSON.stringify({ relocate: true }))
      .attach('resume', samplePdfBuffer, 'alice_resume.pdf');

    expect(submitRes.status).toBe(201);
    expect(submitRes.body.success).toBe(true);
    expect(submitRes.body.referenceNumber).toMatch(/^APP-/);
    expect(submitRes.body.knockout).toBeUndefined();

    // Verify candidate in DB has been processed and scored
    const candidateRepo = getCandidateRepository(orgId);
    const candidates = await candidateRepo.findManyByBatch(batchId);
    const passingCandidate = candidates.find((c) => c.email === 'alice.passer@example.com');

    expect(passingCandidate).toBeDefined();
    expect(passingCandidate?.source).toBe(CandidateSource.form);
    expect(passingCandidate?.status).toBe(CandidateStatus.scored);
    expect(passingCandidate?.decision).toBe(CandidateDecision.shortlisted);
    expect(passingCandidate?.score).toBeGreaterThan(0);
    expect(passingCandidate?.consentAt).toBeInstanceOf(Date);
  });

  it('rejects bot submissions when honeypot field is filled', async () => {
    await request(app)
      .post('/api/v1/forms')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        batchId,
        title: 'Honeypot Test',
        slug: 'honeypot-test',
        schema: { fields: LOCKED_MANDATORY_FIELDS },
        isPublished: true
      });

    const botRes = await request(app)
      .post('/api/v1/forms/public/honeypot-test/submit')
      .field('fullName', 'Spam Bot')
      .field('email', 'bot@spammer.org')
      .field('phone', '12345')
      .field('consent', 'true')
      .field('honeypot', 'http://buy-crypto-now.example.com') // Filled honeypot
      .attach('resume', samplePdfBuffer, 'spam.pdf');

    expect(botRes.status).toBe(400);
    expect(botRes.body.error.code).toBe('BOT_DETECTED');
  });

  it('rejects submissions without mandatory consent', async () => {
    await request(app)
      .post('/api/v1/forms')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        batchId,
        title: 'Consent Test',
        slug: 'consent-test',
        schema: { fields: LOCKED_MANDATORY_FIELDS },
        isPublished: true
      });

    const noConsentRes = await request(app)
      .post('/api/v1/forms/public/consent-test/submit')
      .field('fullName', 'No Consent Candidate')
      .field('email', 'noconsent@example.com')
      .field('phone', '+1 555-9999')
      .field('consent', 'false') // Missing consent
      .attach('resume', samplePdfBuffer, 'resume.pdf');

    expect(noConsentRes.status).toBe(400);
    expect(noConsentRes.body.error.code).toBe('CONSENT_REQUIRED');
  });

  it('closing a form rejects new submissions while preserving previous data and updating submission count', async () => {
    // 1. Create and submit one application
    const createRes = await request(app)
      .post('/api/v1/forms')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        batchId,
        title: 'Expiring Job Form',
        slug: 'expiring-job',
        schema: { fields: LOCKED_MANDATORY_FIELDS },
        isPublished: true
      });

    const formId = createRes.body.data.id;

    // First submission succeeds
    await request(app)
      .post('/api/v1/forms/public/expiring-job/submit')
      .field('fullName', 'Candidate One')
      .field('email', 'cand1@example.com')
      .field('phone', '555-1111')
      .field('consent', 'true')
      .attach('resume', samplePdfBuffer, 'cand1.pdf');

    // Check submission count
    const listRes1 = await request(app)
      .get(`/api/v1/forms/batch/${batchId}`)
      .set('Authorization', `Bearer ${hrToken}`);
    expect(listRes1.body.data[0].submissionCount).toBe(1);

    // 2. HR closes the form
    const toggleRes = await request(app)
      .post(`/api/v1/forms/${formId}/toggle-publish`)
      .set('Authorization', `Bearer ${hrToken}`);
    expect(toggleRes.status).toBe(200);
    expect(toggleRes.body.data.isPublished).toBe(false);

    // 3. New submission to closed form must be rejected
    const secondSubmitRes = await request(app)
      .post('/api/v1/forms/public/expiring-job/submit')
      .field('fullName', 'Late Candidate')
      .field('email', 'late@example.com')
      .field('phone', '555-2222')
      .field('consent', 'true')
      .attach('resume', samplePdfBuffer, 'late.pdf');

    expect(secondSubmitRes.status).toBe(400);
    expect(secondSubmitRes.body.error.code).toBe('FORM_CLOSED');

    // 4. Verify candidate 1 still exists intact in the batch
    const candidateRepo = getCandidateRepository(orgId);
    const candidates = await candidateRepo.findManyByBatch(batchId);
    expect(candidates.some((c) => c.email === 'cand1@example.com')).toBe(true);
  });
});
