import { describe, expect, it } from 'vitest';
import { searchCritical } from '../src/engine';
import type { SlopeModel } from '../src/engine';

const homogeneous: SlopeModel = {
  ground: [
    { x: 20, y: 25 },
    { x: 30, y: 25 },
    { x: 50, y: 35 },
    { x: 70, y: 35 },
  ],
  soils: [{ id: 'a', name: 'Soil', pattern: 'clay', gamma: 20, c: 3, phi: 19.6 }],
  boundaries: [],
  base: 20,
  water: { kind: 'none' },
  gammaW: 9.81,
  surcharges: [],
  kh: 0,
  crack: null,
};

describe('critical circle search on a benchmark slope', () => {
  it('finds F close to 1.00 for ACADS 1(a) by Bishop', () => {
    const result = searchCritical(homogeneous);
    expect(result.critical).not.toBeNull();
    expect(result.critical?.bishop.fos).toBeGreaterThan(0.97);
    expect(result.critical?.bishop.fos).toBeLessThan(1.0);
  });
});
