import { describe, expect, it } from 'vitest';
import { analyseCircle } from './analyse';
import { homogeneous, mirrored, simpleSlope, soil } from './fixtures';
import { autoSearchBox, fosOf, searchCritical } from './search';
import { prepare } from './strata';

const slope = simpleSlope(10, 35, soil(19, 12, 24));

describe('autoSearchBox', () => {
  it('sits above the crest and spans the section', () => {
    const pm = prepare(slope);
    const box = autoSearchBox(pm);
    expect(box.x1).toBeGreaterThan(pm.xmin);
    expect(box.x2).toBeLessThan(pm.xmax);
    expect(box.y1).toBeCloseTo(11, 9);
    expect(box.y2).toBeGreaterThanOrEqual(10 + 25);
  });
});

describe('searchCritical', () => {
  const result = searchCritical(slope);

  it('returns a fully analysed critical circle', () => {
    expect(result.critical).not.toBeNull();
    expect(result.method).toBe('bishop');
    expect(result.critical?.slices.length).toBeGreaterThanOrEqual(30);
    expect(result.evaluated).toBeGreaterThan(1000);
    expect(result.message).toBeUndefined();
  });

  it('improves on the grid minimum and on arbitrary trial circles', () => {
    const f = result.critical?.bishop.fos as number;
    expect(f).toBeLessThanOrEqual((result.gridMinimum as number) + 1e-9);
    for (const c of [
      { xc: 0, yc: 20, r: 22 },
      { xc: 4, yc: 16, r: 16.5 },
      { xc: -2, yc: 30, r: 31 },
      { xc: 6, yc: 14, r: 15 },
    ]) {
      const trial = fosOf(analyseCircle(slope, c), 'bishop');
      expect(trial).not.toBeNull();
      expect(f).toBeLessThanOrEqual((trial as number) + 1e-6);
    }
  });

  it('maps the factor of safety over the grid of centres', () => {
    expect(result.xs).toHaveLength(16);
    expect(result.ys).toHaveLength(16);
    expect(result.fos).toHaveLength(16);
    const flat = result.fos.flat().filter((v): v is number => v !== null);
    expect(flat.length).toBeGreaterThan(100);
    expect(Math.min(...flat)).toBeCloseTo(result.gridMinimum as number, 12);
    const j = result.fos.findIndex((row) => row.includes(result.gridMinimum));
    const i = result.fos[j].indexOf(result.gridMinimum);
    expect(result.radius[j][i]).toBeGreaterThan(0);
  });

  it('gives the grid minimum itself when refinement is off', () => {
    const coarse = searchCritical(slope, { refine: false, nx: 8, ny: 8, nr: 8 });
    expect(coarse.xs).toHaveLength(8);
    expect(coarse.critical?.bishop.fos).toBeCloseTo(coarse.gridMinimum as number, 9);
    expect(coarse.gridMinimum as number).toBeGreaterThanOrEqual(
      (result.critical?.bishop.fos as number) - 1e-9,
    );
  });

  it('can minimise the ordinary-method factor instead', () => {
    const f = searchCritical(slope, { method: 'fellenius' });
    expect(f.method).toBe('fellenius');
    expect(f.critical?.fellenius.fos as number).toBeLessThan(result.critical?.bishop.fos as number);
    expect(f.critical?.fellenius.fos as number).toBeLessThanOrEqual(
      (result.critical?.fellenius.fos as number) + 1e-6,
    );
  });

  it('finds the same factor for the mirrored slope', () => {
    const m = searchCritical(mirrored(slope));
    expect(m.critical?.dir).toBe(-1);
    expect(
      Math.abs((m.critical?.bishop.fos as number) / (result.critical?.bishop.fos as number) - 1),
    ).toBeLessThan(2e-3);
  });

  it('honours a search box and clamps silly grid sizes', () => {
    const boxed = searchCritical(slope, {
      box: { x1: 10, x2: -5, y1: 30, y2: 14 },
      nx: 1,
      ny: 1,
      nr: 1,
      refine: false,
    });
    expect(boxed.xs).toEqual([-5, 10]);
    expect(boxed.ys).toEqual([14, 30]);
    expect(boxed.critical).not.toBeNull();
  });

  it('explains itself when no circle is valid', () => {
    const flat = homogeneous(
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
      ],
      -10,
      soil(18, 10, 30),
    );
    const none = searchCritical(flat);
    expect(none.critical).toBeNull();
    expect(none.gridMinimum).toBeNull();
    expect(none.message).toMatch(/No trial circle/);
  });

  it('skips centres that are below ground', () => {
    const low = searchCritical(slope, {
      box: { x1: 20, x2: 30, y1: 2, y2: 8 },
      nx: 3,
      ny: 3,
    });
    expect(low.fos.flat().every((v) => v === null)).toBe(true);
  });

  it('reads the factor of the chosen method, or null for a failed circle', () => {
    expect(fosOf(analyseCircle(slope, { xc: 0, yc: 80, r: 2 }), 'bishop')).toBeNull();
    const a = analyseCircle(slope, { xc: 0, yc: 20, r: 22 });
    expect(fosOf(a, 'fellenius')).toBe(a.ok ? a.fellenius.fos : null);
  });
});
