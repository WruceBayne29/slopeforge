// Quick look at the app while developing.
// Usage: node scripts/shot.mjs out.png [width] [height] [example] [tab label] [--full]
// With a tab label, the screenshot is of the details panel with that tab open.
import { chromium } from 'playwright';
import { serveDist } from './serve.mjs';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const [out = 'shot.png', w = '1500', h = '950', example = '', tab = ''] = args;
const server = await serveDist();
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: Number(w), height: Number(h) },
  deviceScaleFactor: 1,
});
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
const settled = () =>
  page.waitForSelector('.app[data-busy="false"]', { timeout: 30000 }).catch((e) => {
    console.log('errors:', errors);
    throw e;
  });
await page.goto(server.url, { waitUntil: 'networkidle' });
await settled();
if (example) {
  await page.selectOption('.actions select', example);
  await page.waitForTimeout(200);
  await settled();
}
await page.evaluate(() => document.fonts.ready);
if (tab) {
  await page.locator('.tabs button', { hasText: tab }).click();
  await page.waitForTimeout(300);
  await settled();
  await page.waitForTimeout(200);
  await page.locator('.details').screenshot({ path: out });
} else {
  await page.waitForTimeout(200);
  await page.screenshot({ path: out, fullPage: process.argv.includes('--full') });
}
console.log('errors:', errors);
await browser.close();
await server.close();
