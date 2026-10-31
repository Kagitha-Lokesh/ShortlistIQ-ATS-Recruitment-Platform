import { Browser, sleep } from '../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import fs from 'fs';
import path from 'path';

const candidateRoutes = [
  { name: 'landing', path: '/' },
  { name: 'signin', path: '/auth/signin' },
  { name: 'signup-hr', path: '/auth/signup-hr' },
  { name: 'checker', path: '/checker' },
  { name: 'results', path: '/checks/59c975d4-0f55-41d0-bb1f-e75950cea70f' },
  { name: 'suggestions', path: '/checks/59c975d4-0f55-41d0-bb1f-e75950cea70f/suggestions' },
  { name: 'export', path: '/checks/59c975d4-0f55-41d0-bb1f-e75950cea70f/export' },
  { name: 'deletion', path: '/privacy/delete-data' },
];

async function captureCandidateSide() {
  const outDir = path.resolve('docs/ui-review/after');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await Browser.launch();
  try {
    for (const route of candidateRoutes) {
      console.log(`Capturing ${route.name}...`);
      // Desktop 1440
      const pageDesktop = await browser.newPage({ width: 1440, height: 900 });
      await pageDesktop.goto(`http://localhost:5173${route.path}`, { settleMs: 1500 });
      await pageDesktop.screenshot({ path: path.join(outDir, `${route.name}-desktop-1440.png`), format: 'png' });
      await pageDesktop.send('Target.closeTarget', { targetId: pageDesktop.targetId }).catch(() => {});

      // Mobile 375
      const pageMobile = await browser.newPage({ width: 375, height: 812, mobile: true });
      await pageMobile.goto(`http://localhost:5173${route.path}`, { settleMs: 1500 });
      await pageMobile.screenshot({ path: path.join(outDir, `${route.name}-mobile-375.png`), format: 'png' });
      await pageMobile.send('Target.closeTarget', { targetId: pageMobile.targetId }).catch(() => {});
    }
    console.log('All candidate routes captured successfully!');
  } finally {
    await browser.close();
  }
}

captureCandidateSide().catch(console.error);

