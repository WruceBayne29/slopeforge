import { describe, expect, it } from 'vitest';
import { homogeneous, soil } from './fixtures';
import { yAt } from './geometry';
import { checkModel, ModelError, prepare, soilAt, strataPolygons } from './strata';
import type { SlopeModel } from './types';

const ground = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 30, y: 10 },
  { x: 50, y: 10 },
];
const base = (): SlopeModel => homogeneous(ground, -10, soil(18, 10, 25));
const layered = (): SlopeModel => ({
  ...base(),
  soils: [
    soil(18, 0, 35, { id: 'a', name: 'Sand' }),
    soil(19, 20, 0, { id: 'b', name: 'Clay' }),
    soil(21, 5, 30, { id: 'c', name: 'Till' }),
  ],
  boundaries: [
    [
      { x: 0, y: 4 },
      { x: 50, y: 4 },
    ],
    [
      { x: 0, y: -4 },
      { x: 50, y: -6 },
    ],
  ],
});

describe('checkModel', () => {
  it('accepts a sound model', () => {
    expect(checkModel(base())).toEqual([]);
    expect(checkModel(layered())).toEqual([]);
  });

  const cases: [string, (m: SlopeModel) => void, string][] = [
    ['one ground point', (m) => (m.ground = [{ x: 0, y: 0 }]), 'at least two points'],
    [
      'a NaN ground point',
      (m) =>
        (m.ground = [
          { x: 0, y: 0 },
          { x: NaN, y: 1 },
        ]),
      'not a number',
    ],
    [
      'an overhang',
      (m) =>
        (m.ground = [
          { x: 0, y: 0 },
          { x: 5, y: 1 },
          { x: 5, y: 3 },
        ]),
      'increasing chainage',
    ],
    ['no soils', (m) => (m.soils = []), 'at least one soil'],
    ['a missing boundary', (m) => m.soils.push(soil(18, 1, 1)), 'one layer boundary'],
    ['zero unit weight', (m) => (m.soils[0].gamma = 0), 'unit weight must be greater than zero'],
    ['a bad saturated weight', (m) => (m.soils[0].gammaSat = -1), 'saturated unit weight'],
    ['negative cohesion', (m) => (m.soils[0].c = -1), 'cohesion cannot be negative'],
    ['a friction angle of 90', (m) => (m.soils[0].phi = 90), 'between 0° and 90°'],
    ['a base above the ground', (m) => (m.base = 0), 'below the lowest point'],
    ['a NaN base', (m) => (m.base = NaN), 'base elevation is not a number'],
    ['an empty water table', (m) => (m.water = { kind: 'line', points: [] }), 'no valid points'],
    [
      'a water table that doubles back',
      (m) =>
        (m.water = {
          kind: 'line',
          points: [
            { x: 5, y: 1 },
            { x: 2, y: 1 },
          ],
        }),
      'Water table points',
    ],
    ['ru of 1', (m) => (m.water = { kind: 'ru', ru: 1 }), 'ru must be between 0 and 1'],
    ['no water weight', (m) => (m.gammaW = 0), 'unit weight of water'],
    ['a negative seismic coefficient', (m) => (m.kh = -0.1), 'seismic coefficient'],
    ['a reversed surcharge', (m) => m.surcharges.push({ x1: 5, x2: 2, q: 10 }), 'to the right'],
    [
      'a negative surcharge',
      (m) => m.surcharges.push({ x1: 1, x2: 2, q: -1 }),
      'cannot be negative',
    ],
    ['a crack of no depth', (m) => (m.crack = { depth: 0, water: 0 }), 'crack depth'],
    ['an over-full crack', (m) => (m.crack = { depth: 1, water: 2 }), 'between 0 and 1'],
  ];
  for (const [name, change, expected] of cases) {
    it(`reports ${name}`, () => {
      const m = base();
      change(m);
      expect(checkModel(m).join(' | ')).toContain(expected);
    });
  }

  it('reports bad layer boundaries', () => {
    const m = layered();
    m.boundaries[0] = [];
    m.boundaries[1] = [
      { x: 5, y: 0 },
      { x: 1, y: 0 },
    ];
    const text = checkModel(m).join(' | ');
    expect(text).toContain('Layer boundary 1 has no valid points');
    expect(text).toContain('Layer boundary 2 must run left to right');
  });
});

describe('prepare', () => {
  it('throws a ModelError listing the problems', () => {
    const m = base();
    m.soils[0].gamma = -3;
    m.kh = 2;
    let caught: unknown;
    try {
      prepare(m);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ModelError);
    expect((caught as ModelError).problems).toHaveLength(2);
  });

  it('clips layer boundaries to the ground surface', () => {
    const pm = prepare(layered());
    // the boundary at y = 4 daylights on the slope face at x = 18
    expect(yAt(pm.boundaries[0], 5)).toBeCloseTo(0, 12);
    expect(yAt(pm.boundaries[0], 14)).toBeCloseTo(2, 12);
    expect(yAt(pm.boundaries[0], 18)).toBeCloseTo(4, 12);
    expect(yAt(pm.boundaries[0], 40)).toBeCloseTo(4, 12);
    expect(pm.breaks).toContain(10);
    expect(pm.breaks.some((x) => Math.abs(x - 18) < 1e-9)).toBe(true);
    expect(pm.low).toBe(0);
    expect(pm.high).toBe(10);
    expect(pm.xmin).toBe(0);
    expect(pm.xmax).toBe(50);
  });

  it('keeps boundaries in order when a lower one is drawn above an upper one', () => {
    const m = layered();
    m.boundaries[1] = [
      { x: 0, y: 8 },
      { x: 50, y: 8 },
    ];
    const pm = prepare(m);
    for (const x of [0, 12, 20, 33, 50]) {
      expect(yAt(pm.boundaries[1], x)).toBeLessThanOrEqual(yAt(pm.boundaries[0], x) + 1e-12);
    }
  });

  it('adds breaks where the water table meets the ground and at surcharge edges', () => {
    const m = base();
    m.water = {
      kind: 'line',
      points: [
        { x: 0, y: 5 },
        { x: 50, y: 5 },
      ],
    };
    m.surcharges = [{ x1: 35, x2: 42, q: 10 }];
    const pm = prepare(m);
    expect(pm.water).not.toBeNull();
    expect(pm.breaks.some((x) => Math.abs(x - 20) < 1e-9)).toBe(true);
    expect(pm.breaks).toContain(35);
    expect(pm.breaks).toContain(42);
  });

  it('tells which soil is at a point', () => {
    const pm = prepare(layered());
    expect(soilAt(pm, 40, 8)).toBe(0);
    expect(soilAt(pm, 40, 0)).toBe(1);
    expect(soilAt(pm, 40, -8)).toBe(2);
    // in front of the toe the sand has pinched out
    expect(soilAt(pm, 5, -1)).toBe(1);
  });

  it('outlines each stratum for drawing', () => {
    const polys = strataPolygons(prepare(layered()));
    expect(polys).toHaveLength(3);
    const area = (poly: { x: number; y: number }[]): number => {
      let a = 0;
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i];
        const q = poly[(i + 1) % poly.length];
        a += p.x * q.y - q.x * p.y;
      }
      return Math.abs(a) / 2;
    };
    // sand: triangle on the face (18..30 → 6 high) plus the 20 m × 6 m block behind the crest
    expect(area(polys[0])).toBeCloseTo(0.5 * 12 * 6 + 20 * 6, 9);
    // total area down to the base
    const total = polys.reduce((s, p) => s + area(p), 0);
    expect(total).toBeCloseTo(50 * 10 + 0.5 * 20 * 10 + 20 * 10, 9);
  });
});
