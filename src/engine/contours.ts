/**
 * Contour lines of a value sampled on a rectangular grid (marching squares). Used for the map
 * of factor of safety over the trial centres.
 */
import type { Point } from './types';

export interface ContourLine {
  level: number;
  /** Polylines along which the value equals `level`. */
  paths: Point[][];
}

const STEPS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10];

/** Round contour levels a little above the minimum, where the map is worth reading. */
export function contourLevels(min: number, max: number, count = 6): number[] {
  if (!(max > min) || !Number.isFinite(min) || !Number.isFinite(max)) return [];
  const top = Math.min(max, 1.35 * min + 0.1);
  const raw = (top - min) / count;
  const step = STEPS.find((s) => s >= raw) ?? STEPS[STEPS.length - 1];
  const levels: number[] = [];
  for (
    let v = Math.ceil(min / step + 1e-9) * step;
    v <= top + 1e-9 && levels.length < 12;
    v += step
  ) {
    levels.push(Math.round(v / step) * step);
  }
  return levels;
}

function join(segments: [Point, Point][]): Point[][] {
  const key = (p: Point): string => `${p.x.toFixed(6)},${p.y.toFixed(6)}`;
  const ends = new Map<string, number[]>();
  segments.forEach((s, i) => {
    for (const p of s) {
      const k = key(p);
      const list = ends.get(k);
      if (list) list.push(i);
      else ends.set(k, [i]);
    }
  });
  const used = new Array<boolean>(segments.length).fill(false);
  const paths: Point[][] = [];
  const extend = (path: Point[]): void => {
    for (;;) {
      const tail = path[path.length - 1];
      const next = (ends.get(key(tail)) ?? []).find((i) => !used[i]);
      if (next === undefined) return;
      used[next] = true;
      const [a, b] = segments[next];
      path.push(key(a) === key(tail) ? b : a);
    }
  };
  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const path = [segments[i][0], segments[i][1]];
    extend(path);
    path.reverse();
    extend(path);
    paths.push(path);
  }
  return paths;
}

/**
 * Contours of `values[j][i]` at (xs[i], ys[j]). Cells with a missing corner are skipped.
 */
export function contours(
  xs: readonly number[],
  ys: readonly number[],
  values: readonly (readonly (number | null)[])[],
  levels: readonly number[],
): ContourLine[] {
  return levels.map((level) => {
    const segments: [Point, Point][] = [];
    for (let j = 0; j + 1 < ys.length; j++) {
      for (let i = 0; i + 1 < xs.length; i++) {
        const v00 = values[j][i];
        const v10 = values[j][i + 1];
        const v11 = values[j + 1][i + 1];
        const v01 = values[j + 1][i];
        if (v00 === null || v10 === null || v11 === null || v01 === null) continue;
        const corners = [
          { x: xs[i], y: ys[j], v: v00 },
          { x: xs[i + 1], y: ys[j], v: v10 },
          { x: xs[i + 1], y: ys[j + 1], v: v11 },
          { x: xs[i], y: ys[j + 1], v: v01 },
        ];
        // crossing points on the four edges, in order: bottom, right, top, left
        const cuts: (Point | null)[] = corners.map((a, k) => {
          const b = corners[(k + 1) % 4];
          if (a.v > level === b.v > level) return null;
          const t = (level - a.v) / (b.v - a.v);
          return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
        });
        const hit = cuts.filter((c): c is Point => c !== null);
        if (hit.length === 2) segments.push([hit[0], hit[1]]);
        else if (hit.length === 4) {
          // saddle: pair the crossings according to the value at the centre of the cell
          const centre = (v00 + v10 + v11 + v01) / 4 > level;
          const [bottom, right, top, left] = hit;
          if (centre === v00 > level) {
            segments.push([bottom, right], [top, left]);
          } else {
            segments.push([bottom, left], [right, top]);
          }
        }
      }
    }
    return { level, paths: join(segments) };
  });
}
