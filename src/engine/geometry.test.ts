import { describe, expect, it } from 'vitest';
import {
  arcCrossings,
  arcIntegral,
  arcY,
  crossings,
  distanceToPolyline,
  lowerEnvelope,
  simplify,
  span,
  uniqueSorted,
  yAt,
} from './geometry';

const line = [
  { x: 0, y: 0 },
  { x: 10, y: 5 },
  { x: 20, y: 5 },
  { x: 30, y: 15 },
];

describe('polylines', () => {
  it('interpolates between vertices', () => {
    expect(yAt(line, 5)).toBeCloseTo(2.5, 12);
    expect(yAt(line, 10)).toBe(5);
    expect(yAt(line, 15)).toBe(5);
    expect(yAt(line, 25)).toBeCloseTo(10, 12);
  });

  it('continues horizontally beyond its ends', () => {
    expect(yAt(line, -5)).toBe(0);
    expect(yAt(line, 99)).toBe(15);
  });

  it('sorts and merges close values', () => {
    expect(uniqueSorted([3, 1, 1.0000001, 2], 1e-3)).toEqual([1, 2, 3]);
    expect(uniqueSorted([], 1)).toEqual([]);
  });

  it('spans a polyline over a range, cropping and extending', () => {
    expect(span(line, 5, 25)).toEqual([
      { x: 5, y: 2.5 },
      { x: 10, y: 5 },
      { x: 20, y: 5 },
      { x: 25, y: 10 },
    ]);
    expect(span([{ x: 3, y: 7 }], 0, 10)).toEqual([
      { x: 0, y: 7 },
      { x: 3, y: 7 },
      { x: 10, y: 7 },
    ]);
  });

  it('finds where two polylines cross', () => {
    const flat = [
      { x: 0, y: 2.5 },
      { x: 30, y: 2.5 },
    ];
    const xs = crossings(line, flat);
    expect(xs).toHaveLength(1);
    expect(xs[0]).toBeCloseTo(5, 12);
    expect(
      crossings(line, [
        { x: 0, y: 50 },
        { x: 30, y: 50 },
      ]),
    ).toEqual([]);
  });

  it('drops vertices that lie on a straight line', () => {
    const p = simplify([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 0 },
    ]);
    expect(p).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 2 },
      { x: 3, y: 0 },
    ]);
  });

  it('takes the lower envelope of two polylines', () => {
    const flat = [
      { x: 0, y: 4 },
      { x: 30, y: 4 },
    ];
    const env = lowerEnvelope(line, flat);
    expect(yAt(env, 4)).toBeCloseTo(2, 12);
    expect(yAt(env, 8)).toBeCloseTo(4, 12);
    expect(yAt(env, 15)).toBeCloseTo(4, 12);
    expect(yAt(env, 30)).toBeCloseTo(4, 12);
    // one corner where the lines cross, none along the flat part
    expect(env).toHaveLength(3);
  });

  it('measures the distance from a point to a polyline', () => {
    expect(distanceToPolyline({ x: 15, y: 9 }, line)).toBeCloseTo(4, 12);
    expect(distanceToPolyline({ x: -3, y: -4 }, line)).toBeCloseTo(5, 12);
    expect(
      distanceToPolyline({ x: 1, y: 1 }, [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ]),
    ).toBeCloseTo(Math.SQRT2, 12);
  });
});

describe('circular arc', () => {
  const c = { xc: 2, yc: 10, r: 5 };

  it('gives the elevation of the lower arc', () => {
    expect(arcY(c, 2)).toBe(5);
    expect(arcY(c, 5)).toBeCloseTo(6, 12);
    expect(arcY(c, 7)).toBeCloseTo(10, 12);
    expect(arcY(c, 7.0000001)).toBeCloseTo(10, 6);
  });

  it('integrates the arc exactly', () => {
    // compare with Simpson's rule
    const n = 2000;
    let sum = 0;
    const a = -1;
    const b = 6;
    for (let i = 0; i <= n; i++) {
      const x = a + ((b - a) * i) / n;
      sum += arcY(c, x) * (i === 0 || i === n ? 1 : i % 2 === 1 ? 4 : 2);
    }
    expect(arcIntegral(c, a, b)).toBeCloseTo((sum * (b - a)) / (3 * n), 8);
    // the full lower semicircle: rectangle minus half the disc
    expect(arcIntegral(c, -3, 7)).toBeCloseTo(10 * 10 - (Math.PI * 25) / 2, 10);
  });

  it('finds where the lower arc crosses a polyline', () => {
    const flat = [
      { x: -10, y: 7 },
      { x: 20, y: 7 },
    ];
    const xs = arcCrossings(flat, c).sort((p, q) => p - q);
    expect(xs).toHaveLength(2);
    expect(xs[0]).toBeCloseTo(-2, 10);
    expect(xs[1]).toBeCloseTo(6, 10);
  });

  it('ignores the upper arc, tangents and misses', () => {
    expect(
      arcCrossings(
        [
          { x: -10, y: 13 },
          { x: 20, y: 13 },
        ],
        c,
      ),
    ).toEqual([]);
    expect(
      arcCrossings(
        [
          { x: -10, y: 5 },
          { x: 20, y: 5 },
        ],
        c,
      ),
    ).toEqual([]);
    expect(
      arcCrossings(
        [
          { x: -10, y: 1 },
          { x: 20, y: 1 },
        ],
        c,
      ),
    ).toEqual([]);
    expect(
      arcCrossings(
        [
          { x: 0, y: 7 },
          { x: 1, y: 7 },
        ],
        c,
      ),
    ).toEqual([]);
    expect(
      arcCrossings(
        [
          { x: 0, y: 7 },
          { x: 0, y: 7 },
        ],
        c,
      ),
    ).toEqual([]);
  });
});
