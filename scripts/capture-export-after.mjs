import { Browser, sleep } from '../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import fs from 'fs';
import path from 'path';

async function run() {
  const outDir = path.resolve('docs/ui-review/after');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await Browser.launch();
  try {
    const page = await browser.newPage({ width: 1440, height: 900 });
    await page.goto('http://localhost:5173/checks/59c975d4-0f55-41d0-bb1f-e75950cea70f/export', { settleMs: 3000 });
    await page.screenshot({ path: path.join(outDir, 'export-desktop-1440.png'), format: 'png' });
    console.log('Saved export-desktop-1440.png');

    // Mobile view 375
    const mobilePage = await browser.newPage({ width: 375, height: 812, mobile: true });
    await mobilePage.goto('http://localhost:5173/checks/59c975d4-0f55-41d0-bb1f-e75950cea70f/export', { settleMs: 3000 });
    await mobilePage.screenshot({ path: path.join(outDir, 'export-mobile-375.png'), format: 'png' });
    console.log('Saved export-mobile-375.png');
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
