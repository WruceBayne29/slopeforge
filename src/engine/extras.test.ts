import { describe, expect, it } from 'vitest';
import { analyseCircle } from './analyse';
import { simpleSlope, soil } from './fixtures';
import { fosOf, refineCircle, searchCritical } from './search';
import { sensitivity } from './sensitivity';
import { fix, workedSteps } from './steps';
import type { CircleSuccess, SlopeModel } from './types';

const slope = (): SlopeModel => simpleSlope(10, 35, soil(19, 12, 24));
const critical = searchCritical(slope()).critical as CircleSuccess;

describe('refineCircle', () => {
  it('recovers the critical circle from a nearby start', () => {
    const start = {
      xc: critical.circle.xc + 1.5,
      yc: critical.circle.yc - 1,
      r: critical.circle.r,
    };
    const refined = refineCircle(slope(), start);
    expect(refined).not.toBeNull();
    expect(
      Math.abs((refined?.bishop.fos as number) / (critical.bishop.fos as number) - 1),
    ).toBeLessThan(3e-3);
  });

  it('keeps the start circle when it is already the best', () => {
    const again = refineCircle(slope(), critical.circle);
    expect(again?.bishop.fos as number).toBeLessThanOrEqual((critical.bishop.fos as number) + 1e-9);
  });

  it('returns null when nothing valid is near', () => {
    expect(refineCircle(slope(), { xc: 0, yc: -50, r: 3 })).toBeNull();
  });

  it('follows the chosen method', () => {
    const f = refineCircle(slope(), critical.circle, { method: 'fellenius' });
    expect(fosOf(f as CircleSuccess, 'fellenius')).toBeLessThan(critical.bishop.fos as number);
  });
});

describe('sensitivity', () => {
  it('rises with strength and falls as the water table rises', () => {
    const model: SlopeModel = {
      ...slope(),
      water: {
        kind: 'line',
        points: [
          { x: -40, y: -1 },
          { x: 0, y: -1 },
          { x: 54, y: 6 },
        ],
      },
    };
    const start = searchCritical(model).critical as CircleSuccess;
    const curves = sensitivity(model, start.circle);
    expect(curves.map((c) => c.parameter)).toEqual(['cohesion', 'friction', 'water']);
    for (const curve of curves) {
      expect(curve.points).toHaveLength(9);
      const fs = curve.points.map((p) => p.fos as number);
      for (let i = 1; i < fs.length; i++) {
        if (curve.parameter === 'water') expect(fs[i]).toBeLessThanOrEqual(fs[i - 1] + 1e-3);
        else expect(fs[i]).toBeGreaterThanOrEqual(fs[i - 1] - 1e-3);
      }
      const mid = curve.points.find((p) => p.value === curve.base);
      expect(Math.abs((mid?.fos as number) / (start.bishop.fos as number) - 1)).toBeLessThan(5e-3);
    }
    expect(curves[2].points[0].value).toBe(-3);
  });

  it('sweeps ru when pore pressure is given as a ratio', () => {
    const model: SlopeModel = { ...slope(), water: { kind: 'ru', ru: 0.2 } };
    const start = searchCritical(model).critical as CircleSuccess;
    const ru = sensitivity(model, start.circle).find((c) => c.parameter === 'ru');
    expect(ru?.base).toBe(0.2);
    expect(ru?.points[0].fos as number).toBeGreaterThan(ru?.points[6].fos as number);
  });

  it('leaves out parameters the model does not have', () => {
    const sand = simpleSlope(10, 30, soil(18, 0, 34));
    const start = { xc: 6, yc: 18, r: 18.5 };
    expect(sensitivity(sand, start).map((c) => c.parameter)).toEqual(['friction']);
    const clay = simpleSlope(10, 30, soil(18, 40, 0));
    expect(sensitivity(clay, start).map((c) => c.parameter)).toEqual(['cohesion']);
  });

  it('reports a gap where no circle is valid', () => {
    const curves = sensitivity(slope(), { xc: 0, yc: -50, r: 3 });
    expect(curves[0].points.every((p) => p.fos === null)).toBe(true);
  });
});

describe('workedSteps', () => {
  it('writes out the slice table and both methods', () => {
    const w = workedSteps(slope(), critical);
    expect(w.sliceTable.rows).toHaveLength(critical.slices.length);
    expect(w.sliceTable.head).toHaveLength(w.sliceTable.units.length);
    expect(w.sliceTable.rows[0]).toHaveLength(w.sliceTable.head.length);
    expect(w.sliceTable.foot).toHaveLength(w.sliceTable.head.length);
    expect(w.fellenius.result).toBe(`F = ${(critical.fellenius.fos as number).toFixed(3)}`);
    expect(w.bishop.result).toContain(`F = ${(critical.bishop.fos as number).toFixed(3)}`);
    expect(w.iterationTable.rows.length).toBe(critical.bishop.iterations.length - 1);
    expect(w.bishopTable?.rows).toHaveLength(critical.slices.length);
    expect(w.circle.lines[0]).toContain('radius R');
    expect(w.moments.lines).toHaveLength(3);
    expect(w.slices.lines.join(' ')).toContain('T = W sin α');
    // the numbers printed in the ordinary-method line reproduce F
    const m = /\(([\d.]+) \+ ([\d.]+)\) \/ ([\d.]+)/.exec(w.fellenius.lines[2]);
    expect(m).not.toBeNull();
    const f = (Number(m?.[1]) + Number(m?.[2])) / Number(m?.[3]);
    expect(f).toBeCloseTo(critical.fellenius.fos as number, 2);
  });

  it('explains water, loads, seismic force and the crack', () => {
    const model: SlopeModel = {
      ...slope(),
      water: {
        kind: 'line',
        points: [
          { x: -40, y: 3 },
          { x: 54, y: 6 },
        ],
      },
      surcharges: [{ x1: 16, x2: 20, q: 15 }],
      kh: 0.1,
      crack: { depth: 1.5, water: 1 },
    };
    const a = analyseCircle(model, critical.circle) as CircleSuccess;
    expect(a.ok).toBe(true);
    const w = workedSteps(model, a);
    const text = [...w.notes, ...w.slices.lines].join(' ');
    expect(text).toContain('surcharge');
    expect(text).toContain('horizontal thrust');
    expect(text).toContain('tension crack 1.50 m deep; the water in it');
    expect(text).toContain('γw × depth below the phreatic line');
    expect(text).toContain('kh W');
    const dryCrack = analyseCircle(
      { ...slope(), crack: { depth: 1.5, water: 0 } },
      critical.circle,
    ) as CircleSuccess;
    expect(workedSteps(slope(), dryCrack).notes.join(' ')).toMatch(/1\.50 m deep\./);
  });

  it('notes ru and a failed Bishop solution', () => {
    const model: SlopeModel = { ...slope(), water: { kind: 'ru', ru: 0.25 } };
    const a = analyseCircle(model, critical.circle) as CircleSuccess;
    expect(workedSteps(model, a).notes.join(' ')).toContain('ru = 0.25');
    const broken: CircleSuccess = {
      ...critical,
      bishop: {
        fos: null,
        resistingMoment: 0,
        iterations: [1.2],
        converged: false,
        note: 'Bishop failed.',
      },
    };
    const w = workedSteps(slope(), broken);
    expect(w.bishopTable).toBeNull();
    expect(w.bishop.result).toBe('No result');
    expect(w.bishop.lines).toContain('Bishop failed.');
    expect(w.moments.lines).toHaveLength(2);
  });

  it('formats numbers with a true minus sign and no negative zero', () => {
    expect(fix(-3.14159, 2)).toBe('−3.14');
    expect(fix(-0.0001, 2)).toBe('0.00');
    expect(fix(NaN, 2)).toBe('–');
    expect(fix(12, 0)).toBe('12');
  });

  it('says "1 iteration" in the singular', () => {
    const one: CircleSuccess = {
      ...critical,
      bishop: { ...critical.bishop, iterations: [1.5, 1.5] },
    };
    expect(workedSteps(slope(), one).bishop.result).toMatch(/after 1 iteration$/);
  });
});
