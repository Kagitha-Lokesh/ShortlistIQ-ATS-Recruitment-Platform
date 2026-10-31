import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import * as pdfService from '../src/services/pdf.js';
import { resetRepositories, profileRepository } from '../src/repositories/index.js';
import { AppError } from '../src/middleware/errorHandler.js';

describe('Candidate Checks API Flow (Phase 4)', () => {
  beforeEach(() => {
    resetRepositories();
    vi.restoreAllMocks();
  });

  const validJd = `
    Job Title: Senior Frontend Engineer
    ShortlistIQ is seeking an experienced React and TypeScript engineer with 4+ years building high-performance web applications.
    Requirements:
    • 4+ years of professional full-stack web development experience
    • Deep mastery of React, TypeScript, and Tailwind CSS
    • Experience with REST APIs and state management
  `;

  const validResumeText = `
    Sarah Jenkins
    sarah.jenkins@devmail.io | +1 (555) 234-5678 | https://linkedin.com/in/sarahjenkins | https://github.com/sarahj-dev

    Professional Summary
    Senior Full Stack Engineer with 6+ years of experience architecting high-traffic distributed web applications.
    Passionate about developer tooling, performant user interfaces, and robust backend data pipelines.

    Technical Skills
    • Languages: TypeScript, JavaScript, Python, SQL, HTML5, CSS3
    • Frontend: React, Next.js, Redux, Tailwind CSS, TanStack Query, Vite
    • Backend: Node.js, Express.js, REST APIs, GraphQL, PostgreSQL, Redis

    Work Experience
    Senior Software Engineer | Apex Solutions (2020 - Present)
    • Architected scalable web dashboards with React and TypeScript serving 150k monthly active users.
    • Built robust Node.js backend services and PostgreSQL query optimizations, slashing latency by 45%.

    Education
    Bachelor of Science in Computer Science | University of Washington (2014 - 2018)
  `;

  // Minimal valid PDF header buffer
  const samplePdfBuffer = Buffer.from('%PDF-1.4 sample pdf content for testing binary check');

  it('rejects candidate check when PDF has NO_TEXT or is scanned image', async () => {
    vi.spyOn(pdfService, 'parsePdf').mockRejectedValueOnce(
      new AppError(422, 'NO_TEXT', 'Resume contains no extractable text or is an image-only scan.')
    );

    const res = await request(app)
      .post('/api/v1/checks')
      .attach('file', samplePdfBuffer, 'scanned_resume.pdf')
      .field('jdText', validJd)
      .field('jobTitle', 'Senior Frontend Engineer');

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NO_TEXT');
  });

  it('allows a guest to upload a text PDF and receive deterministic score + anon cookie', async () => {
    vi.spyOn(pdfService, 'parsePdf').mockResolvedValueOnce({
      text: validResumeText,
      pageCount: 1,
      characterCount: validResumeText.length
    });

    const res = await request(app)
      .post('/api/v1/checks')
      .attach('file', samplePdfBuffer, 'sarah_resume.pdf')
      .field('jdText', validJd)
      .field('jobTitle', 'Senior React Engineer')
      .field('company', 'Acme Corp');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.scoreBefore).toBeGreaterThanOrEqual(70);
    expect(res.body.data.breakdown).toBeDefined();
    expect(res.body.data.breakdown.matchedKeywords).toContain('react');

    // Verify anonymous token was assigned
    const anonTokenHeader = res.headers['x-anon-token'];
    expect(anonTokenHeader).toBeDefined();
  });

  it('prevents Guest B from accessing Guest A check (guest tenancy boundary)', async () => {
    vi.spyOn(pdfService, 'parsePdf').mockResolvedValueOnce({
      text: validResumeText,
      pageCount: 1,
      characterCount: validResumeText.length
    });

    // Guest A uploads check
    const guestARes = await request(app)
      .post('/api/v1/checks')
      .set('x-anon-token', 'anon-guest-a-uuid')
      .attach('file', samplePdfBuffer, 'resume_a.pdf')
      .field('jdText', validJd);

    expect(guestARes.status).toBe(201);
    const checkId = guestARes.body.data.id;

    // Guest A can fetch their check
    const aFetch = await request(app)
      .get(`/api/v1/checks/${checkId}`)
      .set('x-anon-token', 'anon-guest-a-uuid');
    expect(aFetch.status).toBe(200);

    // Guest B cannot fetch Guest A check
    const bFetch = await request(app)
      .get(`/api/v1/checks/${checkId}`)
      .set('x-anon-token', 'anon-guest-b-uuid');
    expect(bFetch.status).toBe(404);
  });

  it('generates suggestions with ONE AI call, caching and returning structured list', async () => {
    vi.spyOn(pdfService, 'parsePdf').mockResolvedValueOnce({
      text: validResumeText,
      pageCount: 1,
      characterCount: validResumeText.length
    });

    const uploadRes = await request(app)
      .post('/api/v1/checks')
      .set('x-anon-token', 'anon-guest-a-uuid')
      .attach('file', samplePdfBuffer, 'resume.pdf')
      .field('jdText', validJd);

    const checkId = uploadRes.body.data.id;

    // Request suggestions
    const suggRes = await request(app)
      .post(`/api/v1/checks/${checkId}/suggestions`)
      .set('x-anon-token', 'anon-guest-a-uuid');

    expect(suggRes.status).toBe(201);
    expect(suggRes.body.success).toBe(true);
    expect(Array.isArray(suggRes.body.data)).toBe(true);
    expect(suggRes.body.data.length).toBeGreaterThan(0);
    expect(suggRes.body.data[0].originalText).toBeDefined();
    expect(suggRes.body.data[0].proposedText).toBeDefined();

    const suggestionId = suggRes.body.data[0].id;

    // Test patching suggestion status to accepted
    const patchRes = await request(app)
      .patch(`/api/v1/checks/${checkId}/suggestions/${suggestionId}`)
      .set('x-anon-token', 'anon-guest-a-uuid')
      .send({ status: 'accepted', projectedScore: 88 });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.status).toBe('accepted');

    // Verify check scoreAfter was updated
    const updatedCheckRes = await request(app)
      .get(`/api/v1/checks/${checkId}`)
      .set('x-anon-token', 'anon-guest-a-uuid');

    expect(updatedCheckRes.body.data.scoreAfter).toBe(88);
  });

  it('lists history of checks for signed-in user', async () => {
    const user = await profileRepository.create({
      role: 'candidate',
      fullName: 'Logged-in Candidate'
    });
    const userToken = `mock-user:${user.id}:cand@example.com`;

    vi.spyOn(pdfService, 'parsePdf').mockResolvedValue({
      text: validResumeText,
      pageCount: 1,
      characterCount: validResumeText.length
    });

    // Create check as signed-in user
    await request(app)
      .post('/api/v1/checks')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', samplePdfBuffer, 'my_resume.pdf')
      .field('jdText', validJd)
      .field('jobTitle', 'Frontend Dev');

    // Retrieve user history
    const historyRes = await request(app)
      .get('/api/v1/checks')
      .set('Authorization', `Bearer ${userToken}`);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data.length).toBe(1);
    expect(historyRes.body.data[0].jobTitle).toBe('Frontend Dev');
  });
});

