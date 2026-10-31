import { Browser, sleep } from '../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import fs from 'fs';
import path from 'path';

async function test() {
  const outDir = path.resolve('docs/ui-review/before');
  fs.mkdirSync(outDir, { recursive: true });

  console.log('Launching browser...');
  const browser = await Browser.launch({ width: 1440, height: 900 });
  console.log('Browser launched.');

  try {
    await browser.send('Page.navigate', { url: 'http://localhost:5173/' });
    await sleep(2000);
    const { data } = await browser.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, 'test-1440.png'), Buffer.from(data, 'base64'));
    console.log('Saved test-1440.png');
  } finally {
    browser.close();
  }
}

test().catch(console.error);

