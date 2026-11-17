// End-to-end check: opens the app in headless Chromium and uses every feature.
// Usage: node scripts/e2e.mjs [url | local]
//   (default: the live GitHub Pages site; "local" serves the production build in dist/)
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { serveDist } from './serve.mjs';

const arg =
  process.argv[2] ?? process.env.SLOPEFORGE_URL ?? 'https://wrucebayne29.github.io/slopeforge/';
const server = arg === 'local' ? await serveDist() : null;
const url = server ? server.url : arg;
const tmp = mkdtempSync(join(tmpdir(), 'slopeforge-e2e-'));
const results = [];
const errors = [];

function check(name, condition, detail = '') {
  results.push({ name, ok: !!condition });
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? `  (${detail})` : ''}`);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1500, height: 950 },
  acceptDownloads: true,
  permissions: ['clipboard-read', 'clipboard-write'],
});
const page = await context.newPage();
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

const settle = async (p = page) => {
  await p.waitForTimeout(120);
  await p.waitForSelector('.app[data-busy="false"]', { timeout: 30000 });
  await p.waitForTimeout(60);
};
const fos = async (which = 'bishop', p = page) =>
  Number((await p.locator(`[data-testid="fos-${which}"]`).textContent()).replace('−', '-'));
const field = (label) => page.locator(`input[aria-label="${label}"]`);
const setField = async (label, value) => {
  const input = field(label);
  await input.fill(String(value));
  await input.press('Enter');
  await settle();
};
const example = async (id) => {
  await page.selectOption('.actions select', id);
  await settle();
};
const tab = async (label) => {
  await page.locator('.tabs button', { hasText: label }).click();
  await settle();
};
const button = (label) => page.locator('button', { hasText: label }).first();
const centre = async (locator) => {
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
const toast = () => page.locator('.toast').last().textContent();

try {
  // ---- 1. First visit: the tour ----
  await page.goto(url, { waitUntil: 'networkidle' });
  check('page loads with the right title', (await page.title()).includes('SlopeForge'));
  await page.waitForSelector('.tour-card');
  check(
    'first visit starts the tour',
    (await page.locator('.tour-card h2').textContent()) === 'The section',
  );
  let steps = 1;
  while ((await page.locator('.tour-card button.solid').textContent()) === 'Next') {
    await page.locator('.tour-card button.solid').click();
    steps++;
  }
  check('the tour has five stops', steps === 5, `${steps}`);
  await page.locator('.tour-card button.solid').click();
  check('the tour closes', (await page.locator('.tour-card').count()) === 0);
  await page.reload({ waitUntil: 'networkidle' });
  await settle();
  check(
    'the tour does not come back on the next visit',
    (await page.locator('.tour-card').count()) === 0,
  );

  // ---- 2. The default section ----
  const f0 = await fos();
  check('default example gives a factor of safety', f0 > 1.2 && f0 < 1.45, `F = ${f0}`);
  check('ordinary method is lower than Bishop', (await fos('fellenius')) < f0);
  check(
    'three strata are drawn with hatches',
    (await page.locator('svg.section polygon.stratum').count()) === 3,
  );
  check(
    'strata use hatch patterns',
    (
      (await page.locator('svg.section polygon.stratum').first().getAttribute('fill')) ?? ''
    ).startsWith('url(#'),
  );
  check(
    'the water table is drawn',
    (await page.locator('svg.section .water-table polyline').count()) === 1,
  );
  check(
    'the critical circle is drawn',
    (await page.locator('svg.section .critical polyline').count()) === 1,
  );
  const sliceCount = await page.locator('svg.section polygon.slice').count();
  check('slices are drawn', sliceCount >= 30, `${sliceCount}`);
  check(
    'FoS contours are drawn over the centre grid',
    (await page.locator('svg.section .contour').count()) >= 3,
  );
  check(
    'the drawing carries a title block and a scale bar',
    (await page.locator('svg.section .title-block').textContent()).includes(
      'GEOTECHNICAL SECTION',
    ) && (await page.locator('svg.section .scale-bar rect').count()) === 4,
  );
  check(
    'the borehole log lists the strata',
    (await page.locator('.borehole tbody tr').count()) === 3 &&
      (await page.locator('.borehole td.legend svg').count()) === 3,
  );
  check(
    'the search record is shown',
    (await page.locator('.results').textContent()).includes('Circles analysed'),
  );

  // ---- 3. Benchmarks ----
  for (const [id, lo, hi] of [
    ['acads-1a', 0.97, 1.0],
    ['acads-1c', 1.39, 1.42],
    ['acads-1d', 1.0, 1.03],
  ]) {
    await example(id);
    const f = await fos();
    check(`${id} reproduces the published factor of safety`, f >= lo && f <= hi, `F = ${f}`);
  }
  check(
    'an unstable slope is called unstable',
    (await example('acads-1a'), await page.locator('.verdict').first().textContent()).includes(
      'Unstable',
    ),
  );
  for (const id of ['cutting', 'embankment', 'soft-clay', 'drawdown', 'cracked']) {
    await example(id);
    const f = await fos();
    check(`example "${id}" analyses`, f > 0.7 && f < 2.5, `F = ${f}`);
  }
  await example('hillside');

  // ---- 4. Editing soils, undo and redo ----
  const before = await fos();
  await setField('Stratum 2 cohesion', 30);
  const stronger = await fos();
  check('raising cohesion raises F', stronger > before, `${before} -> ${stronger}`);
  await button('Undo').click();
  await settle();
  check(
    'undo restores the value and the result',
    (await field('Stratum 2 cohesion').inputValue()) === '14' && (await fos()) === before,
  );
  await button('Redo').click();
  await settle();
  check('redo re-applies it', (await fos()) === stronger);
  await page.keyboard.press('Control+z');
  await settle();
  check('Ctrl+Z undoes', (await fos()) === before);
  await setField('Stratum 1 friction angle', 20);
  check('lowering friction lowers F', (await fos()) < before);
  await button('Undo').click();
  await settle();
  await button('+ Add stratum below').click();
  await settle();
  check(
    'a stratum can be added',
    (await page.locator('.borehole tbody tr').count()) === 4 &&
      (await page.locator('svg.section polygon.stratum').count()) === 4,
  );
  await page.locator('button[aria-label="Remove stratum 4"]').click();
  await settle();
  check('and removed again', (await page.locator('.borehole tbody tr').count()) === 3);
  await page.selectOption('select[aria-label="Stratum 1 hatch"]', 'gravel');
  check(
    'the hatch of a stratum can be changed',
    (
      (await page.locator('svg.section polygon.stratum').first().getAttribute('fill')) ?? ''
    ).endsWith('gravel)'),
  );
  await button('Undo').click();

  // ---- 5. Impossible input ----
  await setField('Firm base level', 40);
  check(
    'a base above the ground is explained',
    (await page.locator('.problems').textContent()).includes('firm base must lie below'),
  );
  await setField('Firm base level', 9);
  check('the result returns when the input is fixed', (await fos()) === before);
  await setField('Stratum 1 unit weight', 0);
  check(
    'a zero unit weight is explained',
    (await page.locator('.problems').textContent()).includes(
      'unit weight must be greater than zero',
    ),
  );
  await button('Undo').click();
  await settle();

  // ---- 6. Groundwater ----
  await page.locator('.choice label', { hasText: 'Dry' }).click();
  await settle();
  const dry = await fos();
  check('removing the water table raises F', dry > before, `${before} -> ${dry}`);
  check(
    'the water line disappears from the drawing',
    (await page.locator('svg.section .water-table').count()) === 0,
  );
  await page.locator('.choice label', { hasText: 'ru ratio' }).click();
  await settle();
  const ru = await fos();
  check('an ru of 0.25 lowers F', ru < dry, `${dry} -> ${ru}`);
  await setField('Pore pressure ratio', 0.5);
  check('a higher ru lowers it further', (await fos()) < ru);
  await page.locator('.choice label', { hasText: 'Water table' }).click();
  await settle();
  check(
    'a water table can be switched back on',
    (await page.locator('svg.section .handle-water').count()) >= 2,
  );
  await example('hillside');

  // ---- 7. Loads ----
  await button('+ Add surcharge').click();
  await settle();
  check('a surcharge is drawn', (await page.locator('svg.section .surcharge').count()) === 1);
  await setField('Surcharge 1 load', 80);
  await setField('Surcharge 1 start', 36);
  await setField('Surcharge 1 end', 44);
  const loaded = await fos();
  check('a heavy surcharge at the crest lowers F', loaded < before, `${before} -> ${loaded}`);
  await setField('Seismic coefficient', 0.15);
  const shaken = await fos();
  check('a seismic coefficient lowers F', shaken < loaded, `${loaded} -> ${shaken}`);
  await page.locator('label', { hasText: 'Tension crack' }).locator('input').check();
  await settle();
  await setField('Tension crack depth', 2);
  await setField('Tension crack water', 100);
  check(
    'a water-filled tension crack is reported in the working',
    (await tab('Working'), await page.locator('.working').textContent()).includes(
      'tension crack 2.00 m deep',
    ),
  );
  await tab('Slice table');
  await example('hillside');

  // ---- 8. Search settings ----
  await page.locator('.choice label', { hasText: 'Minimise Fellenius' }).click();
  await settle();
  const fellMin = await fos('fellenius');
  check(
    'minimising the ordinary method finds a lower ordinary F',
    fellMin < 1.159 + 1e-9 && fellMin > 0.9,
    `F = ${fellMin}`,
  );
  check(
    'the leading value switches to the ordinary method',
    (await page.locator('.fos.lead .method').textContent()).includes('FELLENIUS') ||
      (await page.locator('.fos.lead .method').textContent()).includes('Fellenius'),
  );
  await page.locator('.choice label', { hasText: 'Minimise Bishop' }).click();
  await settle();
  await setField('Number of slices', 12);
  check(
    'the number of slices can be changed',
    (await page.locator('svg.section polygon.slice').count()) < sliceCount,
  );
  await setField('Search grid size', 8);
  check(
    'the grid of trial centres can be changed',
    (await page.locator('.results').textContent()).includes('8 × 8'),
  );
  await example('hillside');

  // ---- 9. Dragging points on the drawing ----
  const handle = page.locator('svg.section .handle-ground').nth(2);
  const rl = () => field('Ground surface point 3 level').inputValue();
  const start = await centre(handle);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 10, start.y - 20, { steps: 4 });
  await page.mouse.move(start.x + 24, start.y - 42, { steps: 4 });
  await page.mouse.up();
  await settle();
  const moved = Number(await rl());
  check('dragging a ground point moves it', moved > 32, `RL 32 -> ${moved}`);
  check('dragged points snap to the grid', Math.abs(moved * 2 - Math.round(moved * 2)) < 1e-9);
  check('the result follows the new geometry', (await fos()) !== before);
  await button('Undo').click();
  await settle();
  check('a whole drag is one undo step', (await rl()) === '32' && (await fos()) === before);

  const water = page.locator('svg.section .handle-water').nth(2);
  const w0 = await centre(water);
  await page.mouse.move(w0.x, w0.y);
  await page.mouse.down();
  await page.mouse.move(w0.x, w0.y - 30, { steps: 5 });
  await page.mouse.up();
  await settle();
  check(
    'raising the water table by dragging lowers F',
    (await fos()) < before,
    `${before} -> ${await fos()}`,
  );
  await button('Undo').click();
  await settle();

  // ---- 10. Adding and deleting points ----
  const h1 = await centre(page.locator('svg.section .handle-ground').nth(1));
  const h2 = await centre(page.locator('svg.section .handle-ground').nth(2));
  await page.mouse.dblclick((h1.x + h2.x) / 2, (h1.y + h2.y) / 2);
  await settle();
  check(
    'double-clicking the ground line adds a point',
    (await page.locator('svg.section .handle-ground').count()) === 5,
  );
  check(
    'the new point is listed under survey points',
    (await page.locator('.points tbody tr').count()) === 5,
  );
  await page.keyboard.press('ArrowUp');
  await settle();
  check(
    'arrow keys nudge the selected point',
    Number(await field('Ground surface point 3 level').inputValue()) === 26.5,
    await field('Ground surface point 3 level').inputValue(),
  );
  await page.keyboard.press('Delete');
  await settle();
  check(
    'Delete removes the selected point',
    (await page.locator('svg.section .handle-ground').count()) === 4,
  );
  await page.locator('svg.section .handle-ground').nth(1).dblclick();
  await settle();
  check(
    'double-clicking a point removes it',
    (await page.locator('svg.section .handle-ground').count()) === 3,
  );
  await example('hillside');
  await setField('Ground surface point 3 level', 34);
  check('survey points can be typed in', (await fos()) !== before);
  await example('hillside');

  // ---- 11. Trial circle ----
  await button('Place a trial circle').click();
  await settle();
  check(
    'a trial circle appears with its handles',
    (await page.locator('svg.section .handle-trial-centre').count()) === 1,
  );
  const trialF = await fos();
  check(
    'no trial circle beats the critical one',
    trialF >= before - 1e-6,
    `trial ${trialF} vs critical ${before}`,
  );
  const tc = await centre(page.locator('svg.section .handle-trial-centre'));
  await page.mouse.move(tc.x, tc.y);
  await page.mouse.down();
  await page.mouse.move(tc.x + 40, tc.y - 10, { steps: 5 });
  await page.mouse.up();
  await settle();
  const movedTrial = (await page.locator('[data-testid="fos-bishop"]').count())
    ? await fos().catch(() => NaN)
    : NaN;
  check(
    'dragging the trial centre changes its factor of safety',
    movedTrial !== trialF,
    `${trialF} -> ${movedTrial}`,
  );
  check(
    'the panel says it is showing the trial circle',
    (await page.locator('.tag.state').textContent()).toLowerCase().includes('trial'),
  );
  await button('Remove trial circle').click();
  await settle();
  check('removing it returns to the critical circle', (await fos()) === before);

  // ---- 12. Detail tabs ----
  await tab('Slice table');
  const rows = await page.locator('.calc tbody tr').count();
  check(
    'the slice table has one row per slice',
    rows === (await page.locator('svg.section polygon.slice').count()),
    `${rows}`,
  );
  await page.locator('.calc tbody tr').nth(9).click();
  check(
    'picking a row highlights the slice on the drawing',
    (await page.locator('svg.section polygon.slice.picked').count()) === 1,
  );
  await tab('Working');
  check(
    'the working is set out in five steps',
    (await page.locator('.working .step').count()) === 5,
  );
  check(
    'it writes out the ordinary-method sum',
    (await page.locator('.working').textContent()).includes('F = Σ (c′l + N′ tan φ′) / Σ T'),
  );
  check(
    'it lists Bishop’s iterations',
    (await page.locator('.working table.calc').nth(1).locator('tbody tr').count()) >= 3,
  );
  check(
    'the working ends at the same factor as the panel',
    (await page.locator('.working').textContent()).includes(`F = ${before.toFixed(3)}`),
  );
  await tab('Slice forces');
  check(
    'the forces on the picked slice are drawn',
    (await page.locator('.fbd svg').textContent()).includes('SLICE 10 OF'),
  );
  await button('Next →').click();
  check(
    'the next slice can be stepped to',
    (await page.locator('.fbd svg').textContent()).includes('SLICE 11 OF'),
  );
  await tab('Fellenius vs Bishop');
  await page.waitForFunction(
    () => !document.querySelector('.compare table.calc')?.textContent?.includes('…'),
    null,
    { timeout: 30000 },
  );
  check(
    'the two methods are compared on charts',
    (await page.locator('.compare svg.chart').count()) === 3,
  );
  const cells = await page
    .locator('.compare table.calc tbody tr')
    .nth(1)
    .locator('td')
    .allTextContents();
  check(
    'the other method gets its own search',
    Number(cells[5]) < 1.159 + 1e-9 && Number(cells[5]) > 0.9,
    cells.join(' | '),
  );
  await tab('Sensitivity');
  await page.waitForSelector('.sensitivity svg.chart', { timeout: 30000 });
  check(
    'sensitivity curves for c′, φ′ and water level',
    (await page.locator('.sensitivity figure').count()) === 3,
  );
  check(
    'each curve has nine points',
    (await page.locator('.sensitivity figure').first().locator('svg rect[width="5"]').count()) ===
      9,
  );
  await tab('Slice table');

  // ---- 13. View toggles and keys ----
  await page.locator('label.tick', { hasText: 'Centre grid' }).locator('input').uncheck();
  check(
    'the centre grid can be hidden',
    (await page.locator('svg.section .contour').count()) === 0,
  );
  await page.locator('body').press('m');
  check('M brings it back', (await page.locator('svg.section .contour').count()) >= 3);
  await page.locator('body').press('l');
  check('L hides the slices', (await page.locator('svg.section polygon.slice').count()) === 0);
  await page.locator('body').press('l');
  await page.locator('body').press('?');
  check(
    '? opens the About note',
    (await page.locator('.note h2').textContent()) === 'ABOUT SLOPEFORGE' ||
      (await page.locator('.note h2').textContent()) === 'About SlopeForge',
  );
  await page.keyboard.press('Escape');
  check('Escape closes it', (await page.locator('.note').count()) === 0);

  // ---- 14. Save, open, share, PDF ----
  await page.locator('input[aria-label="Section title"]').fill('E2E hillside');
  await page.locator('input[aria-label="Section title"]').press('Enter');
  const [saved] = await Promise.all([page.waitForEvent('download'), button('Save').click()]);
  const savedPath = join(tmp, 'saved.json');
  await saved.saveAs(savedPath);
  const json = JSON.parse(readFileSync(savedPath, 'utf8'));
  check(
    'Save downloads the section as JSON',
    json.format === 'slopeforge-project' &&
      json.title === 'E2E hillside' &&
      json.model.soils.length === 3,
  );
  check(
    'the file is named after the section',
    saved.suggestedFilename() === 'e2e-hillside.slopeforge.json',
    saved.suggestedFilename(),
  );

  json.title = 'Reopened section';
  json.model.soils[1].c = 40;
  const editedPath = join(tmp, 'edited.json');
  writeFileSync(editedPath, JSON.stringify(json));
  await page.setInputFiles('input[type="file"]', editedPath);
  await settle();
  check(
    'Open reads a saved file',
    (await page.locator('input[aria-label="Section title"]').inputValue()) === 'Reopened section' &&
      (await field('Stratum 2 cohesion').inputValue()) === '40',
  );
  const badPath = join(tmp, 'bad.json');
  writeFileSync(
    badPath,
    '{"format":"slopeforge-project","model":{"ground":[{"x":0,"y":0}],"soils":[]}}',
  );
  await page.setInputFiles('input[type="file"]', badPath);
  await page.waitForSelector('.toast.error');
  check('a broken file is refused with a reason', (await toast()).includes('soils'), await toast());
  check(
    'and the open section is left alone',
    (await page.locator('input[aria-label="Section title"]').inputValue()) === 'Reopened section',
  );

  const sharedF = await fos();
  await button('Share link').click();
  await page.waitForFunction(() => window.location.hash.startsWith('#m='));
  const link = page.url();
  check(
    'Share puts the section in the link',
    link.includes('#m=1.') && link.length < 4000,
    `${link.length} characters`,
  );
  const second = await context.newPage();
  await second.goto(link, { waitUntil: 'networkidle' });
  await settle(second);
  check(
    'opening the link restores the section and its result',
    (await second.locator('input[aria-label="Section title"]').inputValue()) ===
      'Reopened section' && (await fos('bishop', second)) === sharedF,
  );
  check('a shared link skips the tour', (await second.locator('.tour-card').count()) === 0);
  await second.close();

  const [pdf] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    button('PDF report').click(),
  ]);
  const pdfPath = join(tmp, 'report.pdf');
  await pdf.saveAs(pdfPath);
  const bytes = readFileSync(pdfPath);
  check(
    'PDF report downloads',
    bytes.subarray(0, 5).toString() === '%PDF-' && bytes.length > 30000,
    `${Math.round(bytes.length / 1024)} kB`,
  );
  check(
    'the PDF is named after the section',
    pdf.suggestedFilename() === 'reopened-section-stability.pdf',
    pdf.suggestedFilename(),
  );

  // ---- 15. Phone layout ----
  const phone = await browser.newContext({
    viewport: { width: 390, height: 820 },
    deviceScaleFactor: 2,
  });
  const mobile = await phone.newPage();
  mobile.on('pageerror', (e) => errors.push(String(e)));
  await mobile.addInitScript(() => window.localStorage.setItem('slopeforge-tour-seen', '1'));
  await mobile.goto(url, { waitUntil: 'networkidle' });
  await settle(mobile);
  const overflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  check('the phone layout does not scroll sideways', overflow <= 1, `${overflow}px`);
  check(
    'the drawing and the result are shown on a phone',
    (await mobile.locator('svg.section').isVisible()) && (await fos('bishop', mobile)) > 1,
  );
  await phone.close();

  // ---- 16. Clean console ----
  check('no errors in the browser console', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {
  check(`script ran to the end`, false, String(e).split('\n')[0]);
  if (errors.length > 0) console.log('console errors:', errors.slice(0, 5));
}

await browser.close();
if (server) await server.close();
const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length} of ${results.length} checks passed against ${url}`,
);
if (failed.length > 0) {
  console.log('Failed:');
  for (const f of failed) console.log(`  - ${f.name}`);
  process.exit(1);
}
