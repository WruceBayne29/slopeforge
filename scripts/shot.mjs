// Quick look at the app: node scripts/shot.mjs [out.png] [width] [height] [example]
import { chromium } from 'playwright';
import { serveDist } from './serve.mjs';

const [out = 'shot.png', w = '1500', h = '950', example = ''] = process.argv.slice(2);
const server = await serveDist();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(server.url, { waitUntil: 'networkidle' });
await page.waitForSelector('.app[data-busy="false"]', { timeout: 20000 });
if (example) {
  await page.selectOption('.actions select', example);
  await page.waitForTimeout(200);
  await page.waitForSelector('.app[data-busy="false"]', { timeout: 20000 });
}
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(200);
await page.screenshot({ path: out, fullPage: process.argv.includes('--full') });
console.log('errors:', errors);
console.log('fos:', await page.locator('[data-testid="fos-bishop"]').innerText().catch(() => 'n/a'));
await browser.close();
await server.close();
