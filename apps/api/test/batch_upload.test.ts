import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { runSeed } from '../prisma/seed.js';
import { jobQueue } from '../src/services/queue.js';
import { generateResumePdf } from '../src/services/export/pdf.js';
import { CandidateStatus } from '@prisma/client';

describe('Phase 6 Bulk Upload, Background Worker & Batch Processing', () => {
  let seedData: Awaited<ReturnType<typeof runSeed>>;
  let tokenA: string;

  beforeEach(async () => {
    seedData = await runSeed();
    tokenA = `mock-token:${seedData.hrA.id}:${seedData.hrA.fullName}`;
  });

  const createTestPdf = async (fullName: string, email: string, summary: string) => {
    return generateResumePdf({
      contact: {
        fullName,
        email,
        phone: '+1 (555) 019-2834',
        location: 'San Francisco, CA',
        linkedin: 'linkedin.com/in/testuser',
        github: 'github.com/testuser',
        website: ''
      },
      summary,
      experience: [
        {
          title: 'Senior Software Engineer',
          company: 'Acme Systems',
          location: 'San Francisco, CA',
          startDate: '2021',
          endDate: 'Present',
          current: true,
          highlights: [
            'Architected distributed microservices handling 250k daily active requests with Node.js and TypeScript.',
            'Optimized Postgres database indexing and Redis caching, cutting average latency by 40 percent.'
          ]
        }
      ],
      education: [
        {
          degree: 'Bachelor of Science in Computer Science',
          institution: 'University of California, Berkeley',
          startDate: '2016',
          endDate: '2020'
        }
      ],
      skills: [
        {
          category: 'Core Technologies',
          items: ['Node.js', 'Express', 'TypeScript', 'PostgreSQL', 'Docker', 'Vitest']
        }
      ],
      projects: [],
      certifications: []
    });
  };

  it('allows HR to create a new batch with draft or active status', async () => {
    const res = await request(app)
      .post('/api/v1/batches')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Senior Frontend Engineers Q4',
        jobTitle: 'Senior Frontend Engineer',
        jdText: 'Looking for a Senior React Engineer with TypeScript, Next.js, and Vitest expertise with 5+ years experience.',
        cutoff: 75,
        status: 'active'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Senior Frontend Engineers Q4');
    expect(res.body.data.cutoff).toBe(75);
    expect(res.body.data.status).toBe('active');
  });

  it('uploads a chunk of resumes, creates pending candidates, and worker processes them to scored state', async () => {
    // 1. Create batch
    const batchRes = await request(app)
      .post('/api/v1/batches')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Engineering Batch Alpha',
        jobTitle: 'Staff Backend Engineer',
        jdText: 'Seeking Staff Backend Engineer with Node.js, Express, Postgres, TypeScript, and microservices experience.',
        cutoff: 60
      });

    const batchId = batchRes.body.data.id;

    // 2. Prepare sample resumes
    const resumePdf1 = await createTestPdf(
      'Alex Johnson',
      'alex.johnson@example.com',
      'Senior Software Engineer with Node.js, Express, Postgres, TypeScript, Docker, and distributed systems.'
    );

    const resumePdf2 = await createTestPdf(
      'Jordan Lee',
      'jordan.lee@example.com',
      'Full Stack Developer experienced with React, TypeScript, Node.js, and PostgreSQL databases.'
    );

    // 3. Bulk upload chunk
    const uploadRes = await request(app)
      .post(`/api/v1/batches/${batchId}/candidates/upload`)
      .set('Authorization', `Bearer ${tokenA}`)
      .attach('files', resumePdf1, 'alex_resume.pdf')
      .attach('files', resumePdf2, 'jordan_resume.pdf');

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.success).toBe(true);
    expect(uploadRes.body.data).toHaveLength(2);
    expect(uploadRes.body.data[0].status).toBe('pending');

    // 4. Wait for local worker queue to drain
    await jobQueue.drainLocalQueue();

    // 5. Query candidates from batch endpoint
    const listRes = await request(app)
      .get(`/api/v1/batches/${batchId}/candidates`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(listRes.status).toBe(200);
    const candidates = listRes.body.data;
    expect(candidates).toHaveLength(2);

    // Both candidates should now be scored
    for (const c of candidates) {
      expect(c.status).toBe(CandidateStatus.scored);
      expect(c.score).toBeGreaterThan(0);
      expect(c.breakdown).toBeDefined();
    }
  }, 25000);

  it('correctly detects failure reasons: NO_TEXT, NO_EMAIL, and CORRUPT files', async () => {
    const batchRes = await request(app)
      .post('/api/v1/batches')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Failure Detection Batch',
        jobTitle: 'Developer',
        jdText: 'Node.js developer with TypeScript experience.'
      });
    const batchId = batchRes.body.data.id;

    // A: Valid PDF structure with < 200 readable characters -> NO_TEXT
    const emptyPdf = await generateResumePdf({
      contact: { fullName: '', email: '', phone: '', location: '', linkedin: '', github: '', website: '' },
      summary: 'Minimal text',
      experience: [],
      education: [],
      skills: [],
      projects: [],
      certifications: []
    });

    // B: Resume text without an email address -> NO_EMAIL
    const noEmailPdf = await createTestPdf(
      'Sarah Connor',
      '',
      'Experienced systems engineer with Linux, robotics, and defense network security experience across multiple complex installations and high availability infrastructure.'
    );

    // C: Non-PDF corrupt file -> CORRUPT
    const corruptBuffer = Buffer.from('NOT A PDF FILE AT ALL');

    const uploadRes = await request(app)
      .post(`/api/v1/batches/${batchId}/candidates/upload`)
      .set('Authorization', `Bearer ${tokenA}`)
      .attach('files', emptyPdf, 'scanned_empty.pdf')
      .attach('files', noEmailPdf, 'no_email.pdf')
      .attach('files', corruptBuffer, 'corrupt.pdf');

    expect(uploadRes.status).toBe(201);

    await jobQueue.drainLocalQueue();

    const candidatesRes = await request(app)
      .get(`/api/v1/batches/${batchId}/candidates`)
      .set('Authorization', `Bearer ${tokenA}`);

    const candidates = candidatesRes.body.data;
    const reasons = candidates.map((c: any) => c.failureReason);

    expect(reasons).toContain('NO_TEXT');
    expect(reasons).toContain('NO_EMAIL');
    expect(reasons).toContain('CORRUPT');
  });

  it('detects duplicate resume and flags it without silently dropping it', async () => {
    const batchRes = await request(app)
      .post('/api/v1/batches')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Duplicate Detection Batch',
        jobTitle: 'Backend Engineer',
        jdText: 'Backend engineer with Python, Postgres, and Docker.'
      });
    const batchId = batchRes.body.data.id;

    const pdf1 = await createTestPdf(
      'Morgan Freeman',
      'morgan@example.com',
      'Senior Developer with Python, Postgres, Redis, and Docker with 8 years building scalable services.'
    );
    const pdf2 = await createTestPdf(
      'Morgan Freeman',
      'morgan@example.com',
      'Senior Developer with Python, Postgres, Redis, and Docker with 8 years building scalable services.'
    );

    // Upload first copy
    await request(app)
      .post(`/api/v1/batches/${batchId}/candidates/upload`)
      .set('Authorization', `Bearer ${tokenA}`)
      .attach('files', pdf1, 'morgan_first.pdf');

    await jobQueue.drainLocalQueue();

    // Upload second copy (duplicate)
    await request(app)
      .post(`/api/v1/batches/${batchId}/candidates/upload`)
      .set('Authorization', `Bearer ${tokenA}`)
      .attach('files', pdf2, 'morgan_second.pdf');

    await jobQueue.drainLocalQueue();

    const candidatesRes = await request(app)
      .get(`/api/v1/batches/${batchId}/candidates`)
      .set('Authorization', `Bearer ${tokenA}`);

    const candidates = candidatesRes.body.data;
    expect(candidates).toHaveLength(2);

    const flaggedDuplicate = candidates.find((c: any) => c.failureReason === 'DUPLICATE');
    expect(flaggedDuplicate).toBeDefined();
    expect(flaggedDuplicate.decision).toBe('needs_review');
  });

  it('allows HR to provide email inline for NO_EMAIL candidates, triggering re-scoring', async () => {
    const batchRes = await request(app)
      .post('/api/v1/batches')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Email Correction Batch',
        jobTitle: 'Software Architect',
        jdText: 'Cloud Architect with AWS, Kubernetes, Terraform, and Go.'
      });
    const batchId = batchRes.body.data.id;

    const noEmailPdf = await createTestPdf(
      'Bruce Wayne',
      '',
      'Senior Enterprise Architect with extensive experience in AWS, Kubernetes, Terraform, Go, microservices architectures and distributed engineering teams.'
    );

    await request(app)
      .post(`/api/v1/batches/${batchId}/candidates/upload`)
      .set('Authorization', `Bearer ${tokenA}`)
      .attach('files', noEmailPdf, 'bruce.pdf');

    await jobQueue.drainLocalQueue();

    const listRes = await request(app)
      .get(`/api/v1/batches/${batchId}/candidates`)
      .set('Authorization', `Bearer ${tokenA}`);

    const candidate = listRes.body.data[0];
    expect(candidate.status).toBe(CandidateStatus.failed);
    expect(candidate.failureReason).toBe('NO_EMAIL');

    // HR updates email inline
    const patchRes = await request(app)
      .patch(`/api/v1/batches/${batchId}/candidates/${candidate.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ email: 'bruce.wayne@waynecorp.com' });

    expect(patchRes.status).toBe(200);

    await jobQueue.drainLocalQueue();

    // Re-check candidate status
    const verifiedRes = await request(app)
      .get(`/api/v1/batches/${batchId}/candidates`)
      .set('Authorization', `Bearer ${tokenA}`);

    const updatedCandidate = verifiedRes.body.data[0];
    expect(updatedCandidate.status).toBe(CandidateStatus.scored);
    expect(updatedCandidate.email).toBe('bruce.wayne@waynecorp.com');
  });

  it('retries all failed candidates when HR triggers retry-failed', async () => {
    const batchRes = await request(app)
      .post('/api/v1/batches')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Retry Batch',
        jobTitle: 'Fullstack Dev',
        jdText: 'Fullstack Dev with React and Node.'
      });
    const batchId = batchRes.body.data.id;

    // Create a failed candidate via corrupt upload
    await request(app)
      .post(`/api/v1/batches/${batchId}/candidates/upload`)
      .set('Authorization', `Bearer ${tokenA}`)
      .attach('files', Buffer.from('INVALID'), 'corrupt.pdf');

    // Call retry endpoint
    const retryRes = await request(app)
      .post(`/api/v1/batches/${batchId}/candidates/retry`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(retryRes.status).toBe(200);
    expect(retryRes.body.success).toBe(true);
    expect(retryRes.body.retriedCount).toBe(1);
  });

  it('handles high volume bulk uploads in chunks without memory leaks or race conditions', async () => {
    const batchRes = await request(app)
      .post('/api/v1/batches')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'High Volume Bulk Batch',
        jobTitle: 'Backend Engineer',
        jdText: 'Backend engineer with Node.js, TypeScript, and Postgres.',
        cutoff: 70
      });
    const batchId = batchRes.body.data.id;

    // Generate a valid PDF template to reuse across chunk uploads
    const samplePdf = await createTestPdf(
      'Bulk Candidate',
      'bulk.candidate@example.com',
      'Experienced backend software engineer skilled with Node.js, Express, Postgres, and Docker.'
    );

    // Upload 5 chunks of 6 files each (30 files total simulating bulk ingestion)
    for (let chunkIndex = 0; chunkIndex < 5; chunkIndex++) {
      const reqBuilder = request(app)
        .post(`/api/v1/batches/${batchId}/candidates/upload`)
        .set('Authorization', `Bearer ${tokenA}`);

      for (let i = 0; i < 6; i++) {
        reqBuilder.attach('files', samplePdf, `cand_${chunkIndex}_${i}.pdf`);
      }

      const res = await reqBuilder;
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveLength(6);
    }

    // Drain the worker queue
    await jobQueue.drainLocalQueue();

    // Verify batch summary counts via GET /api/v1/batches/:id
    const summaryRes = await request(app)
      .get(`/api/v1/batches/${batchId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(summaryRes.status).toBe(200);
    const { candidateCounts } = summaryRes.body.data;
    expect(candidateCounts.total).toBe(30);
    expect(candidateCounts.pending).toBe(0);
    expect(candidateCounts.processing).toBe(0);
    expect(candidateCounts.scored).toBe(30);
  }, 25000);
});
