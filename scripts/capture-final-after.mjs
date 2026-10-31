import { Browser, sleep } from '../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import fs from 'fs';
import path from 'path';

const OUT_DIR = path.resolve('docs/ui-review/after');
fs.mkdirSync(OUT_DIR, { recursive: true });

const WIDTHS = [375, 768, 1024, 1440];
const HEIGHTS = { 375: 812, 768: 1024, 1024: 768, 1440: 900 };

const MOCK_CHECK_ID = 'e706fee6-1ef4-4415-a90d-2ddb2f50bcb9';
const MOCK_CHECK = {
  id: MOCK_CHECK_ID,
  jobTitle: 'Senior Full Stack Engineer',
  company: 'Apex Innovations',
  scoreBefore: 85,
  scoreAfter: 92,
  status: 'completed',
  createdAt: new Date().toISOString(),
  jdText: 'Job Title: Senior Full Stack Engineer\nRequirements: 5+ years of React, Node.js, TypeScript, PostgreSQL, and AWS.',
  resumeText: 'Alex Morgan\nalex.morgan@example.com | 555-0199\nSummary: Full stack engineer with 6 years experience in React, Node.js, TypeScript and PostgreSQL.',
  breakdown: {
    overallScore: 85,
    keywordScore: 78,
    skillsScore: 88,
    experienceScore: 95,
    formattingScore: 92,
    readabilityScore: 72,
    detectedYearsExperience: 6,
    matchedKeywords: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'APIs', 'Docker', 'Git'],
    missingKeywords: ['AWS', 'Kubernetes', 'GraphQL'],
    basics: {
      name: 'Alex Morgan',
      email: 'alex.morgan@example.com',
      phone: '+1 (555) 019-9281',
      links: {
        linkedin: 'https://linkedin.com/in/alexmorgan-dev',
        github: 'https://github.com/alexmorgan-dev'
      }
    }
  },
  suggestions: [
    {
      id: 'sugg-1',
      section: 'Work Experience',
      originalText: 'Built web applications in React and Node.',
      proposedText: 'Architected high-throughput microservices using React, Node.js, and PostgreSQL, reducing API latency by 35%.',
      reason: 'Adds quantifiable impact metrics and key database technology required by target job.',
      impact: 'high',
      status: 'pending'
    },
    {
      id: 'sugg-2',
      section: 'Skills',
      originalText: 'Languages: JavaScript, HTML, CSS',
      proposedText: 'Languages & Frameworks: TypeScript, React, Node.js, PostgreSQL, Docker',
      reason: 'Aligns core technical skills list with must-have job requirements.',
      impact: 'high',
      status: 'accepted'
    }
  ]
};

async function main() {
  console.log('Provisioning test HR workspace...');
  const hrEmail = `lead.recruiter-${Date.now()}@apexcorp.com`;
  const hrRes = await fetch('http://localhost:4000/api/v1/auth/signup-hr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: hrEmail,
      password: 'Password123!',
      fullName: 'Sarah Jenkins',
      organizationName: 'Apex Innovations Inc.'
    })
  });

  const hrData = await hrRes.json();
  const token = hrData.data?.token;
  console.log('HR Token acquired:', !!token);

  // Create a batch
  const batchRes = await fetch('http://localhost:4000/api/v1/batches', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'Senior Full Stack Engineer Q4',
      jobTitle: 'Senior Full Stack Engineer',
      jdText: '5+ years experience in React, Node.js, TypeScript, PostgreSQL, and Docker. Experience with microservices architecture.'
    })
  });
  const batchData = await batchRes.json();
  const batchId = batchData.data?.id;
  console.log('Batch created:', batchId);

  // Upload resume fixture
  if (batchId && fs.existsSync('Lokesh_Resume.pdf')) {
    const pdfBuffer = fs.readFileSync('Lokesh_Resume.pdf');
    const formData = new FormData();
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    formData.append('files', blob, 'Lokesh_Resume.pdf');

    await fetch(`http://localhost:4000/api/v1/batches/${batchId}/candidates/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    console.log('Uploaded candidate resume. Waiting for parser...');
    await sleep(3500);
  }

  // Create an application form
  let formId = null;
  if (batchId) {
    const formRes = await fetch(`http://localhost:4000/api/v1/batches/${batchId}/forms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        title: 'Senior Full Stack Engineer Application',
        description: 'Please complete this initial screening form and upload your resume.',
        fields: [
          { id: 'exp_years', label: 'Years of React Experience', type: 'number', required: true },
          { id: 'auth_work', label: 'Authorized to work in US/Remote', type: 'boolean', required: true }
        ],
        knockoutRules: []
      })
    });
    if (formRes.ok) {
      const fData = await formRes.json();
      formId = fData.data?.id;
      console.log('Public form created:', formId);
    }
  }

  console.log('Launching headless browser for 4-breakpoint capture...');
  const browser = await Browser.launch({ width: 1440, height: 900 });

  try {
    for (const w of WIDTHS) {
      const h = HEIGHTS[w] || 800;
      console.log(`\n================ Viewport ${w}x${h} ================`);
      const page = await browser.newPage({ width: w, height: h, mobile: w < 768 });

      // Seed candidate check and HR token in localStorage on localhost:5173 origin
      await page.goto('http://localhost:5173/auth/signin', { settleMs: 500 }).catch(() => {});
      await page.eval(({ mock, token: t }) => {
        const list = [mock];
        localStorage.setItem('shortlistiq_ats_checks', JSON.stringify(list));
        localStorage.setItem('current_check', JSON.stringify(mock));
        localStorage.setItem('candidate_checks', JSON.stringify(list));
        if (t) localStorage.setItem('shortlistiq_auth_token', t);
      }, { mock: MOCK_CHECK, token });

      const screens = [
        { name: 'landing', url: 'http://localhost:5173/' },
        { name: 'signin', url: 'http://localhost:5173/auth/signin' },
        { name: 'signup-hr', url: 'http://localhost:5173/auth/signup-hr' },
        { name: 'checker', url: 'http://localhost:5173/checker' },
        { name: 'results', url: `http://localhost:5173/checks/${MOCK_CHECK_ID}` },
        { name: 'suggestions', url: `http://localhost:5173/checks/${MOCK_CHECK_ID}/suggestions` },
        { name: 'export', url: `http://localhost:5173/checks/${MOCK_CHECK_ID}/export` },
        { name: 'history', url: 'http://localhost:5173/checker/history' },
        { name: 'deletion', url: 'http://localhost:5173/privacy/delete-data' },
        { name: 'hr-dashboard', url: 'http://localhost:5173/hr/dashboard' },
        { name: 'hr-batch-wizard', url: 'http://localhost:5173/hr/batches/new' },
        { name: 'hr-settings', url: 'http://localhost:5173/hr/settings' }
      ];

      if (batchId) {
        screens.push({ name: 'batch-results', url: `http://localhost:5173/hr/batches/${batchId}` });
      }

      if (formId) {
        screens.push({ name: 'public-apply', url: `http://localhost:5173/apply/${formId}` });
      }

      for (const s of screens) {
        try {
          await page.goto(s.url, { settleMs: 1500 });
          await sleep(400);
          const outName = `${s.name}-${w}px.png`;
          await page.screenshot({ path: path.join(OUT_DIR, outName), format: 'png' });
          console.log(`  [OK] Captured ${outName}`);
        } catch (e) {
          console.warn(`  [FAIL] ${s.name} at ${w}px:`, e.message);
        }
      }

      // If on 1440px desktop, also capture open candidate drawer & modals
      if (w === 1440 && batchId) {
        try {
          console.log('Capturing Candidate Drawer on 1440px...');
          await page.goto(`http://localhost:5173/hr/batches/${batchId}`, { settleMs: 2000 });
          await sleep(600);
          await page.eval(() => {
            const row = document.querySelector('.candidate-row') || document.querySelector('tbody tr');
            if (row) row.click();
          });
          await sleep(1000);
          await page.screenshot({ path: path.join(OUT_DIR, 'candidate-drawer-1440px.png'), format: 'png' });
          console.log('  [OK] Captured candidate-drawer-1440px.png');

          // Close drawer
          await page.eval(() => {
            const closeBtn = document.querySelector('button[aria-label="Close drawer"]');
            if (closeBtn) closeBtn.click();
          });
          await sleep(500);

          // Capture Finalize Email Modal
          console.log('Capturing Finalize & Email Modal on 1440px...');
          await page.eval(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Finalize & Send Emails'));
            if (btn) btn.click();
          });
          await sleep(1000);
          await page.screenshot({ path: path.join(OUT_DIR, 'finalize-email-1440px.png'), format: 'png' });
          console.log('  [OK] Captured finalize-email-1440px.png');

          // Cancel modal
          await page.eval(() => {
            const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancel');
            if (cancelBtn) cancelBtn.click();
          });
          await sleep(500);

          // Capture Form Builder Modal
          console.log('Capturing Form Builder on 1440px...');
          await page.eval(() => {
            const formsBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Forms');
            if (formsBtn) formsBtn.click();
          });
          await sleep(800);
          await page.eval(() => {
            const editBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Edit Form' || b.textContent.trim() === 'Create Form');
            if (editBtn) editBtn.click();
          });
          await sleep(1000);
          await page.screenshot({ path: path.join(OUT_DIR, 'form-builder-1440px.png'), format: 'png' });
          console.log('  [OK] Captured form-builder-1440px.png');
        } catch (mErr) {
          console.warn('Modal capture warning:', mErr.message);
        }
      }

      await page.close();
    }
  } finally {
    await browser.close();
    console.log('\nAll multi-breakpoint screen captures successfully completed!');
  }
}

main().catch(console.error);
