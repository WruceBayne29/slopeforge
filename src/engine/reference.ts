/**
 * Closed-form results that do not use slices at all. The slice engine is checked against them.
 */
import { yAt } from './geometry';
import type { Circle, Point } from './types';

export interface PhiZeroExact {
  fos: number;
  /** cu × arc length × R, kN·m/m. */
  resistingMoment: number;
  /** γ × first moment of the sliding area about the centre, kN·m/m. */
  drivingMoment: number;
  area: number;
  arcLength: number;
}

/**
 * Exact φ = 0 analysis of a circle in one soil: F = cu R² θ / (γ ∫∫ (x − xc) dA), with the
 * integrals over the area between the ground polyline and the arc evaluated analytically.
 * `xa` and `xb` are the chainages where the arc meets the ground.
 */
export function phiZeroExact(
  ground: readonly Point[],
  gamma: number,
  cu: number,
  circle: Circle,
  xa: number,
  xb: number,
): PhiZeroExact {
  const { xc, yc, r } = circle;
  // ∫ arc du and ∫ u·arc du, with u = x − xc
  const arc0 = (u: number): number =>
    yc * u - 0.5 * (u * Math.sqrt(Math.max(0, r * r - u * u)) + r * r * Math.asin(u / r));
  const arc1 = (u: number): number => 0.5 * yc * u * u + Math.max(0, r * r - u * u) ** 1.5 / 3;
  let area = -(arc0(xb - xc) - arc0(xa - xc));
  let moment = -(arc1(xb - xc) - arc1(xa - xc));
  const xs = [xa, ...ground.map((p) => p.x).filter((x) => x > xa && x < xb), xb];
  for (let i = 0; i + 1 < xs.length; i++) {
    const x1 = xs[i];
    const x2 = xs[i + 1];
    const g1 = yAt(ground, x1);
    const m = (yAt(ground, x2) - g1) / (x2 - x1);
    // ground = k + m u on this piece
    const k = g1 + m * (xc - x1);
    const u1 = x1 - xc;
    const u2 = x2 - xc;
    area += k * (u2 - u1) + 0.5 * m * (u2 * u2 - u1 * u1);
    moment += 0.5 * k * (u2 * u2 - u1 * u1) + (m * (u2 ** 3 - u1 ** 3)) / 3;
  }
  const theta = Math.asin((xb - xc) / r) - Math.asin((xa - xc) / r);
  const resistingMoment = cu * r * theta * r;
  const drivingMoment = Math.abs(gamma * moment);
  return {
    fos: resistingMoment / drivingMoment,
    resistingMoment,
    drivingMoment,
    area,
    arcLength: r * theta,
  };
}

export interface InfiniteSlope {
  /** Slope angle β, degrees. */
  beta: number;
  /** Vertical depth of the slip plane, m. */
  z: number;
  gamma: number;
  c: number;
  /** Friction angle φ′, degrees. */
  phi: number;
  /** Pore pressure on the slip plane, kPa. */
  u?: number;
  /** Horizontal seismic coefficient. */
  kh?: number;
}

/**
 * Factor of safety of an infinite slope sliding on a plane parallel to the surface, resolving
 * normal and parallel to the plane:
 *   F = [c′ sec β + (γ z (cos β − kh sin β) − u sec β) tan φ′] / [γ z (sin β + kh cos β)]
 * With kh = 0 and u = 0 this is the familiar c′/(γ z sin β cos β) + tan φ′/tan β.
 */
export function infiniteSlopeFos(s: InfiniteSlope): number {
  const b = (s.beta * Math.PI) / 180;
  const kh = s.kh ?? 0;
  const u = s.u ?? 0;
  const tanPhi = Math.tan((s.phi * Math.PI) / 180);
  const resisting =
    s.c / Math.cos(b) +
    (s.gamma * s.z * (Math.cos(b) - kh * Math.sin(b)) - u / Math.cos(b)) * tanPhi;
  return resisting / (s.gamma * s.z * (Math.sin(b) + kh * Math.cos(b)));
}
