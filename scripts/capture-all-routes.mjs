import { Browser, sleep } from '../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import fs from 'fs';
import path from 'path';

const OUT_DIR = path.resolve('docs/ui-review/before');
fs.mkdirSync(OUT_DIR, { recursive: true });

const WIDTHS = [375, 768, 1024, 1440];
const HEIGHTS = { 375: 812, 768: 1024, 1024: 768, 1440: 900 };

// Sample mock data for candidate check
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

// Mock HR Profile & Org
const MOCK_HR_AUTH = {
  user: {
    id: 'hr-user-001',
    email: 'hiring.lead@apex.com',
    role: 'hr',
    fullName: 'Sarah Jenkins',
    organizationId: 'org-apex-001'
  },
  organization: {
    id: 'org-apex-001',
    name: 'Apex Innovations Inc.',
    retentionDays: 60
  }
};

const ROUTES = [
  { name: '01_landing', path: '/' },
  { name: '02_signin', path: '/auth/signin' },
  { name: '03_signup_hr', path: '/auth/signup-hr' },
  { name: '04_checker_empty', path: '/checker', setup: 'clear_checks' },
  { name: '05_checker_populated', path: '/checker', setup: 'seed_check' },
  { name: '06_results_populated', path: `/checks/${MOCK_CHECK_ID}`, setup: 'seed_check' },
  { name: '07_results_error', path: '/checks/non-existent-uuid', setup: 'clear_checks' },
  { name: '08_suggestions_populated', path: `/checks/${MOCK_CHECK_ID}/suggestions`, setup: 'seed_check' },
  { name: '09_export_editor', path: `/checks/${MOCK_CHECK_ID}/export`, setup: 'seed_check' },
  { name: '10_privacy_delete_data', path: '/privacy/delete-data' },
  { name: '11_privacy_policy', path: '/privacy' },
  { name: '12_terms', path: '/terms' },
  { name: '13_hr_dashboard_auth', path: '/hr/dashboard', setup: 'auth_hr' },
  { name: '14_hr_batches_new', path: '/hr/batches/new', setup: 'auth_hr' },
  { name: '15_hr_settings', path: '/hr/settings', setup: 'auth_hr' }
];

async function main() {
  console.log('Launching headless browser...');
  const browser = await Browser.launch({ width: 1440, height: 900 });

  try {
    for (const w of WIDTHS) {
      const h = HEIGHTS[w] || 800;
      console.log(`\n================ Viewport ${w}x${h} ================`);
      const page = await browser.newPage({ width: w, height: h, mobile: w < 768 });

      for (const route of ROUTES) {
        const outName = `${route.name}_${w}px.png`;
        const outPath = path.join(OUT_DIR, outName);

        try {
          // Navigate first to host origin
          await page.goto(`http://localhost:5173${route.path}`, { settleMs: 600 });

          // Apply setup state in browser context
          if (route.setup === 'seed_check') {
            await page.eval((mock) => {
              const list = [mock];
              localStorage.setItem('shortlistiq_ats_checks', JSON.stringify(list));
              localStorage.setItem('shortlistiq_anon_token', 'anon-mock-tester-12345');
            }, MOCK_CHECK);
            // Refresh to apply localStorage state
            await page.goto(`http://localhost:5173${route.path}`, { settleMs: 800 });
          } else if (route.setup === 'clear_checks') {
            await page.eval(() => {
              localStorage.removeItem('shortlistiq_ats_checks');
            });
            await page.goto(`http://localhost:5173${route.path}`, { settleMs: 600 });
          } else if (route.setup === 'auth_hr') {
            await page.eval((auth) => {
              localStorage.setItem('shortlistiq_auth_token', 'mock-jwt-hr-valid-token');
              localStorage.setItem('shortlistiq_mock_profile', JSON.stringify(auth.user));
              localStorage.setItem('shortlistiq_mock_org', JSON.stringify(auth.organization));
            }, MOCK_HR_AUTH);
            await page.goto(`http://localhost:5173${route.path}`, { settleMs: 800 });
          }

          // Let GSAP transitions settle
          await sleep(500);

          await page.screenshot({ path: outPath, format: 'png' });
          console.log(`[PASS] Captured ${outName}`);
        } catch (err) {
          console.error(`[FAIL] Error capturing ${outName}:`, err.message);
        }
      }

      await page.close();
    }
  } finally {
    await browser.close();
    console.log('\nAll captures finished. Screenshots saved in docs/ui-review/before/.');
  }
}

main().catch(console.error);

