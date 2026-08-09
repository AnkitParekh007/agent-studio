const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const mode = process.env.CAPTURE_MODE || 'handbook';
const baseUrl = process.env.CAPTURE_BASE_URL || (mode === 'local' ? 'http://localhost:3000/' : 'https://ankitparekh007.github.io/agent-studio/');
const outputDir = process.env.CAPTURE_OUTPUT_DIR || path.join(process.cwd(), 'public-proof-captures');
const storageState = process.env.CAPTURE_STORAGE_STATE;
fs.mkdirSync(outputDir, { recursive: true });

const manifest = [];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
    reducedMotion: 'reduce',
    ...(storageState ? { storageState } : {}),
  });
  const page = await context.newPage();

  async function capture(name, target) {
    const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1200);
    const file = path.join(outputDir, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    manifest.push({ name, file: path.basename(file), requestedUrl: target, finalUrl: page.url(), status: response ? response.status() : null });
  }

  if (mode === 'handbook') {
    await capture('agent-studio-handbook-home', baseUrl);
  } else {
    const routes = [
      ['control-plane-home', '/'],
      ['control-plane-agents', '/agents'],
      ['control-plane-reviews', '/reviews'],
      ['control-plane-applications', '/applications'],
    ];
    for (const [name, route] of routes) {
      await capture(name, new URL(route.replace(/^\//, ''), baseUrl).toString());
    }
  }

  fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify({ mode, baseUrl, captures: manifest }, null, 2)}\n`);
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
