import { Browser, sleep } from '../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import fs from 'fs';
import path from 'path';

async function main() {
  const outDir = path.resolve('docs/ui-review/after');
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Get or create HR token
  let token = '';
  try {
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
    const data = await signupRes.json();
    if (data.success && data.data?.token) {
      token = data.data.token;
    } else {
      // try sign in
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
    }
  } catch (err) {
    console.error('Auth error:', err);
  }

  if (!token) {
    console.error('Failed to obtain HR auth token.');
    return;
  }

  console.log('Obtained HR auth token. Launching browser...');
  const browser = await Browser.launch();

  try {
    const hrRoutes = [
      { name: 'hr-dashboard', path: '/hr/dashboard' },
      { name: 'hr-create-batch', path: '/hr/batches/new' },
      { name: 'hr-settings', path: '/hr/settings' }
    ];

    for (const route of hrRoutes) {
      console.log(`Capturing ${route.name}...`);

      // Desktop 1440
      const desktopPage = await browser.newPage({ width: 1440, height: 900 });
      await desktopPage.goto('http://localhost:5173/auth/signin', { settleMs: 500 });
      await desktopPage.eval((t) => {
        localStorage.setItem('shortlistiq_auth_token', t);
      }, token);
      await desktopPage.goto(`http://localhost:5173${route.path}`, { settleMs: 2500 });
      await desktopPage.screenshot({ path: path.join(outDir, `${route.name}-desktop-1440.png`), format: 'png' });
      await desktopPage.send('Target.closeTarget', { targetId: desktopPage.targetId }).catch(() => {});

      // Tablet 768
      const tabletPage = await browser.newPage({ width: 768, height: 1024 });
      await tabletPage.goto('http://localhost:5173/auth/signin', { settleMs: 500 });
      await tabletPage.eval((t) => {
        localStorage.setItem('shortlistiq_auth_token', t);
      }, token);
      await tabletPage.goto(`http://localhost:5173${route.path}`, { settleMs: 2500 });
      await tabletPage.screenshot({ path: path.join(outDir, `${route.name}-tablet-768.png`), format: 'png' });
      await tabletPage.send('Target.closeTarget', { targetId: tabletPage.targetId }).catch(() => {});
    }

    console.log('HR side part 1 screens captured successfully!');
  } finally {
    await browser.close();
  }
}

main().catch(console.error);

