import { Browser, sleep } from '../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import axe from 'axe-core';
import fs from 'fs';
import path from 'path';

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
    }
  ]
};

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
  { name: 'Landing Page', path: '/' },
  { name: 'Sign In', path: '/auth/signin' },
  { name: 'Sign Up HR', path: '/auth/signup-hr' },
  { name: 'Candidate Checker Input', path: '/checker', setup: 'candidate' },
  { name: 'Candidate Results', path: `/checks/${MOCK_CHECK_ID}`, setup: 'candidate' },
  { name: 'Candidate Suggestions', path: `/checks/${MOCK_CHECK_ID}/suggestions`, setup: 'candidate' },
  { name: 'Candidate Template & Export', path: `/checks/${MOCK_CHECK_ID}/export`, setup: 'candidate' },
  { name: 'Candidate History', path: '/checker/history', setup: 'candidate' },
  { name: 'Data Deletion Request', path: '/privacy/delete-data' },
  { name: 'HR Dashboard', path: '/hr/dashboard', setup: 'hr' },
  { name: 'HR Batch Wizard', path: '/hr/batches/new', setup: 'hr' },
  { name: 'HR Settings', path: '/hr/settings', setup: 'hr' }
];

async function run() {
  console.log('Launching headless browser for Axe Accessibility Audit...');
  const browser = await Browser.launch({ width: 1440, height: 900 });
  const page = await browser.newPage({ width: 1440, height: 900 });

  const report = [];
  let totalCritical = 0;
  let totalSerious = 0;
  let totalModerate = 0;
  let totalMinor = 0;

  try {
    for (const route of ROUTES) {
      console.log(`\nAuditing: ${route.name} (${route.path})...`);
      
      // Navigate to blank or origin first to set localStorage
      await page.goto('http://localhost:5173/about:blank').catch(() => {});
      
      if (route.setup === 'candidate') {
        await page.eval(`(() => {
          localStorage.setItem('candidate_checks', JSON.stringify([${JSON.stringify(MOCK_CHECK)}]));
          localStorage.setItem('current_check', JSON.stringify(${JSON.stringify(MOCK_CHECK)}));
        })()`);
      } else if (route.setup === 'hr') {
        await page.eval(`(() => {
          localStorage.setItem('sb-shortlistiq-auth-token', JSON.stringify({
            access_token: 'mock-token',
            user: ${JSON.stringify(MOCK_HR_AUTH.user)}
          }));
          localStorage.setItem('shortlistiq_user', JSON.stringify(${JSON.stringify(MOCK_HR_AUTH.user)}));
          localStorage.setItem('shortlistiq_org', JSON.stringify(${JSON.stringify(MOCK_HR_AUTH.organization)}));
        })()`);
      }

      const url = `http://localhost:5173${route.path}`;
      await page.goto(url, { settleMs: 1500 });

      // Inject axe-core
      await page.eval(axe.source);

      // Run axe
      const results = await page.eval(`(async () => {
        return await axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
          }
        });
      })()`);

      const violations = results.violations || [];
      const critical = violations.filter(v => v.impact === 'critical');
      const serious = violations.filter(v => v.impact === 'serious');
      const moderate = violations.filter(v => v.impact === 'moderate');
      const minor = violations.filter(v => v.impact === 'minor');

      totalCritical += critical.length;
      totalSerious += serious.length;
      totalModerate += moderate.length;
      totalMinor += minor.length;

      console.log(`  -> Violations: Critical: ${critical.length}, Serious: ${serious.length}, Moderate: ${moderate.length}, Minor: ${minor.length}`);

      if (critical.length > 0 || serious.length > 0) {
        for (const v of [...critical, ...serious]) {
          console.log(`     [${v.impact.toUpperCase()}] ${v.id}: ${v.help} (${v.nodes.length} occurrences)`);
          for (const node of v.nodes.slice(0, 2)) {
            console.log(`       Target: ${node.target.join(' ')}`);
            console.log(`       Snippet: ${node.html.slice(0, 100)}`);
          }
        }
      }

      report.push({
        name: route.name,
        path: route.path,
        criticalCount: critical.length,
        seriousCount: serious.length,
        moderateCount: moderate.length,
        minorCount: minor.length,
        violations: violations.map(v => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          help: v.help,
          helpUrl: v.helpUrl,
          nodes: v.nodes.map(n => ({
            target: n.target,
            html: n.html,
            failureSummary: n.failureSummary
          }))
        }))
      });
    }

    console.log('\n================ AXE AUDIT SUMMARY ================');
    console.log(`Total Routes Checked: ${ROUTES.length}`);
    console.log(`Total Critical:       ${totalCritical}`);
    console.log(`Total Serious:        ${totalSerious}`);
    console.log(`Total Moderate:       ${totalModerate}`);
    console.log(`Total Minor:          ${totalMinor}`);

    const reportPath = path.resolve('docs/ui-review/axe-report.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({ summary: { totalCritical, totalSerious, totalModerate, totalMinor }, report }, null, 2));
    console.log(`Full report written to ${reportPath}`);

  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
