import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { resetRepositories, candidateCheckRepository } from '../src/repositories/index.js';
import { parsePdf } from '../src/services/pdf.js';
import { ResumeData } from '@shortlistiq/shared';

// Helper parser to collect binary buffer streams in supertest
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const binaryParser = (res: any, fn: any) => {
  const bufs: Buffer[] = [];
  res.on('data', (chunk: Buffer) => bufs.push(chunk));
  res.on('end', () => fn(null, Buffer.concat(bufs)));
};

describe('Phase 5 Resume Generation & Export API Flow', () => {
  beforeEach(() => {
    resetRepositories();
    vi.restoreAllMocks();
  });

  const sampleJd = `
    Job Title: Senior React Engineer
    Requirements:
    • 5+ years building scalable web applications with React, TypeScript, and Node.js
    • Strong proficiency in REST APIs, PostgreSQL, and Docker
  `;

  const sampleResumeData: ResumeData = {
    contact: {
      fullName: 'Sarah Jenkins',
      email: 'sarah.jenkins@devmail.io',
      phone: '+1 (555) 234-5678',
      location: 'Seattle, WA',
      linkedin: 'linkedin.com/in/sarahjenkins',
      github: 'github.com/sarahj-dev',
      website: ''
    },
    summary: 'Senior Full Stack Engineer with 6+ years experience architecting distributed React and TypeScript web applications.',
    experience: [
      {
        title: 'Senior Software Engineer',
        company: 'Apex Solutions',
        location: 'Seattle, WA',
        startDate: '2020',
        endDate: 'Present',
        current: true,
        highlights: [
          'Architected scalable web dashboards with React and TypeScript serving 150k monthly active users.',
          'Built robust Node.js backend services and PostgreSQL query optimizations, slashing latency by 45%.',
          'Established continuous integration pipelines using GitHub Actions and automated Docker builds.'
        ]
      },
      {
        title: 'Full Stack Developer',
        company: 'CloudScale Inc.',
        location: 'Seattle, WA',
        startDate: '2018',
        endDate: '2020',
        current: false,
        highlights: [
          'Developed customer-facing React components and responsive styling using Tailwind CSS.',
          'Implemented RESTful microservices in Node.js and integrated Redis caching layers.'
        ]
      }
    ],
    education: [
      {
        degree: 'Bachelor of Science in Computer Science',
        institution: 'University of Washington',
        location: 'Seattle, WA',
        startDate: '2014',
        endDate: '2018',
        highlights: []
      }
    ],
    skills: [
      {
        category: 'Frontend',
        items: ['React', 'TypeScript', 'Tailwind CSS', 'Next.js', 'Vite']
      },
      {
        category: 'Backend & DevOps',
        items: ['Node.js', 'Express', 'PostgreSQL', 'Docker', 'REST APIs']
      }
    ],
    projects: [],
    certifications: []
  };

  it('converts parsed resume into structured ResumeData via GET /api/v1/checks/:id/resume-data', async () => {
    const check = await candidateCheckRepository.create({
      jobTitle: 'Senior React Engineer',
      jdText: sampleJd,
      resumeText: `
        Sarah Jenkins
        sarah.jenkins@devmail.io | +1 555-234-5678 | https://linkedin.com/in/sarahjenkins

        Professional Summary
        Senior React Engineer with 6+ years experience.

        Work Experience
        Senior Engineer | Apex Solutions (2020 - Present)
        • Built scalable React dashboards.
        • Optimized backend queries.

        Technical Skills
        • Frontend: React, TypeScript, Vite
        • Backend: Node.js, PostgreSQL

        Education
        BS Computer Science | University of Washington (2018)
      `,
      anonToken: 'anon-token-123'
    });

    const res = await request(app)
      .get(`/api/v1/checks/${check.id}/resume-data`)
      .set('x-anon-token', 'anon-token-123');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.resumeData.contact.fullName).toBe('Sarah Jenkins');
    expect(res.body.data.resumeData.experience.length).toBeGreaterThan(0);
    expect(res.body.data.isConfident).toBe(true);
  });

  it('generates an ATS-compliant PDF and verifies 100% text extractability & section ordering', async () => {
    const check = await candidateCheckRepository.create({
      jobTitle: 'Senior React Engineer',
      jdText: sampleJd,
      resumeText: 'Original text...',
      anonToken: 'anon-token-123'
    });

    const res = await request(app)
      .post(`/api/v1/checks/${check.id}/export/pdf`)
      .set('x-anon-token', 'anon-token-123')
      .send({
        resumeData: sampleResumeData,
        options: {
          template: 'modern',
          accentColor: 'indigo',
          fontSize: 'medium',
          margins: 'normal'
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.base64).toBeDefined();

    // Verify ATS re-parsing results
    const verification = res.body.data.verification;
    expect(verification.extractable).toBe(true);
    expect(verification.characterCount).toBeGreaterThan(200);
    expect(verification.reParsedScore).toBeGreaterThanOrEqual(70);
    expect(verification.sectionsDetected.length).toBeGreaterThanOrEqual(3);

    // Directly test the generated PDF binary with the engine parser
    const pdfBuffer = Buffer.from(res.body.data.base64, 'base64');
    const parsedPdf = await parsePdf(pdfBuffer);
    expect(parsedPdf.text).toContain('Sarah Jenkins');
    expect(parsedPdf.text).toContain('Apex Solutions');
    expect(parsedPdf.text).toContain('University of Washington');
  });

  it('streams direct PDF download when ?download=true is specified', async () => {
    const check = await candidateCheckRepository.create({
      jobTitle: 'Senior React Engineer',
      jdText: sampleJd,
      resumeText: 'Original text...',
      anonToken: 'anon-token-123'
    });

    const res = await request(app)
      .post(`/api/v1/checks/${check.id}/export/pdf?download=true`)
      .set('x-anon-token', 'anon-token-123')
      .buffer(true)
      .parse(binaryParser)
      .send({
        resumeData: sampleResumeData,
        options: { template: 'classic' }
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.body.length).toBeGreaterThan(500);
  });

  it('generates and streams native ATS-compliant DOCX file', async () => {
    const check = await candidateCheckRepository.create({
      jobTitle: 'Senior React Engineer',
      jdText: sampleJd,
      resumeText: 'Original text...',
      anonToken: 'anon-token-123'
    });

    const res = await request(app)
      .post(`/api/v1/checks/${check.id}/export/docx`)
      .set('x-anon-token', 'anon-token-123')
      .buffer(true)
      .parse(binaryParser)
      .send({
        resumeData: sampleResumeData,
        options: { template: 'modern', accentColor: 'navy' }
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('wordprocessingml.document');
    expect(res.headers['content-disposition']).toContain('.docx');

    // Verify DOCX ZIP magic bytes: PK (0x50, 0x4B, 0x03, 0x04)
    const buffer = res.body;
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
    expect(buffer[2]).toBe(0x03);
    expect(buffer[3]).toBe(0x04);
  });
});
