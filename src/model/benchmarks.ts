/**
 * Published benchmark slopes, used by the validation suite and offered as examples.
 * ACADS: Donald, I.B. & Giam, P. (1989), "Soil slope stability programs review", ACADS
 * publication U255, Melbourne.
 */
import type { SlopeModel } from '../engine';

const ACADS_GROUND = [
  { x: 20, y: 25 },
  { x: 30, y: 25 },
  { x: 50, y: 35 },
  { x: 70, y: 35 },
];

/** ACADS 1(a): homogeneous 2 : 1 slope, 10 m high. Referee factor of safety 1.00. */
export const ACADS_1A: SlopeModel = {
  ground: ACADS_GROUND,
  soils: [{ id: 'soil', name: 'Silty clay', pattern: 'clay', gamma: 20, c: 3, phi: 19.6 }],
  boundaries: [],
  base: 20,
  water: { kind: 'none' },
  gammaW: 9.81,
  surcharges: [],
  kh: 0,
  crack: null,
};

/** ACADS 1(c): the same outline in three soils. Referee factor of safety 1.39. */
export const ACADS_1C: SlopeModel = {
  ground: ACADS_GROUND,
  soils: [
    { id: 'soil-1', name: 'Soil 1 — dense sand', pattern: 'sand', gamma: 19.5, c: 0, phi: 38 },
    { id: 'soil-2', name: 'Soil 2 — sandy clay', pattern: 'clay', gamma: 19.5, c: 5.3, phi: 23 },
    { id: 'soil-3', name: 'Soil 3 — clayey silt', pattern: 'silt', gamma: 19.5, c: 7.2, phi: 20 },
  ],
  boundaries: [
    [
      { x: 30, y: 25 },
      { x: 40, y: 27 },
      { x: 50, y: 29 },
      { x: 54, y: 31 },
      { x: 70, y: 31 },
    ],
    [
      { x: 30, y: 25 },
      { x: 40, y: 27 },
      { x: 52, y: 24 },
      { x: 70, y: 24 },
    ],
  ],
  base: 20,
  water: { kind: 'none' },
  gammaW: 9.81,
  surcharges: [],
  kh: 0,
  crack: null,
};

/** ACADS 1(d): problem 1(c) with a horizontal seismic coefficient of 0.15. Referee value 1.00. */
export const ACADS_1D: SlopeModel = { ...ACADS_1C, kh: 0.15 };
