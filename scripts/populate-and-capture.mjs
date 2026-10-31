import { Browser, sleep } from '../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import fs from 'fs';
import path from 'path';

async function main() {
  const outDir = path.resolve('docs/ui-review/after');
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Authenticate HR
  const signinRes = await fetch('http://localhost:4000/api/v1/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'hr-preview-agent@shortlistiq.com', password: 'Password123!' })
  });
  const signinData = await signinRes.json();
  const token = signinData.data?.token;

  const batchesRes = await fetch('http://localhost:4000/api/v1/batches', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const batches = (await batchesRes.json()).data || [];
  const batchId = batches[0]?.id;
  console.log('Batch ID:', batchId);

  // Check candidates in batch
  const candsRes = await fetch(`http://localhost:4000/api/v1/batches/${batchId}/candidates`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const candsData = await candsRes.json();
  const candidateCount = candsData.data?.candidates?.length || 0;
  console.log('Existing candidates count:', candidateCount);

  if (candidateCount === 0) {
    console.log('Uploading candidate resume...');
    const pdfBuffer = fs.readFileSync('Lokesh_Resume.pdf');
    const formData = new FormData();
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    formData.append('files', blob, 'Lokesh_Resume.pdf');

    const uploadRes = await fetch(`http://localhost:4000/api/v1/batches/${batchId}/candidates/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    console.log('Upload status:', uploadRes.status);
    // Wait 3 seconds for background worker to score candidate
    await sleep(3500);
  }

  const browser = await Browser.launch();
  try {
    const page = await browser.newPage({ width: 1440, height: 900 });
    await page.goto('http://localhost:5173/auth/signin', { settleMs: 500 });
    await page.eval((t) => localStorage.setItem('shortlistiq_auth_token', t), token);

    // 1. Batch results page
    console.log('Navigating to batch detail...');
    await page.goto(`http://localhost:5173/hr/batches/${batchId}`, { settleMs: 3000 });
    await page.screenshot({ path: path.join(outDir, 'batch-results-desktop-1440.png'), format: 'png' });

    // 2. Open Finalize modal
    console.log('Opening finalize modal...');
    await page.eval(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Finalize & Send Emails'));
      if (btn) btn.click();
    });
    await sleep(1000);
    await page.screenshot({ path: path.join(outDir, 'finalize-email-desktop-1440.png'), format: 'png' });

    // Close finalize modal
    await page.eval(() => {
      const cancel = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancel');
      if (cancel) cancel.click();
    });
    await sleep(600);

    // 3. Open Forms modal
    console.log('Opening forms modal...');
    await page.eval(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Forms');
      if (btn) btn.click();
    });
    await sleep(1000);
    await page.screenshot({ path: path.join(outDir, 'form-builder-desktop-1440.png'), format: 'png' });

    // Close forms modal
    await page.eval(() => {
      const closeBtn = document.querySelector('.fixed button');
      if (closeBtn) closeBtn.click();
    });
    await sleep(600);

    // 4. Candidate Drawer
    console.log('Checking candidate drawer...');
    const hasRow = await page.eval(() => {
      const row = document.querySelector('tbody tr');
      if (row) {
        row.click();
        return true;
      }
      return false;
    });

    if (hasRow) {
      await sleep(1500);
      await page.screenshot({ path: path.join(outDir, 'candidate-drawer-desktop-1440.png'), format: 'png' });
    }

    console.log('Completed capturing popups and batch results.');
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
