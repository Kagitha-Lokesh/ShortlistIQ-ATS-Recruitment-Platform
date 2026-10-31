import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { runSeed } from '../prisma/seed.js';
import { jobQueue } from '../src/services/queue.js';
import { generateResumePdf } from '../src/services/export/pdf.js';
import { inMemoryStore, auditLogRepository } from '../src/repositories/index.js';
import { CandidateStatus, CandidateDecision, DecisionSource } from '@prisma/client';

describe('Phase 7: Shortlisting Criteria, Re-scoring & Review API Flow', () => {
  let seedData: Awaited<ReturnType<typeof runSeed>>;
  let tokenA: string;
  let batchId: string;

  beforeEach(async () => {
    seedData = await runSeed();
    tokenA = `mock-token:${seedData.hrA.id}:${seedData.hrA.fullName}`;

    // Create a shared batch for test
    const batchRes = await request(app)
      .post('/api/v1/batches')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Full Stack Engineers Phase 7',
        jobTitle: 'Senior Full Stack Engineer',
        jdText: `
          Job Title: Senior Full Stack Engineer
          Requirements:
          • 5+ years building web applications with React, TypeScript, and Node.js
          • Extensive experience in PostgreSQL database design and query tuning
          • Experience with Docker and microservices
        `,
        cutoff: 70
      });

    batchId = batchRes.body.data.id;
  });

  const createSampleResume = async (fullName: string, email: string, skills: string[], yearsText: string) => {
    return generateResumePdf({
      contact: {
        fullName,
        email,
        phone: '+1 (555) 019-2834',
        location: 'San Francisco, CA',
        linkedin: '',
        github: '',
        website: ''
      },
      summary: `${yearsText} of experience architecting distributed web applications with ${skills.join(', ')}.`,
      experience: [
        {
          title: 'Senior Engineer',
          company: 'Acme Corp',
          location: 'San Francisco, CA',
          startDate: '2019',
          endDate: 'Present',
          current: true,
          highlights: [
            `Built scalable web services in ${skills.join(', ')}.`,
            'Optimized relational database queries slashing latency.'
          ]
        }
      ],
      education: [
        {
          degree: 'Bachelor of Science in Computer Science',
          institution: 'University of California',
          startDate: '2015',
          endDate: '2019'
        }
      ],
      skills: [
        {
          category: 'Technical Skills',
          items: skills
        }
      ],
      projects: [],
      certifications: []
    });
  };

  it('suggests AI criteria chips from the job description', async () => {
    const res = await request(app)
      .post(`/api/v1/batches/${batchId}/criteria/suggest`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('label');
    expect(res.body.data[0]).toHaveProperty('type');
  });

  it('provides preview scoring on sample candidates without saving changes to DB', async () => {
    const pdf1 = await createSampleResume('Candidate One', 'c1@example.com', ['React', 'TypeScript', 'Node.js', 'PostgreSQL'], '6 years');
    await request(app)
      .post(`/api/v1/batches/${batchId}/candidates/upload`)
      .set('Authorization', `Bearer ${tokenA}`)
      .attach('files', pdf1, 'c1.pdf');

    await jobQueue.drainLocalQueue();

    const previewRes = await request(app)
      .post(`/api/v1/batches/${batchId}/criteria/preview`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        cutoff: 80,
        alwaysRequireAllMustHaves: true,
        criteria: [
          {
            id: 'c-1',
            label: 'React & TypeScript',
            type: 'must-have',
            weight: 8,
            keywords: ['react', 'typescript']
          }
        ]
      });

    expect(previewRes.status).toBe(200);
    expect(previewRes.body.success).toBe(true);
    expect(previewRes.body.data).toHaveLength(1);
    expect(previewRes.body.data[0].fullName).toBe('Candidate One');
    expect(previewRes.body.data[0].criteriaResults).toBeDefined();

    // Verify DB batch was NOT mutated by preview
    const batchRes = await request(app)
      .get(`/api/v1/batches/${batchId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(batchRes.body.data.cutoff).toBe(70); // original cutoff maintained
  });

  it('re-scores candidates on criteria update while strictly preserving manual overrides', async () => {
    // 1. Upload 2 candidates
    const pdf1 = await createSampleResume('Alice Walker', 'alice@example.com', ['React', 'TypeScript', 'Node.js', 'PostgreSQL'], '6 years');
    const pdf2 = await createSampleResume('Bob Smith', 'bob@example.com', ['Python', 'Django'], '2 years');

    await request(app)
      .post(`/api/v1/batches/${batchId}/candidates/upload`)
      .set('Authorization', `Bearer ${tokenA}`)
      .attach('files', pdf1, 'alice.pdf')
      .attach('files', pdf2, 'bob.pdf');

    await jobQueue.drainLocalQueue();

    const candidatesRes = await request(app)
      .get(`/api/v1/batches/${batchId}/candidates`)
      .set('Authorization', `Bearer ${tokenA}`);

    const candidates = candidatesRes.body.data;
    const bob = candidates.find((c: any) => c.fullName.includes('Bob'));
    expect(bob).toBeDefined();

    // 2. HR Manually overrides Bob to 'shortlisted'
    const overrideRes = await request(app)
      .post(`/api/v1/batches/${batchId}/candidates/bulk-decision`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        candidateIds: [bob.id],
        decision: 'shortlisted'
      });

    expect(overrideRes.status).toBe(200);
    expect(overrideRes.body.data[0].decision).toBe('shortlisted');
    expect(overrideRes.body.data[0].decisionSource).toBe('manual');

    // Verify AuditLog written
    const logs = await auditLogRepository.findByEntity('Candidate', bob.id);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].action).toBe('CANDIDATE_DECISION_OVERRIDE');

    // 3. Update Batch Criteria to an extremely strict cutoff of 95%
    const updateRes = await request(app)
      .put(`/api/v1/batches/${batchId}/criteria`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        cutoff: 95,
        criteria: [
          {
            id: 'c-strict',
            label: 'Mandatory Node & Postgres',
            type: 'must-have',
            keywords: ['node.js', 'postgresql']
          }
        ]
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.enqueuedCount).toBeGreaterThanOrEqual(2);

    // Drain re-score queue
    await jobQueue.drainLocalQueue();

    // 4. Verify that Bob's manual override was NOT overwritten by the re-score!
    const reCheckedList = await request(app)
      .get(`/api/v1/batches/${batchId}/candidates`)
      .set('Authorization', `Bearer ${tokenA}`);

    const bobRechecked = reCheckedList.body.data.find((c: any) => c.id === bob.id);
    expect(bobRechecked.decision).toBe('shortlisted');
    expect(bobRechecked.decisionSource).toBe('manual');

    // Non-manual candidate (Alice) should be unshortlisted because 95% cutoff was not reached
    const aliceRechecked = reCheckedList.body.data.find((c: any) => c.fullName.includes('Alice'));
    expect(aliceRechecked.decision).toBe('unshortlisted');
  });

  it('unshortlists candidate immediately if any dealbreaker criterion fails', async () => {
    const pdf = await createSampleResume('Dealbreaker Test', 'dt@example.com', ['React', 'HTML'], '3 years');
    await request(app)
      .post(`/api/v1/batches/${batchId}/candidates/upload`)
      .set('Authorization', `Bearer ${tokenA}`)
      .attach('files', pdf, 'dt.pdf');

    await jobQueue.drainLocalQueue();

    // Update criteria with a dealbreaker keyword "kubernetes" which the candidate lacks
    await request(app)
      .put(`/api/v1/batches/${batchId}/criteria`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        cutoff: 50,
        criteria: [
          {
            id: 'db-1',
            label: 'Must have Kubernetes orchestration',
            type: 'dealbreaker',
            keywords: ['kubernetes']
          }
        ]
      });

    await jobQueue.drainLocalQueue();

    const candidatesRes = await request(app)
      .get(`/api/v1/batches/${batchId}/candidates`)
      .set('Authorization', `Bearer ${tokenA}`);

    const cand = candidatesRes.body.data.find((c: any) => c.email === 'dt@example.com');
    expect(cand.decision).toBe('unshortlisted');
  });

  it('generates short-lived signed URLs for candidate resume preview', async () => {
    const pdf = await createSampleResume('Preview Candidate', 'preview@example.com', ['Node.js'], '5 years');
    const upRes = await request(app)
      .post(`/api/v1/batches/${batchId}/candidates/upload`)
      .set('Authorization', `Bearer ${tokenA}`)
      .attach('files', pdf, 'preview.pdf');

    const candId = upRes.body.data[0].id;

    const urlRes = await request(app)
      .get(`/api/v1/batches/${batchId}/candidates/${candId}/resume-url`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(urlRes.status).toBe(200);
    expect(urlRes.body.success).toBe(true);
    expect(urlRes.body.data.signedUrl).toBeDefined();
    expect(urlRes.body.data.signedUrl).toContain('http');
  });

  it('exports batch candidates to CSV format', async () => {
    const csvRes = await request(app)
      .get(`/api/v1/batches/${batchId}/export/csv`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(csvRes.status).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(csvRes.text).toContain('ID,Name,Email,Phone,Score,Decision');
  });
});

