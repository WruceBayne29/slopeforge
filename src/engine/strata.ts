/**
 * Prepares a model for analysis: checks it, clips the layer boundaries to the ground surface and
 * collects the chainages at which any line changes direction or crosses another.
 */
import { crossings, lowerEnvelope, span, uniqueSorted, yAt } from './geometry';
import type { Point, SlopeModel, Soil } from './types';

export interface PreparedModel {
  model: SlopeModel;
  xmin: number;
  xmax: number;
  ground: Point[];
  /** Layer boundaries clipped so that ground ≥ boundary 0 ≥ boundary 1 ≥ … */
  boundaries: Point[][];
  /** Phreatic line over [xmin, xmax], or null. */
  water: Point[] | null;
  soils: Soil[];
  /** Tangent of each soil's friction angle. */
  tanPhi: number[];
  /** Chainages where a slice boundary must fall whatever the circle. */
  breaks: number[];
  /** Lowest and highest ground elevation. */
  low: number;
  high: number;
}

function increasing(poly: readonly Point[]): boolean {
  for (let i = 0; i + 1 < poly.length; i++) if (!(poly[i + 1].x > poly[i].x)) return false;
  return true;
}

const finite = (poly: readonly Point[]): boolean =>
  poly.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

/** Reasons the model cannot be analysed, in plain words. Empty when the model is sound. */
export function checkModel(model: SlopeModel): string[] {
  const problems: string[] = [];
  const g = model.ground;
  if (g.length < 2) problems.push('The ground surface needs at least two points.');
  else if (!finite(g)) problems.push('The ground surface has a point that is not a number.');
  else if (!increasing(g)) {
    problems.push('Ground points must run left to right with increasing chainage (no overhangs).');
  }
  if (model.soils.length === 0) problems.push('Add at least one soil.');
  if (model.boundaries.length !== Math.max(0, model.soils.length - 1)) {
    problems.push('There must be one layer boundary between each pair of soils.');
  }
  model.boundaries.forEach((b, i) => {
    if (b.length < 1 || !finite(b)) problems.push(`Layer boundary ${i + 1} has no valid points.`);
    else if (!increasing(b)) {
      problems.push(`Layer boundary ${i + 1} must run left to right with increasing chainage.`);
    }
  });
  model.soils.forEach((s) => {
    const name = s.name || 'A soil';
    if (!(s.gamma > 0) || !Number.isFinite(s.gamma)) {
      problems.push(`${name}: unit weight must be greater than zero.`);
    }
    if (s.gammaSat !== undefined && !(s.gammaSat > 0)) {
      problems.push(`${name}: saturated unit weight must be greater than zero.`);
    }
    if (!(s.c >= 0) || !Number.isFinite(s.c))
      problems.push(`${name}: cohesion cannot be negative.`);
    if (!(s.phi >= 0 && s.phi < 90)) {
      problems.push(`${name}: friction angle must be between 0° and 90°.`);
    }
  });
  if (g.length >= 2 && finite(g) && increasing(g)) {
    const low = Math.min(...g.map((p) => p.y));
    if (!Number.isFinite(model.base)) problems.push('The base elevation is not a number.');
    else if (!(model.base < low)) {
      problems.push('The firm base must lie below the lowest point of the ground surface.');
    }
  }
  if (model.water.kind === 'line') {
    const w = model.water.points;
    if (w.length < 1 || !finite(w)) problems.push('The water table has no valid points.');
    else if (!increasing(w)) {
      problems.push('Water table points must run left to right with increasing chainage.');
    }
  }
  if (model.water.kind === 'ru' && !(model.water.ru >= 0 && model.water.ru < 1)) {
    problems.push('The pore pressure ratio ru must be between 0 and 1.');
  }
  if (!(model.gammaW > 0)) problems.push('The unit weight of water must be greater than zero.');
  if (!(model.kh >= 0 && model.kh < 1)) {
    problems.push('The seismic coefficient must be between 0 and 1.');
  }
  model.surcharges.forEach((s, i) => {
    if (!(s.x2 > s.x1))
      problems.push(`Surcharge ${i + 1}: the end must be to the right of the start.`);
    if (!(s.q >= 0) || !Number.isFinite(s.q)) {
      problems.push(`Surcharge ${i + 1}: the load cannot be negative.`);
    }
  });
  if (model.crack) {
    if (!(model.crack.depth > 0))
      problems.push('The tension crack depth must be greater than zero.');
    if (!(model.crack.water >= 0 && model.crack.water <= 1)) {
      problems.push('The water level in the tension crack must be between 0 and 1.');
    }
  }
  return problems;
}

export class ModelError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(problems.join(' '));
    this.name = 'ModelError';
    this.problems = problems;
  }
}

/** Builds the analysis view of a model. Throws `ModelError` if `checkModel` finds problems. */
export function prepare(model: SlopeModel): PreparedModel {
  const problems = checkModel(model);
  if (problems.length > 0) throw new ModelError(problems);
  const ground = model.ground.map((p) => ({ x: p.x, y: p.y }));
  const xmin = ground[0].x;
  const xmax = ground[ground.length - 1].x;

  const boundaries: Point[][] = [];
  let above = ground;
  for (const raw of model.boundaries) {
    const clipped = lowerEnvelope(span(raw, xmin, xmax), above);
    boundaries.push(clipped);
    above = clipped;
  }
  const water = model.water.kind === 'line' ? span(model.water.points, xmin, xmax) : null;

  const lines = [ground, ...boundaries, ...(water ? [water] : [])];
  const xs: number[] = [];
  for (const line of lines) for (const p of line) xs.push(p.x);
  if (water) for (const line of [ground, ...boundaries]) xs.push(...crossings(water, line));
  for (const s of model.surcharges) xs.push(s.x1, s.x2);
  const breaks = uniqueSorted(
    xs.filter((x) => x > xmin && x < xmax),
    1e-9 * Math.max(1, xmax - xmin),
  );
  const ys = ground.map((p) => p.y);
  return {
    model,
    xmin,
    xmax,
    ground,
    boundaries,
    water,
    soils: model.soils,
    tanPhi: model.soils.map((s) => Math.tan((s.phi * Math.PI) / 180)),
    breaks,
    low: Math.min(...ys),
    high: Math.max(...ys),
  };
}

/** Index of the soil at a point (the point is assumed to be below the ground surface). */
export function soilAt(pm: PreparedModel, x: number, y: number): number {
  for (let i = 0; i < pm.boundaries.length; i++) {
    if (y >= yAt(pm.boundaries[i], x)) return i;
  }
  return pm.soils.length - 1;
}

/**
 * Outline of each stratum as a closed polygon (top edge left to right, bottom edge back), for
 * drawing. Strata with no thickness anywhere still return a degenerate polygon.
 */
export function strataPolygons(pm: PreparedModel): Point[][] {
  const tops = [pm.ground, ...pm.boundaries];
  const floor: Point[] = [
    { x: pm.xmin, y: pm.model.base },
    { x: pm.xmax, y: pm.model.base },
  ];
  return pm.soils.map((_, i) => {
    const top = tops[i].map((p) => ({ x: p.x, y: Math.max(p.y, pm.model.base) }));
    const bottom = (tops[i + 1] ?? floor).map((p) => ({ x: p.x, y: Math.max(p.y, pm.model.base) }));
    return [...top, ...bottom.reverse()];
  });
}
