import { describe, expect, it } from 'vitest';
import { contourLevels, contours } from './contours';

describe('contourLevels', () => {
  it('chooses round levels just above the minimum', () => {
    const levels = contourLevels(1.403, 3.2);
    expect(levels[0]).toBeGreaterThan(1.403);
    expect(levels.length).toBeGreaterThanOrEqual(3);
    expect(levels.length).toBeLessThanOrEqual(12);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i] - levels[i - 1]).toBeCloseTo(levels[1] - levels[0], 9);
    }
    expect(levels[levels.length - 1]).toBeLessThanOrEqual(1.35 * 1.403 + 0.1 + 1e-9);
  });

  it('returns nothing for a flat or broken range', () => {
    expect(contourLevels(1, 1)).toEqual([]);
    expect(contourLevels(NaN, 2)).toEqual([]);
    expect(contourLevels(1, Infinity)).toEqual([]);
  });

  it('copes with a very wide range', () => {
    expect(contourLevels(100, 1e6).length).toBeGreaterThan(0);
  });
});

describe('contours', () => {
  const xs = [0, 1, 2, 3, 4];
  const ys = [0, 1, 2, 3, 4];
  // a bowl: distance from (2, 2)
  const bowl = ys.map((y) => xs.map((x) => Math.hypot(x - 2, y - 2)));

  it('draws a closed ring round a minimum', () => {
    const [line] = contours(xs, ys, bowl, [1.5]);
    expect(line.level).toBe(1.5);
    expect(line.paths).toHaveLength(1);
    const ring = line.paths[0];
    expect(ring.length).toBeGreaterThan(8);
    expect(ring[0].x).toBeCloseTo(ring[ring.length - 1].x, 6);
    expect(ring[0].y).toBeCloseTo(ring[ring.length - 1].y, 6);
    for (const p of ring) expect(Math.abs(Math.hypot(p.x - 2, p.y - 2) - 1.5)).toBeLessThan(0.2);
  });

  it('interpolates linearly along cell edges', () => {
    const plane = ys.map(() => xs.map((x) => 10 * x));
    const [line] = contours(xs, ys, plane, [25]);
    expect(line.paths).toHaveLength(1);
    for (const p of line.paths[0]) expect(p.x).toBeCloseTo(2.5, 12);
    expect(line.paths[0]).toHaveLength(5);
  });

  it('skips cells with a missing corner', () => {
    const holed = bowl.map((row) => row.map((v) => v as number | null));
    holed[0][0] = null;
    holed[4][4] = null;
    const [line] = contours(xs, ys, holed, [2.4]);
    const count = line.paths.reduce((n, p) => n + p.length - 1, 0);
    const [full] = contours(xs, ys, bowl, [2.4]);
    const fullCount = full.paths.reduce((n, p) => n + p.length - 1, 0);
    expect(count).toBeLessThan(fullCount);
  });

  it('resolves a saddle either way', () => {
    const sx = [0, 1];
    const sy = [0, 1];
    const high = contours(
      sx,
      sy,
      [
        [1, 0],
        [0.2, 1],
      ],
      [0.5],
    );
    const low = contours(
      sx,
      sy,
      [
        [1, 0],
        [0, 0.8],
      ],
      [0.5],
    );
    expect(high[0].paths).toHaveLength(2);
    expect(low[0].paths).toHaveLength(2);
    // with a high centre the two high corners are joined, so no segment cuts off corner (0, 0)
    const near = (paths: { x: number; y: number }[][]): boolean =>
      paths.some((p) => p.every((q) => q.x <= 0.6 && q.y <= 0.6));
    expect(near(high[0].paths)).toBe(false);
    expect(near(low[0].paths)).toBe(true);
  });

  it('gives no paths when the level is out of range', () => {
    expect(contours(xs, ys, bowl, [99])[0].paths).toEqual([]);
  });
});
