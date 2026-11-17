/**
 * Worked examples offered in the interface. Each is a complete project.
 */
import type { SlopeModel } from '../engine';
import { ACADS_1A, ACADS_1C, ACADS_1D } from './benchmarks';
import { cloneModel, DEFAULT_SETTINGS } from './project';
import type { Project } from './project';

export interface Example {
  id: string;
  name: string;
  /** One line on what the example shows. */
  about: string;
  project: Project;
}

const plain = {
  water: { kind: 'none' as const },
  gammaW: 9.81,
  surcharges: [],
  kh: 0,
  crack: null,
};

const HILLSIDE: SlopeModel = {
  ...plain,
  ground: [
    { x: 0, y: 20 },
    { x: 12, y: 20 },
    { x: 36, y: 32 },
    { x: 60, y: 32 },
  ],
  soils: [
    {
      id: 'residual',
      name: 'Residual silty sand',
      pattern: 'sand',
      gamma: 18,
      gammaSat: 19.5,
      c: 6,
      phi: 31,
    },
    {
      id: 'clay',
      name: 'Stiff silty clay',
      pattern: 'clay',
      gamma: 19.5,
      gammaSat: 20,
      c: 14,
      phi: 24,
    },
    { id: 'rock', name: 'Weathered sandstone', pattern: 'rock', gamma: 22, c: 60, phi: 35 },
  ],
  boundaries: [
    [
      { x: 0, y: 17.5 },
      { x: 20, y: 19 },
      { x: 40, y: 26 },
      { x: 60, y: 27.5 },
    ],
    [
      { x: 0, y: 13 },
      { x: 30, y: 14 },
      { x: 60, y: 17 },
    ],
  ],
  base: 9,
  water: {
    kind: 'line',
    points: [
      { x: 0, y: 19 },
      { x: 12, y: 19.5 },
      { x: 34, y: 27 },
      { x: 60, y: 29.5 },
    ],
  },
};

const CUTTING: SlopeModel = {
  ...plain,
  ground: [
    { x: 0, y: 100 },
    { x: 15, y: 100 },
    { x: 27, y: 108 },
    { x: 50, y: 108 },
  ],
  soils: [{ id: 'clay', name: 'Stiff brown clay', pattern: 'clay', gamma: 19, c: 10, phi: 24 }],
  boundaries: [],
  base: 93,
};

const EMBANKMENT: SlopeModel = {
  ...plain,
  ground: [
    { x: 0, y: 50 },
    { x: 14, y: 50 },
    { x: 26, y: 56 },
    { x: 38, y: 56 },
    { x: 50, y: 50 },
    { x: 64, y: 50 },
  ],
  soils: [
    { id: 'fill', name: 'Compacted fill', pattern: 'fill', gamma: 20, c: 5, phi: 30 },
    { id: 'sand', name: 'Medium dense sand', pattern: 'sand', gamma: 18, c: 0, phi: 33 },
    { id: 'clay', name: 'Firm clay', pattern: 'clay', gamma: 19, c: 12, phi: 22 },
  ],
  boundaries: [
    [
      { x: 0, y: 50 },
      { x: 64, y: 50 },
    ],
    [
      { x: 0, y: 47.5 },
      { x: 64, y: 47 },
    ],
  ],
  base: 41,
  surcharges: [{ x1: 27, x2: 37, q: 12 }],
};

const SOFT_CLAY: SlopeModel = {
  ...plain,
  ground: [
    { x: 0, y: 10 },
    { x: 22, y: 10 },
    { x: 34, y: 16 },
    { x: 60, y: 16 },
  ],
  soils: [
    { id: 'fill', name: 'Granular fill', pattern: 'gravel', gamma: 20, c: 0, phi: 35 },
    { id: 'soft', name: 'Soft grey clay (undrained)', pattern: 'clay', gamma: 16.5, c: 22, phi: 0 },
    { id: 'dense', name: 'Dense sand', pattern: 'sand', gamma: 20, c: 0, phi: 38 },
  ],
  boundaries: [
    [
      { x: 0, y: 10 },
      { x: 60, y: 10 },
    ],
    [
      { x: 0, y: 4 },
      { x: 60, y: 4 },
    ],
  ],
  base: 0,
};

const DRAWDOWN: SlopeModel = {
  ...plain,
  ground: [
    { x: 0, y: 2 },
    { x: 8, y: 2 },
    { x: 38, y: 17 },
    { x: 46, y: 17 },
    { x: 62, y: 9 },
  ],
  soils: [
    {
      id: 'shell',
      name: 'Clayey fill (dam shoulder)',
      pattern: 'fill',
      gamma: 19.5,
      gammaSat: 20.5,
      c: 12,
      phi: 27,
    },
    {
      id: 'found',
      name: 'Stiff foundation clay',
      pattern: 'clay',
      gamma: 20,
      gammaSat: 20.5,
      c: 25,
      phi: 26,
    },
  ],
  boundaries: [
    [
      { x: 0, y: 2 },
      { x: 62, y: 2 },
    ],
  ],
  base: -6,
  water: {
    kind: 'line',
    points: [
      { x: 0, y: 5 },
      { x: 14, y: 5 },
      { x: 34, y: 15 },
      { x: 46, y: 14 },
      { x: 62, y: 9 },
    ],
  },
};

const CRACKED: SlopeModel = {
  ...plain,
  ground: [
    { x: 0, y: 0 },
    { x: 12, y: 0 },
    { x: 20, y: 8 },
    { x: 44, y: 8 },
  ],
  soils: [
    { id: 'clay', name: 'Firm clay (undrained)', pattern: 'clay', gamma: 18.5, c: 34, phi: 0 },
  ],
  boundaries: [],
  base: -6,
  surcharges: [{ x1: 22, x2: 30, q: 20 }],
  crack: { depth: 2.5, water: 0.5 },
};

const make = (id: string, name: string, about: string, model: SlopeModel): Example => ({
  id,
  name,
  about,
  project: { version: 1, title: name, model: cloneModel(model), settings: { ...DEFAULT_SETTINGS } },
});

export const EXAMPLES: Example[] = [
  make(
    'hillside',
    'Hillside with a water table',
    'Three strata and a phreatic line; pore pressure lowers the factor of safety.',
    HILLSIDE,
  ),
  make(
    'cutting',
    'Homogeneous cutting',
    'An 8 m cutting at 1.5 : 1 in one stiff clay — the textbook case.',
    CUTTING,
  ),
  make(
    'embankment',
    'Layered embankment',
    'Road embankment with a traffic surcharge on fill, sand and clay.',
    EMBANKMENT,
  ),
  make(
    'soft-clay',
    'Embankment on soft clay',
    'A deep circle through an undrained soft clay, stopped by the dense sand below.',
    SOFT_CLAY,
  ),
  make(
    'drawdown',
    'Dam face after rapid drawdown',
    'The reservoir has dropped but the phreatic line inside the fill has not.',
    DRAWDOWN,
  ),
  make(
    'cracked',
    'Clay cutting with a tension crack',
    'φ = 0 analysis with a crest surcharge and a half-filled tension crack.',
    CRACKED,
  ),
  make(
    'acads-1a',
    'ACADS 1(a) benchmark',
    'Homogeneous benchmark slope; the published factor of safety is 1.00.',
    ACADS_1A,
  ),
  make(
    'acads-1c',
    'ACADS 1(c) benchmark',
    'Three-layer benchmark slope; the published factor of safety is 1.39.',
    ACADS_1C,
  ),
  make(
    'acads-1d',
    'ACADS 1(d) benchmark',
    'Problem 1(c) with a seismic coefficient of 0.15; published value 1.00.',
    ACADS_1D,
  ),
];

export function findExample(id: string): Example | undefined {
  return EXAMPLES.find((e) => e.id === id);
}

export function defaultProject(): Project {
  return JSON.parse(JSON.stringify(EXAMPLES[0].project)) as Project;
}
