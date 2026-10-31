import { Browser, sleep } from '../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import fs from 'fs';
import path from 'path';

async function main() {
  const outDir = path.resolve('docs/ui-review/after');
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Authenticate HR
  let token = '';
  try {
    const signinRes = await fetch('http://localhost:4000/api/v1/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'hr-preview-agent@shortlistiq.com',
        password: 'Password123!'
      })
    });
    const signinData = await signinRes.json();
    token = signinData.data?.token;

    if (!token) {
      const signupRes = await fetch('http://localhost:4000/api/v1/auth/signup-hr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'hr-preview-agent@shortlistiq.com',
          password: 'Password123!',
          fullName: 'Sarah Jenkins',
          organizationName: 'Apex Innovations Inc.'
        })
      });
      const signupData = await signupRes.json();
      token = signupData.data?.token;
    }
  } catch (err) {
    console.error('HR auth error:', err);
  }

  if (!token) {
    console.error('Failed to obtain HR auth token.');
    return;
  }
  console.log('Obtained HR auth token.');

  // 2. Connect mock email account
  await fetch('http://localhost:4000/api/v1/email/mock-connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ provider: 'gmail', address: 'recruiting@apex-innovations.com' })
  }).catch(() => {});

  // 3. Create or find batch
  let batchId = '';
  const batchesRes = await fetch('http://localhost:4000/api/v1/batches', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const batchesData = await batchesRes.json();
  if (batchesData.data?.length > 0) {
    batchId = batchesData.data[0].id;
  } else {
    const createRes = await fetch('http://localhost:4000/api/v1/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: 'Senior Full Stack Engineer (Q4)',
        jobTitle: 'Senior Full Stack Engineer',
        jdText: 'Looking for a Senior Full Stack Engineer with 5+ years of experience architecting React, TypeScript, Node.js, and PostgreSQL distributed cloud services.',
        cutoff: 75
      })
    });
    const createData = await createRes.json();
    batchId = createData.data?.id;

    // Set criteria
    await fetch(`http://localhost:4000/api/v1/batches/${batchId}/criteria`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        cutoff: 75,
        alwaysRequireAllMustHaves: true,
        criteria: [
          { id: 'crit-react', label: 'React & TypeScript component architecture', type: 'must-have', weight: 9, keywords: ['react', 'typescript'] },
          { id: 'crit-node', label: 'Node.js & PostgreSQL backend systems', type: 'must-have', weight: 8, keywords: ['node', 'postgresql'] },
          { id: 'crit-cloud', label: 'AWS or Docker containerization', type: 'nice-to-have', weight: 6, keywords: ['aws', 'docker'] }
        ]
      })
    });
  }

  console.log('Using Batch ID:', batchId);

  // 4. Create public application form if none exists
  const formsRes = await fetch(`http://localhost:4000/api/v1/forms/batch/${batchId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const formsData = await formsRes.json();
  let formSlug = 'senior-fullstack-dev';

  if (!formsData.data || formsData.data.length === 0) {
    await fetch('http://localhost:4000/api/v1/forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        batchId,
        title: 'Senior Full Stack Engineer Application',
        slug: formSlug,
        schema: {
          fields: [
            { id: 'field_name', label: 'Full Legal Name', type: 'text', required: true, isLocked: true },
            { id: 'field_email', label: 'Email Address', type: 'text', required: true, isLocked: true },
            { id: 'field_phone', label: 'Contact Phone Number', type: 'text', required: true, isLocked: true },
            { id: 'field_resume', label: 'Resume (PDF Document)', type: 'text', required: true, isLocked: true },
            { id: 'field_exp', label: 'Years of professional experience with React & TypeScript', type: 'number', required: true, placeholder: '5' },
            { id: 'field_auth', label: 'Are you authorized to work in the United States?', type: 'boolean', required: true },
            { id: 'field_notice', label: 'Availability / Notice Period', type: 'select', required: true, options: ['Immediately', '2 Weeks', '1 Month', 'More than 1 month'] }
          ],
          consentText: 'I consent to the collection and processing of my application data under the ShortlistIQ privacy policy.'
        },
        knockoutRules: [
          { id: 'ko_1', fieldId: 'field_auth', operator: 'equals', value: false, reason: 'Work authorization required for this role.' }
        ]
      })
    });
  } else {
    formSlug = formsData.data[0].slug;
  }

  console.log('Using Application Form slug:', formSlug);

  // 5. Browser capture
  console.log('Launching browser to capture Step 6 screens...');
  const browser = await Browser.launch();

  try {
    // 5A. Batch Results Desktop 1440
    console.log('Capturing batch-results (desktop 1440)...');
    const batchPage = await browser.newPage({ width: 1440, height: 900 });
    await batchPage.goto('http://localhost:5173/auth/signin', { settleMs: 500 });
    await batchPage.eval((t) => localStorage.setItem('shortlistiq_auth_token', t), token);
    await batchPage.goto(`http://localhost:5173/hr/batches/${batchId}`, { settleMs: 2500 });
    await batchPage.screenshot({ path: path.join(outDir, 'batch-results-desktop-1440.png'), format: 'png' });

    // 5B. Batch Results Tablet 768
    console.log('Capturing batch-results (tablet 768)...');
    const batchTablet = await browser.newPage({ width: 768, height: 1024 });
    await batchTablet.goto('http://localhost:5173/auth/signin', { settleMs: 500 });
    await batchTablet.eval((t) => localStorage.setItem('shortlistiq_auth_token', t), token);
    await batchTablet.goto(`http://localhost:5173/hr/batches/${batchId}`, { settleMs: 2500 });
    await batchTablet.screenshot({ path: path.join(outDir, 'batch-results-tablet-768.png'), format: 'png' });
    await batchTablet.send('Target.closeTarget', { targetId: batchTablet.targetId }).catch(() => {});

    // 5C. Finalize Batch Modal
    console.log('Capturing finalize-email modal...');
    await batchPage.eval(() => {
      const finalizeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Finalize Batch'));
      if (finalizeBtn) finalizeBtn.click();
    });
    await sleep(800);
    await batchPage.screenshot({ path: path.join(outDir, 'finalize-email-desktop-1440.png'), format: 'png' });

    // Close finalize modal
    await batchPage.eval(() => {
      const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Cancel'));
      if (cancelBtn) cancelBtn.click();
    });
    await sleep(500);

    // 5D. Form Builder Modal
    console.log('Capturing form-builder modal...');
    await batchPage.eval(() => {
      const formsBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Application Forms'));
      if (formsBtn) formsBtn.click();
    });
    await sleep(1000);
    await batchPage.screenshot({ path: path.join(outDir, 'form-builder-desktop-1440.png'), format: 'png' });

    // Close modal
    await batchPage.send('Target.closeTarget', { targetId: batchPage.targetId }).catch(() => {});

    // 5E. Public Application Form (Desktop 1440 & Mobile 375)
    console.log('Capturing public-apply (desktop 1440)...');
    const applyPage = await browser.newPage({ width: 1440, height: 900 });
    await applyPage.goto(`http://localhost:5173/apply/${formSlug}`, { settleMs: 2000 });
    await applyPage.screenshot({ path: path.join(outDir, 'public-apply-desktop-1440.png'), format: 'png' });
    await applyPage.send('Target.closeTarget', { targetId: applyPage.targetId }).catch(() => {});

    console.log('Capturing public-apply (mobile 375)...');
    const applyMobile = await browser.newPage({ width: 375, height: 812, mobile: true });
    await applyMobile.goto(`http://localhost:5173/apply/${formSlug}`, { settleMs: 2000 });
    await applyMobile.screenshot({ path: path.join(outDir, 'public-apply-mobile-375.png'), format: 'png' });
    await applyMobile.send('Target.closeTarget', { targetId: applyMobile.targetId }).catch(() => {});

    console.log('Step 6 screenshots captured successfully!');
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
