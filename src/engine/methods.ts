/**
 * Limit-equilibrium methods for a circular slip surface divided into vertical slices.
 *
 * Both methods take moments about the centre of the circle:
 *
 *   F = Σ (shear strength on each base) / Σ (driving term)
 *
 * and differ only in how the normal force on a slice base is found.
 */
import type { MethodResult, Slice } from './types';

/** What a method needs to know about a slice. */
export interface SliceInput {
  b: number;
  alpha: number;
  l: number;
  /** Total vertical load on the slice, kN/m. */
  load: number;
  /** Horizontal force towards the toe, kN/m. */
  hForce: number;
  u: number;
  c: number;
  tanPhi: number;
}

export interface FelleniusSlice {
  n: number;
  t: number;
}

/**
 * Ordinary method of slices (Fellenius, 1936): inter-slice forces are ignored, so the normal
 * force follows from resolving the slice's loads perpendicular to its base.
 *   N′ = W cos α − H sin α − u l
 */
export function felleniusSlice(s: SliceInput): FelleniusSlice {
  const n = s.load * Math.cos(s.alpha) - s.hForce * Math.sin(s.alpha) - s.u * s.l;
  return { n, t: s.c * s.l + Math.max(0, n) * s.tanPhi };
}

export interface BishopSlice {
  mAlpha: number;
  n: number;
  t: number;
}

/**
 * Bishop's simplified method (1955): inter-slice shear is ignored, and each slice is resolved
 * vertically, which makes N′ depend on F:
 *   N′ = (W − u b − c′ b tan α / F) / mα,   mα = cos α + sin α tan φ′ / F
 */
export function bishopSlice(s: SliceInput, f: number): BishopSlice {
  const sin = Math.sin(s.alpha);
  const mAlpha = Math.cos(s.alpha) + (sin * s.tanPhi) / f;
  const safe = Math.max(mAlpha, 1e-6);
  const n = (s.load - s.u * s.b - (s.c * s.l * sin) / f) / safe;
  return { mAlpha, n, t: s.c * s.l + Math.max(0, n) * s.tanPhi };
}

export const BISHOP_TOLERANCE = 1e-6;
export const BISHOP_MAX_ITERATIONS = 100;

/**
 * Solves Bishop's equation by fixed-point iteration, starting from `start` (normally the
 * ordinary-method factor). `driving` is Σ of the driving terms.
 */
export function solveBishop(
  slices: readonly SliceInput[],
  driving: number,
  start: number,
): { fos: number | null; iterations: number[]; converged: boolean; note?: string } {
  const strength = slices.some((s) => s.c > 0 || s.tanPhi > 0);
  if (!strength) return { fos: 0, iterations: [0], converged: true };
  let f = start > 0.05 && Number.isFinite(start) ? start : 1;
  const iterations = [f];
  for (let k = 0; k < BISHOP_MAX_ITERATIONS; k++) {
    let sum = 0;
    for (const s of slices) sum += bishopSlice(s, f).t;
    const next = sum / driving;
    if (!Number.isFinite(next) || next <= 0) {
      return {
        fos: null,
        iterations,
        converged: false,
        note: 'Bishop’s iteration broke down (no positive factor of safety).',
      };
    }
    iterations.push(next);
    const done = Math.abs(next - f) <= BISHOP_TOLERANCE * Math.max(1, next);
    f = next;
    if (done) {
      if (slices.some((s) => bishopSlice(s, f).mAlpha <= 0)) {
        return {
          fos: null,
          iterations,
          converged: false,
          note: 'Bishop’s method is not valid for this circle: mα ≤ 0 where the base rises steeply at the toe.',
        };
      }
      return { fos: f, iterations, converged: true };
    }
  }
  return {
    fos: null,
    iterations,
    converged: false,
    note: `Bishop’s iteration did not converge in ${BISHOP_MAX_ITERATIONS} steps.`,
  };
}

/** Picks the method result out of a slice for display. */
export function sliceInput(s: Slice, tanPhi: number): SliceInput {
  return {
    b: s.b,
    alpha: s.alpha,
    l: s.l,
    load: s.load,
    hForce: s.hForce,
    u: s.u,
    c: s.c,
    tanPhi,
  };
}

export function methodFos(result: MethodResult): number {
  return result.fos ?? Number.POSITIVE_INFINITY;
}
