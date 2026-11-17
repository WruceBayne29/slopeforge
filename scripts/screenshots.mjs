// Generates the README screenshots and the hero GIF with Playwright.
// Usage: node scripts/screenshots.mjs [url]   (default: serves the production build in dist/)
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import gifenc from 'gifenc';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { serveDist } from './serve.mjs';

const { GIFEncoder, quantize, applyPalette } = gifenc;
const server = process.argv[2] ? null : await serveDist();
const url = process.argv[2] ?? server.url;
const out = 'docs/screenshots';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();

const settle = async (page) => {
  await page.waitForTimeout(150);
  await page.waitForSelector('.app[data-busy="false"]', { timeout: 30000 });
  await page.waitForTimeout(120);
};

async function open(viewport = { width: 1440, height: 900 }, scale = 2) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: scale,
    acceptDownloads: true,
  });
  await context.addInitScript(() => window.localStorage.setItem('slopeforge-tour-seen', '1'));
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await settle(page);
  await page.evaluate(() => document.fonts.ready);
  return page;
}
const example = async (page, id) => {
  await page.selectOption('.actions select', id);
  await settle(page);
};
const tab = async (page, label) => {
  await page.locator('.tabs button', { hasText: label }).click();
  await settle(page);
  await page.waitForTimeout(400);
  await settle(page);
};
const shot = async (page, name, options = {}) => {
  await page.mouse.move(5, 5);
  await page.waitForTimeout(120);
  await page.screenshot({ path: join(out, name), ...options });
  console.log(`wrote ${out}/${name}`);
};

// Whole-page views of four sections.
for (const [id, name] of [
  ['hillside', 'hillside.png'],
  ['acads-1c', 'acads-1c.png'],
  ['soft-clay', 'soft-clay.png'],
  ['drawdown', 'drawdown.png'],
]) {
  const page = await open();
  await example(page, id);
  await shot(page, name);
  await page.context().close();
}

// The detail tabs.
{
  const page = await open({ width: 1440, height: 1500 });
  await example(page, 'hillside');
  for (const [label, name] of [
    ['Working', 'working.png'],
    ['Slice forces', 'forces.png'],
    ['Fellenius vs Bishop', 'compare.png'],
    ['Sensitivity', 'sensitivity.png'],
  ]) {
    await tab(page, label);
    if (label === 'Fellenius vs Bishop') {
      await page.waitForFunction(
        () => !document.querySelector('.compare table.calc')?.textContent?.includes('…'),
      );
    }
    if (label === 'Sensitivity') await page.waitForSelector('.sensitivity svg.chart');
    const details = page.locator('.details');
    await details.scrollIntoViewIfNeeded();
    const box = await details.boundingBox();
    await page.screenshot({
      path: join(out, name),
      clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 760) },
    });
    console.log(`wrote ${out}/${name}`);
  }
  await page.context().close();
}

// The drawing alone, with a trial circle.
{
  const page = await open();
  await example(page, 'acads-1c');
  await page.locator('button', { hasText: 'Place a trial circle' }).click();
  await settle(page);
  await page.locator('.drawing').screenshot({ path: join(out, 'trial-circle.png') });
  console.log(`wrote ${out}/trial-circle.png`);
  await page.context().close();
}

// Phone layout.
{
  const page = await open({ width: 390, height: 844 }, 3);
  await example(page, 'cutting');
  await shot(page, 'mobile.png');
  await page.context().close();
}

// First page of the PDF report (rendered with macOS `sips` where available).
{
  const page = await open();
  await example(page, 'hillside');
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.locator('button', { hasText: 'PDF report' }).click(),
  ]);
  const pdf = join(mkdtempSync(join(tmpdir(), 'slopeforge-pdf-')), 'report.pdf');
  await download.saveAs(pdf);
  try {
    execFileSync(
      'sips',
      ['-s', 'format', 'png', '--resampleHeight', '1700', pdf, '--out', join(out, 'pdf.png')],
      {
        stdio: 'ignore',
      },
    );
    console.log(`wrote ${out}/pdf.png`);
  } catch {
    console.log('skipped pdf.png (sips not available)');
  }
  await page.context().close();
}

// Hero GIF: raise the water table and watch the critical circle and F respond, then tour the examples.
{
  const page = await open({ width: 1180, height: 700 }, 1);
  await example(page, 'hillside');
  const frames = [];
  const grab = async (hold = 1) =>
    frames.push({ png: PNG.sync.read(await page.screenshot()), delay: 110 * hold });
  await grab(9);
  const drag = async (selector, index, dx, dy, steps) => {
    const box = await page.locator(selector).nth(index).boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(x + (dx * i) / steps, y + (dy * i) / steps, { steps: 2 });
      await settle(page);
      await grab(3);
    }
    await page.mouse.up();
    await settle(page);
    await grab(7);
  };
  await drag('svg.section .handle-water', 2, 0, -34, 5);
  await drag('svg.section .handle-water', 3, 0, -22, 4);
  await drag('svg.section .handle-ground', 2, -46, 0, 5);
  for (const id of ['soft-clay', 'drawdown', 'acads-1c']) {
    await example(page, id);
    await grab(12);
  }
  const { width, height } = frames[0].png;
  const gif = GIFEncoder();
  for (const { png, delay } of frames) {
    const palette = quantize(png.data, 96);
    gif.writeFrame(applyPalette(png.data, palette), width, height, { palette, delay });
  }
  gif.finish();
  writeFileSync(join(out, 'hero.gif'), gif.bytes());
  console.log(
    `wrote ${out}/hero.gif (${frames.length} frames, ${(gif.bytes().length / 1e6).toFixed(1)} MB)`,
  );
  await page.context().close();
}

await browser.close();
if (server) await server.close();
