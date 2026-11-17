import { describe, expect, it } from 'vitest';
import { analyseCircle } from './analyse';
import { mirrored, simpleSlope, soil } from './fixtures';
import { bishopSlice, felleniusSlice, methodFos, sliceInput, solveBishop } from './methods';
import { infiniteSlopeFos, phiZeroExact } from './reference';
import { prepare } from './strata';
import type { CircleSuccess, SlopeModel } from './types';

/** 10 m high 45° slope: toe at (0, 0), crest at (10, 10), firm base at −10. */
const slope = (c = 15, phi = 25, gamma = 19): SlopeModel =>
  simpleSlope(10, 45, soil(gamma, c, phi));
const CIRCLE = { xc: 0, yc: 16, r: 18 };

function ok(model: SlopeModel, circle = CIRCLE, slices = 30): CircleSuccess {
  const a = analyseCircle(model, circle, { slices });
  if (!a.ok) throw new Error(`expected a valid circle: ${a.message}`);
  return a;
}

describe('analyseCircle: circles that cannot be analysed', () => {
  const code = (model: SlopeModel, circle: typeof CIRCLE, opts = {}): string => {
    const a = analyseCircle(model, circle, opts);
    return a.ok ? 'ok' : a.code;
  };

  it('rejects a circle without a radius', () => {
    expect(code(slope(), { xc: 0, yc: 10, r: 0 })).toBe('bad-circle');
    expect(code(slope(), { xc: NaN, yc: 10, r: 5 })).toBe('bad-circle');
  });

  it('rejects a circle that misses the ground', () => {
    expect(code(slope(), { xc: 0, yc: 40, r: 5 })).toBe('no-intersection');
    expect(code(slope(), { xc: 200, yc: 12, r: 5 })).toBe('no-intersection');
  });

  it('rejects a circle that runs out of the section', () => {
    expect(code(slope(), { xc: 5, yc: 30, r: 60 })).toBe('outside-model');
  });

  it('rejects an arc that turns vertical below ground', () => {
    expect(code(slope(), { xc: 12, yc: 8, r: 5 })).toBe('vertical');
  });

  it('rejects a circle that passes below the firm base', () => {
    expect(code(slope(), { xc: 0, yc: 15, r: 26 })).toBe('below-base');
  });

  it('rejects a circle shallower than the minimum depth', () => {
    expect(code(slope(), CIRCLE, { minDepth: 50 })).toBe('too-shallow');
    expect(code(slope(), CIRCLE, { minDepth: 1 })).toBe('ok');
  });

  it('rejects a circle wholly inside the tension crack depth', () => {
    expect(code({ ...slope(), crack: { depth: 50, water: 0 } }, CIRCLE)).toBe('crack');
  });

  it('rejects a circle under level ground, which has no driving moment', () => {
    const a = analyseCircle(slope(), { xc: -20, yc: 5, r: 8 });
    expect(a.ok).toBe(false);
    if (!a.ok) {
      expect(a.code).toBe('no-driving');
      expect(a.message).toMatch(/no tendency to slide/);
    }
  });

  it('rejects a mass that water pressure on the face holds in place', () => {
    // A weightless-looking sliver: deep pond against a slope with a tiny driving moment.
    const m = slope();
    m.ground = [
      { x: -40, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0.05 },
      { x: 50, y: 0.05 },
    ];
    m.water = {
      kind: 'line',
      points: [
        { x: -40, y: 30 },
        { x: 50, y: 30 },
      ],
    };
    m.soils[0].gamma = 0.5;
    const a = analyseCircle(m, { xc: 5.2, yc: 8, r: 10 });
    expect(a.ok).toBe(false);
  });
});

describe('analyseCircle: slices', () => {
  it('reproduces the area of the sliding mass exactly, whatever the slice count', () => {
    const m = slope();
    const xb = CIRCLE.xc + Math.sqrt(CIRCLE.r ** 2 - (CIRCLE.yc - 10) ** 2);
    const xa = CIRCLE.xc - Math.sqrt(CIRCLE.r ** 2 - CIRCLE.yc ** 2);
    const exact = phiZeroExact(m.ground, 19, 15, CIRCLE, xa, xb);
    for (const n of [3, 10, 57]) {
      const a = ok(m, CIRCLE, n);
      expect(a.area).toBeCloseTo(exact.area, 8);
      expect(a.weight).toBeCloseTo(19 * exact.area, 6);
      expect(a.slices.length).toBeGreaterThanOrEqual(n);
      expect(a.toe.x).toBeCloseTo(xa, 8);
      expect(a.crest.x).toBeCloseTo(xb, 8);
    }
  });

  it('never lets a slice straddle a ground vertex', () => {
    const m = slope();
    const a = ok(m, CIRCLE, 7);
    for (const s of a.slices) {
      for (const v of m.ground) expect(s.x1 < v.x && s.x2 > v.x).toBe(false);
    }
  });

  it('builds each slice from the textbook quantities', () => {
    const a = ok(slope(), CIRCLE, 12);
    const tanPhi = Math.tan((25 * Math.PI) / 180);
    let driving = 0;
    let resisting = 0;
    for (const s of a.slices) {
      expect(s.b).toBeCloseTo(s.x2 - s.x1, 12);
      expect(Math.sin(s.alpha)).toBeCloseTo((s.xm - CIRCLE.xc) / CIRCLE.r, 12);
      expect(s.l).toBeCloseTo(s.b / Math.cos(s.alpha), 12);
      expect(s.weight).toBeCloseTo(19 * s.h * s.b, 9);
      expect(s.load).toBe(s.weight);
      expect(s.u).toBe(0);
      expect(s.nFellenius).toBeCloseTo(s.weight * Math.cos(s.alpha), 9);
      expect(s.tFellenius).toBeCloseTo(15 * s.l + s.nFellenius * tanPhi, 9);
      expect(s.driving).toBeCloseTo(s.weight * Math.sin(s.alpha), 9);
      expect(s.layers).toHaveLength(1);
      driving += s.driving;
      resisting += s.tFellenius;
    }
    expect(a.fellenius.fos).toBeCloseTo(resisting / driving, 12);
    expect(a.drivingMoment).toBeCloseTo(driving * CIRCLE.r, 9);
    expect(a.fellenius.resistingMoment).toBeCloseTo(resisting * CIRCLE.r, 9);
  });

  it('satisfies Bishop’s equation at the converged factor', () => {
    const a = ok(slope(), CIRCLE, 25);
    const f = a.bishop.fos as number;
    const tanPhi = Math.tan((25 * Math.PI) / 180);
    let sum = 0;
    for (const s of a.slices) {
      const m = Math.cos(s.alpha) + (Math.sin(s.alpha) * tanPhi) / f;
      expect(s.mAlpha).toBeCloseTo(m, 12);
      sum += (15 * s.b + s.weight * tanPhi) / m;
      expect(s.tBishop).toBeCloseTo((15 * s.b + s.weight * tanPhi) / m, 9);
    }
    expect(sum / (a.drivingMoment / CIRCLE.r)).toBeCloseTo(f, 5);
    expect(a.bishop.converged).toBe(true);
    expect(a.bishop.iterations[0]).toBeCloseTo(a.fellenius.fos as number, 12);
    expect(a.bishop.iterations.length).toBeGreaterThan(2);
    expect(f).toBeGreaterThan(a.fellenius.fos as number);
  });

  it('gives the same answer for the mirror image of the slope', () => {
    const m = slope();
    const a = ok(m);
    const b = ok(mirrored(m), { xc: -CIRCLE.xc, yc: CIRCLE.yc, r: CIRCLE.r });
    expect(a.dir).toBe(1);
    expect(b.dir).toBe(-1);
    expect(b.fellenius.fos).toBeCloseTo(a.fellenius.fos as number, 10);
    expect(b.bishop.fos).toBeCloseTo(a.bishop.fos as number, 6);
    expect(b.toe.x).toBeCloseTo(-a.toe.x, 9);
    expect(b.crest.x).toBeCloseTo(-a.crest.x, 9);
    expect(b.slices[b.slices.length - 1].alpha).toBeCloseTo(a.slices[0].alpha, 9);
  });

  it('accepts a prepared model as well as a raw one', () => {
    const m = slope();
    const a = analyseCircle(prepare(m), CIRCLE);
    expect(a.ok && a.fellenius.fos).toBeCloseTo(ok(m).fellenius.fos as number, 12);
  });
});

describe('analyseCircle: φ = 0', () => {
  it('makes both methods agree and converge on the exact moment solution', () => {
    const m = slope(40, 0, 18);
    const xb = CIRCLE.xc + Math.sqrt(CIRCLE.r ** 2 - (CIRCLE.yc - 10) ** 2);
    const xa = CIRCLE.xc - Math.sqrt(CIRCLE.r ** 2 - CIRCLE.yc ** 2);
    const exact = phiZeroExact(m.ground, 18, 40, CIRCLE, xa, xb);
    const coarse = ok(m, CIRCLE, 10);
    const fine = ok(m, CIRCLE, 200);
    expect(fine.bishop.fos).toBeCloseTo(fine.fellenius.fos as number, 9);
    expect(Math.abs((fine.fellenius.fos as number) / exact.fos - 1)).toBeLessThan(2e-4);
    expect(Math.abs((coarse.fellenius.fos as number) / exact.fos - 1)).toBeLessThan(2e-2);
    expect(Math.abs(fine.drivingMoment / exact.drivingMoment - 1)).toBeLessThan(1e-4);
  });
});

describe('analyseCircle: layers', () => {
  const layered = (): SlopeModel => ({
    ...slope(),
    soils: [
      soil(17, 0, 34, { id: 'sand', name: 'Sand' }),
      soil(20, 30, 0, { id: 'clay', name: 'Clay' }),
    ],
    boundaries: [
      [
        { x: -40, y: 4 },
        { x: 50, y: 4 },
      ],
    ],
  });

  it('weighs each stratum and takes strength from the soil at the base', () => {
    const a = ok(layered(), CIRCLE, 20);
    const sandArea = a.slices.reduce(
      (s, sl) => s + sl.layers.filter((l) => l.soil === 0).reduce((t, l) => t + l.area, 0),
      0,
    );
    const clayArea = a.area - sandArea;
    expect(a.weight).toBeCloseTo(17 * sandArea + 20 * clayArea, 6);
    expect(sandArea).toBeGreaterThan(0);
    expect(clayArea).toBeGreaterThan(0);
    for (const s of a.slices) {
      const inSand = s.yBase > 4;
      expect(s.soil).toBe(inSand ? 0 : 1);
      expect(s.c).toBe(inSand ? 0 : 30);
      expect(s.phi).toBe(inSand ? 34 : 0);
      // a slice boundary falls where the arc crosses the layer boundary
      const cuts = (x: number): boolean => CIRCLE.yc - Math.sqrt(CIRCLE.r ** 2 - x * x) > 4;
      expect(cuts(s.x1 + 1e-6)).toBe(cuts(s.x2 - 1e-6));
    }
  });
});

describe('analyseCircle: water', () => {
  it('takes pore pressure from the depth below a phreatic line', () => {
    const m: SlopeModel = {
      ...slope(),
      water: {
        kind: 'line',
        points: [
          { x: -40, y: 0 },
          { x: 0, y: 0 },
          { x: 30, y: 6 },
        ],
      },
    };
    const wet = ok(m);
    const dry = ok(slope());
    for (const s of wet.slices) {
      const w = s.xm <= 0 ? 0 : Math.min(6, s.xm / 5);
      expect(s.u).toBeCloseTo(9.81 * Math.max(0, w - s.yBase), 9);
    }
    expect(wet.fellenius.fos as number).toBeLessThan(dry.fellenius.fos as number);
    expect(wet.bishop.fos as number).toBeLessThan(dry.bishop.fos as number);
    expect(wet.weight).toBeCloseTo(dry.weight, 9);
  });

  it('uses the saturated unit weight below the phreatic line', () => {
    const m: SlopeModel = {
      ...slope(),
      water: {
        kind: 'line',
        points: [
          { x: -40, y: 3 },
          { x: 50, y: 3 },
        ],
      },
    };
    m.soils[0].gammaSat = 21;
    const a = ok(m, CIRCLE, 40);
    const wet = a.slices.reduce((s, sl) => s + sl.layers[0].wetArea, 0);
    expect(wet).toBeGreaterThan(0);
    expect(wet).toBeLessThan(a.area);
    expect(a.weight).toBeCloseTo(19 * (a.area - wet) + 21 * wet, 6);
    // the pond in front of the slope (ground at 0, water at 3) loads the slices it stands on
    const front = a.slices.filter((s) => s.x2 <= 0);
    for (const s of front) expect(s.pond).toBeCloseTo(9.81 * 3 * s.b, 9);
  });

  it('applies ru as a fraction of the overburden', () => {
    const m: SlopeModel = { ...slope(), water: { kind: 'ru', ru: 0.3 } };
    const a = ok(m);
    for (const s of a.slices) expect(s.u).toBeCloseTo((0.3 * s.weight) / s.b, 9);
    expect(a.bishop.fos as number).toBeLessThan(ok(slope()).bishop.fos as number);
    const zero = ok({ ...slope(), water: { kind: 'ru', ru: 0 } });
    expect(zero.bishop.fos).toBeCloseTo(ok(slope()).bishop.fos as number, 12);
  });

  it('treats a fully submerged slope like a dry one with the buoyant unit weight (Bishop)', () => {
    const submerged: SlopeModel = {
      ...slope(12, 28, 20),
      water: {
        kind: 'line',
        points: [
          { x: -40, y: 14 },
          { x: 50, y: 14 },
        ],
      },
    };
    const buoyant = slope(12, 28, 20 - 9.81);
    const a = ok(submerged, CIRCLE, 120);
    const b = ok(buoyant, CIRCLE, 120);
    expect(Math.abs((a.bishop.fos as number) / (b.bishop.fos as number) - 1)).toBeLessThan(2e-3);
    expect(Math.abs(a.drivingMoment / b.drivingMoment - 1)).toBeLessThan(2e-3);
  });

  it('warns when pore pressure makes the normal force negative', () => {
    const m: SlopeModel = { ...slope(5, 30), water: { kind: 'ru', ru: 0.95 } };
    const a = ok(m);
    expect(a.warnings.join(' ')).toMatch(/Ordinary method: the effective normal force is negative/);
    expect(a.slices.some((s) => s.nFellenius < 0)).toBe(true);
    for (const s of a.slices) expect(s.tFellenius).toBeGreaterThanOrEqual(5 * s.l - 1e-9);
  });
});

describe('analyseCircle: loads', () => {
  it('adds a surcharge to the slices it stands on', () => {
    const m: SlopeModel = { ...slope(), surcharges: [{ x1: 12, x2: 15, q: 40 }] };
    const a = ok(m);
    const total = a.slices.reduce((s, sl) => s + sl.surcharge, 0);
    expect(total).toBeCloseTo(40 * 3, 9);
    for (const s of a.slices) expect(s.load).toBeCloseTo(s.weight + s.surcharge, 12);
    expect(a.fellenius.fos as number).toBeLessThan(ok(slope()).fellenius.fos as number);
    expect(a.bishop.fos as number).toBeLessThan(ok(slope()).bishop.fos as number);
  });

  it('applies the seismic coefficient to soil weight, towards the toe', () => {
    const m: SlopeModel = { ...slope(), kh: 0.2, surcharges: [{ x1: 12, x2: 15, q: 40 }] };
    const a = ok(m);
    for (const s of a.slices) {
      expect(s.hForce).toBeCloseTo(0.2 * s.weight, 9);
      expect(s.nFellenius).toBeCloseTo(
        s.load * Math.cos(s.alpha) - 0.2 * s.weight * Math.sin(s.alpha),
        9,
      );
    }
    const still = ok({ ...m, kh: 0 });
    expect(a.drivingMoment).toBeGreaterThan(still.drivingMoment);
    expect(a.bishop.fos as number).toBeLessThan(still.bishop.fos as number);
  });

  it('cuts the surface off at a tension crack and adds the water thrust', () => {
    const dryCrack = ok({ ...slope(), crack: { depth: 2, water: 0 } });
    const none = ok(slope());
    expect(dryCrack.crackDepth).toBe(2);
    expect(dryCrack.crackThrust).toBe(0);
    expect(dryCrack.crest.x).toBeLessThan(none.crest.x);
    expect(10 - dryCrack.crest.y).toBeCloseTo(2, 6);
    expect(dryCrack.area).toBeLessThan(none.area);

    const wetCrack = ok({ ...slope(), crack: { depth: 2, water: 1 } });
    expect(wetCrack.crackThrust).toBeCloseTo(0.5 * 9.81 * 4, 9);
    const arm = CIRCLE.yc - (wetCrack.crest.y + 2 / 3);
    expect(wetCrack.drivingMoment - dryCrack.drivingMoment).toBeCloseTo(
      wetCrack.crackThrust * arm,
      6,
    );
    expect(wetCrack.bishop.fos as number).toBeLessThan(dryCrack.bishop.fos as number);
  });

  it('puts the crack on the high side when the slope faces the other way', () => {
    const m = mirrored({ ...slope(), crack: { depth: 2, water: 0.5 } });
    const a = ok(m, { xc: 0, yc: CIRCLE.yc, r: CIRCLE.r });
    expect(a.crest.x).toBeLessThan(a.toe.x);
    expect(10 - a.crest.y).toBeCloseTo(2, 6);
    const right = ok({ ...slope(), crack: { depth: 2, water: 0.5 } });
    expect(a.bishop.fos).toBeCloseTo(right.bishop.fos as number, 6);
  });
});

describe('analyseCircle: degenerate strength', () => {
  it('reports F = 0 for a soil with no strength', () => {
    const a = ok(slope(0, 0));
    expect(a.fellenius.fos).toBe(0);
    expect(a.bishop.fos).toBe(0);
    expect(a.warnings.join(' ')).toMatch(/no strength/);
  });

  it('still returns the ordinary factor when pore pressure is extreme', () => {
    const m: SlopeModel = { ...slope(0, 45), water: { kind: 'ru', ru: 0.9 } };
    const a = ok(m, { xc: 15, yc: 12, r: 20 });
    expect(a.fellenius.fos).not.toBeNull();
    if (a.bishop.fos === null) expect(a.bishop.note).toBeDefined();
    else expect(a.warnings.join(' ')).toMatch(/Bishop/);
    expect(methodFos(a.fellenius)).toBe(a.fellenius.fos);
    expect(methodFos({ fos: null, resistingMoment: 0, iterations: [], converged: false })).toBe(
      Infinity,
    );
  });
});

describe('methods', () => {
  const s = {
    b: 2,
    alpha: 0.4,
    l: 2 / Math.cos(0.4),
    load: 100,
    hForce: 10,
    u: 5,
    c: 8,
    tanPhi: 0.5,
  };

  it('resolves the ordinary method normal to the base', () => {
    const f = felleniusSlice(s);
    expect(f.n).toBeCloseTo(100 * Math.cos(0.4) - 10 * Math.sin(0.4) - 5 * s.l, 12);
    expect(f.t).toBeCloseTo(8 * s.l + 0.5 * f.n, 12);
    expect(felleniusSlice({ ...s, u: 500 }).t).toBeCloseTo(8 * s.l, 12);
  });

  it('resolves Bishop vertically', () => {
    const b = bishopSlice(s, 1.5);
    const m = Math.cos(0.4) + (Math.sin(0.4) * 0.5) / 1.5;
    expect(b.mAlpha).toBeCloseTo(m, 12);
    expect(b.t).toBeCloseTo((8 * 2 + (100 - 5 * 2) * 0.5) / m, 10);
    expect(bishopSlice({ ...s, u: 500 }, 1.5).t).toBeCloseTo(8 * s.l, 12);
  });

  it('returns zero at once when there is no strength', () => {
    expect(solveBishop([{ ...s, c: 0, tanPhi: 0 }], 50, 1)).toEqual({
      fos: 0,
      iterations: [0],
      converged: true,
    });
  });

  it('starts from 1 when the starting value is unusable', () => {
    const r = solveBishop([s], 40, 0);
    expect(r.iterations[0]).toBe(1);
    expect(r.converged).toBe(true);
    expect(r.fos).toBeGreaterThan(0);
  });

  it('reports a breakdown instead of a negative factor', () => {
    const r = solveBishop([{ ...s, c: 0, load: 100 }], -40, 1);
    expect(r.fos).toBeNull();
    expect(r.note).toMatch(/broke down/);
  });

  it('reports when the iteration does not settle', () => {
    // A steep reverse base with strong friction: the fixed point repels (|g′| = 1.46).
    const nasty = { ...s, alpha: -1.35, l: 2 / Math.cos(1.35), load: 100, u: 0, c: 0, tanPhi: 3 };
    const r = solveBishop([nasty], 150, 1);
    expect(r.fos).toBeNull();
    expect(r.converged).toBe(false);
    expect(r.note).toMatch(/did not converge in 100 steps/);
  });

  it('declares the method invalid when mα ends up negative', () => {
    // The toe slice is buoyed off its base (no friction counted), so nothing stops mα < 0.
    const floating = { ...s, alpha: -1.2, l: 2 / Math.cos(1.2), load: 10, u: 50, c: 0, tanPhi: 1 };
    const r = solveBishop([floating, s], 200, 1);
    expect(r.fos).toBeNull();
    expect(r.note).toMatch(/mα ≤ 0/);
  });

  it('copies a slice into method input', () => {
    const a = ok(slope());
    const inp = sliceInput(a.slices[3], 0.5);
    expect(inp.load).toBe(a.slices[3].load);
    expect(inp.tanPhi).toBe(0.5);
  });
});

describe('infinite slope reference', () => {
  it('reduces to the familiar formula when dry and static', () => {
    const f = infiniteSlopeFos({ beta: 25, z: 3, gamma: 18, c: 6, phi: 30 });
    const b = (25 * Math.PI) / 180;
    expect(f).toBeCloseTo(
      6 / (18 * 3 * Math.sin(b) * Math.cos(b)) + Math.tan(Math.PI / 6) / Math.tan(b),
      12,
    );
    expect(infiniteSlopeFos({ beta: 25, z: 3, gamma: 18, c: 6, phi: 30, kh: 0.1 })).toBeLessThan(f);
    expect(infiniteSlopeFos({ beta: 25, z: 3, gamma: 18, c: 6, phi: 30, u: 10 })).toBeLessThan(f);
  });
});
