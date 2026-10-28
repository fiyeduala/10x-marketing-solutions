/**
 * Prints the handbook page to public/handbook/10x-customer-support-handbook.pdf.
 *
 * 1. npm run build && npx vite preview --port 4173   (the API is not needed)
 * 2. node scripts/handbook-pdf.mjs [baseUrl]
 *
 * Uses playwright-core with an installed Chromium. Set CHROMIUM_PATH if it is
 * not in the default Playwright cache location.
 */
import { chromium } from 'playwright-core';
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';

const base = process.argv[2] ?? 'http://localhost:4173';
const out = 'public/handbook/10x-customer-support-handbook.pdf';
const executablePath =
  process.env.CHROMIUM_PATH ??
  (process.platform === 'win32'
    ? join(process.env.LOCALAPPDATA ?? '', 'ms-playwright/chromium-1140/chrome-win/chrome.exe')
    : join(os.homedir(), '.cache/ms-playwright/chromium-1140/chrome-linux/chrome'));

const browser = await chromium.launch({ executablePath });
try {
  const page = await browser.newPage();
  // The config request is irrelevant to the printed content; answer it locally.
  await page.route('**/api/v1/**', (r) => r.fulfill({ status: 503, body: '{}' }));
  await page.goto(`${base}/customer-support-assessment/handbook`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#chapter-12');
  // Revision answers are collapsed on screen; the printed copy shows them.
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: 'print' });
  mkdirSync('public/handbook', { recursive: true });
  await page.pdf({
    path: out,
    format: 'A4',
    printBackground: true,
    margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate:
      '<div style="width:100%;font-size:8px;color:#666;padding:0 16mm;display:flex;justify-content:space-between;font-family:sans-serif">' +
      '<span>10X Customer Support Professional Handbook</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
  });
  console.log(`Wrote ${out} (${Math.round(statSync(out).size / 1024)} KB)`);
} finally {
  await browser.close();
}
