/**
 * Geometry helpers: polylines as single-valued functions of x, and the lower arc of a circle.
 */
import type { Circle, Point } from './types';

/** Elevation of a polyline at x. Beyond its ends the polyline continues horizontally. */
export function yAt(poly: readonly Point[], x: number): number {
  const n = poly.length;
  if (x <= poly[0].x) return poly[0].y;
  if (x >= poly[n - 1].x) return poly[n - 1].y;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (poly[mid].x <= x) lo = mid;
    else hi = mid;
  }
  const a = poly[lo];
  const b = poly[hi];
  return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
}

/** Sorted copy without values closer together than `tol`. */
export function uniqueSorted(values: readonly number[], tol: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) {
    if (out.length === 0 || v - out[out.length - 1] > tol) out.push(v);
  }
  return out;
}

/** The polyline restricted (or extended horizontally) to exactly [xmin, xmax]. */
export function span(poly: readonly Point[], xmin: number, xmax: number): Point[] {
  const inner = poly.filter((p) => p.x > xmin && p.x < xmax);
  return [{ x: xmin, y: yAt(poly, xmin) }, ...inner, { x: xmax, y: yAt(poly, xmax) }];
}

/** Chainages at which two polylines covering the same range cross each other. */
export function crossings(a: readonly Point[], b: readonly Point[]): number[] {
  const xs = uniqueSorted([...a.map((p) => p.x), ...b.map((p) => p.x)], 0);
  const out: number[] = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    const d1 = yAt(a, xs[i]) - yAt(b, xs[i]);
    const d2 = yAt(a, xs[i + 1]) - yAt(b, xs[i + 1]);
    if (d1 * d2 < 0) out.push(xs[i] + ((xs[i + 1] - xs[i]) * d1) / (d1 - d2));
  }
  return out;
}

/** Removes vertices that lie on the straight line between their neighbours. */
export function simplify(poly: readonly Point[], tol = 1e-9): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const prev = out[out.length - 1];
    const next = poly[i + 1];
    if (prev && next) {
      const t = (p.x - prev.x) / (next.x - prev.x);
      if (Math.abs(prev.y + t * (next.y - prev.y) - p.y) <= tol) continue;
    }
    out.push({ x: p.x, y: p.y });
  }
  return out;
}

/** Lower envelope min(a, b) of two polylines covering the same range. */
export function lowerEnvelope(a: readonly Point[], b: readonly Point[]): Point[] {
  const xs = uniqueSorted([...a.map((p) => p.x), ...b.map((p) => p.x), ...crossings(a, b)], 1e-12);
  return simplify(xs.map((x) => ({ x, y: Math.min(yAt(a, x), yAt(b, x)) })));
}

/** Elevation of the lower arc of a circle at x (|x − xc| ≤ r). */
export function arcY(c: Circle, x: number): number {
  const u = x - c.xc;
  return c.yc - Math.sqrt(Math.max(0, c.r * c.r - u * u));
}

/** Exact ∫ arcY dx from x1 to x2. */
export function arcIntegral(c: Circle, x1: number, x2: number): number {
  const prim = (x: number): number => {
    const u = Math.min(c.r, Math.max(-c.r, x - c.xc));
    return (
      c.yc * u -
      0.5 * (u * Math.sqrt(Math.max(0, c.r * c.r - u * u)) + c.r * c.r * Math.asin(u / c.r))
    );
  };
  return prim(x2) - prim(x1);
}

/** Chainages where the lower arc of the circle crosses a polyline (tangent touches excluded). */
export function arcCrossings(poly: readonly Point[], c: Circle): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < poly.length; i++) {
    const p = poly[i];
    const q = poly[i + 1];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const fx = p.x - c.xc;
    const fy = p.y - c.yc;
    const A = dx * dx + dy * dy;
    const B = 2 * (fx * dx + fy * dy);
    const C = fx * fx + fy * fy - c.r * c.r;
    const disc = B * B - 4 * A * C;
    if (A === 0 || disc <= 1e-14 * A * c.r * c.r) continue;
    const root = Math.sqrt(disc);
    for (const t of [(-B - root) / (2 * A), (-B + root) / (2 * A)]) {
      if (t < 0 || t > 1) continue;
      if (p.y + t * dy <= c.yc) out.push(p.x + t * dx);
    }
  }
  return out;
}

/** Shortest distance from a point to a polyline. */
export function distanceToPolyline(pt: Point, poly: readonly Point[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < poly.length; i++) {
    const p = poly[i];
    const q = poly[i + 1];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len2 = dx * dx + dy * dy;
    const t =
      len2 === 0 ? 0 : Math.max(0, Math.min(1, ((pt.x - p.x) * dx + (pt.y - p.y) * dy) / len2));
    best = Math.min(best, Math.hypot(pt.x - (p.x + t * dx), pt.y - (p.y + t * dy)));
  }
  return best;
}
