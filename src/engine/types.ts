/**
 * Model and result types of the slope stability engine.
 * Units: metres, kN, kPa, kN/m³, degrees. Plane strain: forces are per metre run of slope.
 */
export interface Point {
  x: number;
  y: number;
}

export interface Circle {
  xc: number;
  yc: number;
  r: number;
}

/** Hatch pattern used to draw a stratum; has no effect on the analysis. */
export type Pattern = 'sand' | 'clay' | 'silt' | 'gravel' | 'fill' | 'rock' | 'peat';

export interface Soil {
  id: string;
  name: string;
  pattern: Pattern;
  /** Bulk unit weight, kN/m³. */
  gamma: number;
  /** Saturated unit weight used below the phreatic line, kN/m³. Defaults to `gamma`. */
  gammaSat?: number;
  /** Effective cohesion c′, kPa. */
  c: number;
  /** Effective friction angle φ′, degrees. */
  phi: number;
}

export type Water =
  | { kind: 'none' }
  /** Phreatic line: pore pressure = γw × vertical depth below the line. */
  | { kind: 'line'; points: Point[] }
  /** Pore pressure ratio: u = ru × (weight of the slice / its width). */
  | { kind: 'ru'; ru: number };

/** Uniform vertical load on the ground surface between two chainages, kPa. */
export interface Surcharge {
  x1: number;
  x2: number;
  q: number;
}

export interface TensionCrack {
  /** Depth of the crack below the ground surface, m. */
  depth: number;
  /** Fraction of the crack depth filled with water, 0 to 1. */
  water: number;
}

export interface SlopeModel {
  /** Ground surface, left to right, x strictly increasing. */
  ground: Point[];
  /** Strata from the top down. */
  soils: Soil[];
  /**
   * `boundaries[i]` separates `soils[i]` (above) from `soils[i + 1]` (below). Each is a polyline
   * with x strictly increasing; it is extended horizontally beyond its end points and clipped to
   * the ground surface and to the boundary above it.
   */
  boundaries: Point[][];
  /** Elevation of the firm base. No slip surface may pass below it. */
  base: number;
  water: Water;
  /** Unit weight of water, kN/m³. */
  gammaW: number;
  surcharges: Surcharge[];
  /** Horizontal seismic coefficient (fraction of soil weight acting towards the toe). */
  kh: number;
  crack: TensionCrack | null;
}

export type Method = 'fellenius' | 'bishop' | 'janbu' | 'spencer';

export interface AnalysisOptions {
  /** Target number of slices (the count can be higher: slices never straddle a vertex). */
  slices?: number;
  /** Circles whose greatest depth is below this are rejected, m. */
  minDepth?: number;
}

export interface LayerPart {
  soil: number;
  /** Area of this stratum inside the slice, m². */
  area: number;
  /** Part of that area below the phreatic line, m². */
  wetArea: number;
  weight: number;
}

export interface Slice {
  index: number;
  x1: number;
  x2: number;
  /** Mid-width chainage. */
  xm: number;
  /** Width b, m. */
  b: number;
  /** Ground elevation at mid-width. */
  yTop: number;
  /** Slip surface elevation at mid-width. */
  yBase: number;
  /** Mean height (area / width), m. */
  h: number;
  /** Base inclination α, radians. Positive where the base dips towards the toe. */
  alpha: number;
  /** Base length l = b sec α, m. */
  l: number;
  layers: LayerPart[];
  /** Index of the soil the base lies in. */
  soil: number;
  c: number;
  phi: number;
  /** Soil weight W, kN/m. */
  weight: number;
  /** Surcharge on the top of the slice, kN/m. */
  surcharge: number;
  /** Weight of ponded water standing on the slice, kN/m. */
  pond: number;
  /** Total vertical load W + surcharge + pond, kN/m. */
  load: number;
  /** Horizontal force towards the toe (seismic less water thrust on the face), kN/m. */
  hForce: number;
  /** Pore pressure at the middle of the base, kPa. */
  u: number;
  /** Driving term: load × sin α plus the horizontal forces' moment divided by R, kN/m. */
  driving: number;
  /** Ordinary method: effective normal force on the base, kN/m. */
  nFellenius: number;
  /** Ordinary method: shear strength available on the base, kN/m. */
  tFellenius: number;
  /** Bishop: mα at the converged factor of safety. */
  mAlpha: number;
  nBishop: number;
  tBishop: number;
}

export type FailureCode =
  | 'bad-circle'
  | 'no-intersection'
  | 'outside-model'
  | 'vertical'
  | 'below-base'
  | 'too-shallow'
  | 'crack'
  | 'no-driving';

export interface CircleFailure {
  ok: false;
  code: FailureCode;
  message: string;
}

export interface MethodResult {
  /** Factor of safety, or null when the method could not produce one. */
  fos: number | null;
  /** Σ shear strength × R, kN·m/m. */
  resistingMoment: number;
  /** Successive values of F (iterative methods). */
  iterations: number[];
  converged: boolean;
  /** Why `fos` is null, or a caution about the value. */
  note?: string;
}

export interface CircleSuccess {
  ok: true;
  circle: Circle;
  /** Lower end of the slip surface on the ground. */
  toe: Point;
  /** Upper end of the slip surface (bottom of the tension crack if there is one). */
  crest: Point;
  /** +1 if the mass slides towards −x (crest on the right), −1 otherwise. */
  dir: 1 | -1;
  slices: Slice[];
  /** Σ driving terms × R, kN·m/m. */
  drivingMoment: number;
  /** Area of the sliding mass, m². */
  area: number;
  weight: number;
  maxDepth: number;
  /** Water thrust in the tension crack, kN/m. */
  crackThrust: number;
  /** Depth of the tension crack actually applied, m. */
  crackDepth: number;
  fellenius: MethodResult;
  bishop: MethodResult;
  warnings: string[];
}

export type CircleAnalysis = CircleSuccess | CircleFailure;
