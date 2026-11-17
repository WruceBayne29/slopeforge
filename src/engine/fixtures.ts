/**
 * Small model builders shared by the tests, the validation suite and the examples.
 */
import type { Point, SlopeModel, Soil } from './types';

/** A soil with the given strength. */
export function soil(gamma: number, c: number, phi: number, extra: Partial<Soil> = {}): Soil {
  return { id: 'soil', name: 'Soil', pattern: 'clay', gamma, c, phi, ...extra };
}

/** A model of one soil with everything optional switched off. */
export function homogeneous(ground: Point[], base: number, material: Soil): SlopeModel {
  return {
    ground,
    soils: [material],
    boundaries: [],
    base,
    water: { kind: 'none' },
    gammaW: 9.81,
    surcharges: [],
    kh: 0,
    crack: null,
  };
}

/**
 * A simple slope of height `height` at `beta` degrees, rising to the right, with level ground
 * before the toe (x = 0, y = 0) and behind the crest. `depthFactor` × height is the depth of the
 * firm base below the crest.
 */
export function simpleSlope(
  height: number,
  beta: number,
  material: Soil,
  depthFactor = 2,
  run = 4,
): SlopeModel {
  const w = height / Math.tan((beta * Math.PI) / 180);
  return homogeneous(
    [
      { x: -run * height, y: 0 },
      { x: 0, y: 0 },
      { x: w, y: height },
      { x: w + run * height, y: height },
    ],
    height - depthFactor * height - (depthFactor <= 1 ? 1e-6 * height : 0),
    material,
  );
}

/** The model mirrored left to right about x = 0, so the slope faces the other way. */
export function mirrored(model: SlopeModel): SlopeModel {
  const flip = (line: Point[]): Point[] => line.map((p) => ({ x: -p.x, y: p.y })).reverse();
  return {
    ...model,
    ground: flip(model.ground),
    boundaries: model.boundaries.map(flip),
    water:
      model.water.kind === 'line'
        ? { kind: 'line', points: flip(model.water.points) }
        : model.water,
    surcharges: model.surcharges.map((s) => ({ x1: -s.x2, x2: -s.x1, q: s.q })),
  };
}
