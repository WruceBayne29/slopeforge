/**
 * Search for the critical slip circle: a grid of trial centres, a scan over radius at each
 * centre, then a pattern search that polishes the best centres found on the grid.
 */
import { analyseCircle } from './analyse';
import { distanceToPolyline, yAt } from './geometry';
import { prepare } from './strata';
import type { PreparedModel } from './strata';
import type { AnalysisOptions, Circle, CircleAnalysis, CircleSuccess, SlopeModel } from './types';

export interface SearchBox {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export interface SearchOptions extends AnalysisOptions {
  /** Which factor of safety is minimised. */
  method?: 'fellenius' | 'bishop';
  /** Rectangle of trial centres. Chosen from the geometry when omitted. */
  box?: SearchBox | null;
  /** Number of trial centres across and up. */
  nx?: number;
  ny?: number;
  /** Radii tried at each centre before the radius is refined. */
  nr?: number;
  /** Polish the grid minimum by pattern search (default true). */
  refine?: boolean;
}

export interface SearchResult {
  method: 'fellenius' | 'bishop';
  box: SearchBox;
  xs: number[];
  ys: number[];
  /** `fos[j][i]` is the lowest factor found for the centre (xs[i], ys[j]); null if none is valid. */
  fos: (number | null)[][];
  /** Radius that gave `fos[j][i]`. */
  radius: (number | null)[][];
  /** The critical circle, fully analysed; null if no trial circle was valid. */
  critical: CircleSuccess | null;
  /** Lowest factor on the grid itself, before refinement. */
  gridMinimum: number | null;
  /** Number of circles analysed. */
  evaluated: number;
  /** Why there is no critical circle. */
  message?: string;
}

export const DEFAULT_GRID = 16;
export const DEFAULT_RADII = 12;

/** Factor of safety by the chosen method, or null when the circle or the method failed. */
export function fosOf(a: CircleAnalysis, method: 'fellenius' | 'bishop'): number | null {
  if (!a.ok) return null;
  return method === 'bishop' ? a.bishop.fos : a.fellenius.fos;
}

/** A sensible rectangle of trial centres above the slope. */
export function autoSearchBox(pm: PreparedModel): SearchBox {
  const length = pm.xmax - pm.xmin;
  const height = Math.max(pm.high - pm.low, 0.02 * length);
  return {
    x1: pm.xmin + 0.05 * length,
    x2: pm.xmax - 0.05 * length,
    y1: pm.high + 0.1 * height,
    y2: pm.high + Math.max(3 * height, 0.75 * length),
  };
}

const GOLD = 0.5 * (Math.sqrt(5) - 1);

interface Trial {
  r: number;
  fos: number;
}

class Searcher {
  readonly pm: PreparedModel;
  readonly method: 'fellenius' | 'bishop';
  readonly options: AnalysisOptions;
  readonly nr: number;
  evaluated = 0;

  constructor(
    pm: PreparedModel,
    method: 'fellenius' | 'bishop',
    options: AnalysisOptions,
    nr: number,
  ) {
    this.pm = pm;
    this.method = method;
    this.options = options;
    this.nr = nr;
  }

  value(xc: number, yc: number, r: number): number {
    this.evaluated++;
    return fosOf(analyseCircle(this.pm, { xc, yc, r }, this.options), this.method) ?? Infinity;
  }

  /** Lowest factor over radius for one centre. */
  bestRadius(xc: number, yc: number): Trial | null {
    const { pm } = this;
    if (xc < pm.xmin || xc > pm.xmax ? false : yc <= yAt(pm.ground, xc)) return null;
    const rMin = distanceToPolyline({ x: xc, y: yc }, pm.ground);
    const first = pm.ground[0];
    const last = pm.ground[pm.ground.length - 1];
    const rMax = Math.min(
      yc - pm.model.base,
      Math.max(Math.hypot(xc - first.x, yc - first.y), Math.hypot(xc - last.x, yc - last.y)),
    );
    const skin = Math.max(this.options.minDepth ?? 0, 1e-3 * (rMax - rMin));
    if (!(rMax > rMin + skin)) return null;
    const n = this.nr;
    const rs: number[] = [];
    const fs: number[] = [];
    let best = -1;
    for (let k = 0; k < n; k++) {
      const r = rMin + skin + ((rMax - rMin - skin) * k) / (n - 1);
      const f = this.value(xc, yc, r);
      rs.push(r);
      fs.push(f);
      if (f < (best < 0 ? Infinity : fs[best])) best = k;
    }
    if (best < 0) return null;
    // Golden-section refinement between the neighbours of the best sample.
    let a = rs[Math.max(0, best - 1)];
    let b = rs[Math.min(n - 1, best + 1)];
    let top: Trial = { r: rs[best], fos: fs[best] };
    let c = b - GOLD * (b - a);
    let d = a + GOLD * (b - a);
    let fc = this.value(xc, yc, c);
    let fd = this.value(xc, yc, d);
    for (let it = 0; it < 14 && b - a > 1e-4 * rMax; it++) {
      if (fc < top.fos) top = { r: c, fos: fc };
      if (fd < top.fos) top = { r: d, fos: fd };
      if (fc <= fd) {
        b = d;
        d = c;
        fd = fc;
        c = b - GOLD * (b - a);
        fc = this.value(xc, yc, c);
      } else {
        a = c;
        c = d;
        fc = fd;
        d = a + GOLD * (b - a);
        fd = this.value(xc, yc, d);
      }
    }
    if (fc < top.fos) top = { r: c, fos: fc };
    if (fd < top.fos) top = { r: d, fos: fd };
    return top;
  }

  /** Compass search over the centre, with the radius re-optimised at every trial. */
  polish(
    start: { xc: number; yc: number; trial: Trial },
    stepX: number,
    stepY: number,
  ): { xc: number; yc: number; trial: Trial } {
    let here = start;
    let sx = stepX;
    let sy = stepY;
    const stop = 2e-3 * Math.max(1, Math.min(stepX, stepY));
    for (let it = 0; it < 60 && Math.max(sx, sy) > stop; it++) {
      let moved = false;
      for (const [dx, dy] of [
        [sx, 0],
        [-sx, 0],
        [0, sy],
        [0, -sy],
      ]) {
        const xc = here.xc + dx;
        const yc = here.yc + dy;
        const trial = this.bestRadius(xc, yc);
        if (trial && trial.fos < here.trial.fos - 1e-9) {
          here = { xc, yc, trial };
          moved = true;
        }
      }
      if (!moved) {
        sx *= 0.5;
        sy *= 0.5;
      }
    }
    return here;
  }
}

const linspace = (a: number, b: number, n: number): number[] =>
  Array.from({ length: n }, (_, i) => (n === 1 ? 0.5 * (a + b) : a + ((b - a) * i) / (n - 1)));

/** Finds the circle with the lowest factor of safety. */
export function searchCritical(
  source: SlopeModel | PreparedModel,
  options: SearchOptions = {},
): SearchResult {
  const pm = 'breaks' in source ? source : prepare(source);
  const method = options.method ?? 'bishop';
  const box = options.box ?? autoSearchBox(pm);
  const nx = Math.max(2, Math.round(options.nx ?? DEFAULT_GRID));
  const ny = Math.max(2, Math.round(options.ny ?? DEFAULT_GRID));
  const nr = Math.max(3, Math.round(options.nr ?? DEFAULT_RADII));
  const analysis: AnalysisOptions = { slices: options.slices, minDepth: options.minDepth };
  const searcher = new Searcher(pm, method, analysis, nr);
  const xs = linspace(Math.min(box.x1, box.x2), Math.max(box.x1, box.x2), nx);
  const ys = linspace(Math.min(box.y1, box.y2), Math.max(box.y1, box.y2), ny);

  const fos: (number | null)[][] = [];
  const radius: (number | null)[][] = [];
  for (let j = 0; j < ny; j++) {
    const fRow: (number | null)[] = [];
    const rRow: (number | null)[] = [];
    for (let i = 0; i < nx; i++) {
      const t = searcher.bestRadius(xs[i], ys[j]);
      fRow.push(t && Number.isFinite(t.fos) ? t.fos : null);
      rRow.push(t && Number.isFinite(t.fos) ? t.r : null);
    }
    fos.push(fRow);
    radius.push(rRow);
  }

  // Local minima of the grid, best first.
  const seeds: { i: number; j: number; f: number }[] = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const f = fos[j][i];
      if (f === null) continue;
      let lowest = true;
      for (let dj = -1; dj <= 1 && lowest; dj++) {
        for (let di = -1; di <= 1; di++) {
          const other = fos[j + dj]?.[i + di];
          if ((di !== 0 || dj !== 0) && other !== null && other !== undefined && other < f) {
            lowest = false;
            break;
          }
        }
      }
      if (lowest) seeds.push({ i, j, f });
    }
  }
  seeds.sort((p, q) => p.f - q.f);
  const result: SearchResult = {
    method,
    box,
    xs,
    ys,
    fos,
    radius,
    critical: null,
    gridMinimum: seeds.length > 0 ? seeds[0].f : null,
    evaluated: 0,
  };
  if (seeds.length === 0) {
    result.evaluated = searcher.evaluated;
    result.message =
      'No trial circle gave a valid slip surface. Check that the ground actually slopes and that the search box sits above it.';
    return result;
  }

  const stepX = nx > 1 ? xs[1] - xs[0] : 1;
  const stepY = ny > 1 ? ys[1] - ys[0] : 1;
  let best: Circle & { fos: number } = {
    xc: xs[seeds[0].i],
    yc: ys[seeds[0].j],
    r: radius[seeds[0].j][seeds[0].i] as number,
    fos: seeds[0].f,
  };
  if (options.refine !== false) {
    for (const seed of seeds.slice(0, 3)) {
      const start = {
        xc: xs[seed.i],
        yc: ys[seed.j],
        trial: { r: radius[seed.j][seed.i] as number, fos: seed.f },
      };
      const done = searcher.polish(start, 0.5 * stepX, 0.5 * stepY);
      if (done.trial.fos < best.fos) {
        best = { xc: done.xc, yc: done.yc, r: done.trial.r, fos: done.trial.fos };
      }
    }
  }
  const detail = analyseCircle(pm, { xc: best.xc, yc: best.yc, r: best.r }, analysis);
  result.critical = detail.ok ? detail : null;
  result.evaluated = searcher.evaluated + 1;
  return result;
}
