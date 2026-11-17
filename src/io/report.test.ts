import { describe, expect, it } from 'vitest';
import { analyseCircle, searchCritical } from '../engine';
import type { CircleSuccess } from '../engine';
import { EXAMPLES } from '../model/examples';
import { buildReport, pdfText, reportFileName } from './report';

describe('PDF report', () => {
  for (const example of EXAMPLES) {
    it(`builds a report for ${example.id}`, () => {
      const search = searchCritical(example.project.model, { nx: 8, ny: 8 });
      const result = search.critical as CircleSuccess;
      const doc = buildReport({
        project: example.project,
        result,
        kind: 'critical',
        search,
        date: new Date('2026-01-02T00:00:00Z'),
      });
      const bytes = new Uint8Array(doc.output('arraybuffer'));
      expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
      expect(bytes.length).toBeGreaterThan(8000);
    });
  }

  it('embeds the drawing and reports a trial circle', () => {
    const project = EXAMPLES[0].project;
    const result = analyseCircle(project.model, { xc: 20, yc: 42, r: 23 }) as CircleSuccess;
    expect(result.ok).toBe(true);
    const dataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const plain = buildReport({ project, result, kind: 'trial' });
    const withFigure = buildReport({
      project,
      result,
      kind: 'trial',
      figure: { dataUrl, width: 900, height: 600 },
    });
    const ordinary = buildReport({
      project: { ...project, settings: { ...project.settings, method: 'fellenius' } },
      result,
      kind: 'critical',
    });
    expect(ordinary.getNumberOfPages()).toBeGreaterThanOrEqual(2);
    expect(withFigure.output()).toContain('/Subtype /Image');
    expect(plain.output()).not.toContain('/Subtype /Image');
    const tall = buildReport({
      project,
      result,
      kind: 'trial',
      figure: { dataUrl, width: 100, height: 4000 },
    });
    expect(tall.getNumberOfPages()).toBeGreaterThanOrEqual(2);
  });

  it('reports a circle Bishop could not solve and an unstable one', () => {
    const project = EXAMPLES.find((e) => e.id === 'acads-1a')?.project ?? EXAMPLES[0].project;
    const search = searchCritical(project.model, { nx: 8, ny: 8 });
    const result = search.critical as CircleSuccess;
    expect(result.bishop.fos as number).toBeLessThan(1);
    expect(
      buildReport({ project, result, kind: 'critical', search }).getNumberOfPages(),
    ).toBeGreaterThan(1);
    const broken: CircleSuccess = {
      ...result,
      bishop: { fos: null, resistingMoment: 0, iterations: [1], converged: false, note: 'no' },
    };
    expect(
      buildReport({ project, result: broken, kind: 'critical' }).getNumberOfPages(),
    ).toBeGreaterThan(1);
  });

  it('writes symbols the PDF fonts lack in plain letters', () => {
    expect(pdfText('c′ = 5 kPa, φ′ = 30°, γ = 18 kN/m³')).toBe(
      "c' = 5 kPa, phi' = 30°, gamma = 18 kN/m³",
    );
    expect(pdfText('Σ T ≤ −3 … α → mα')).toBe('Sum T <= -3 ... alpha -> malpha');
    expect(pdfText('漢')).toBe('?');
  });

  it('names the file after the section', () => {
    expect(reportFileName('Hillside with a water table')).toBe(
      'hillside-with-a-water-table-stability.pdf',
    );
    expect(reportFileName('  ')).toBe('slope-stability.pdf');
  });
});
