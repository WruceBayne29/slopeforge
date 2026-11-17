/**
 * Pure editing operations on a slope model. Each returns a new model and leaves its input alone.
 */
import { yAt } from '../engine';
import type { Pattern, Point, SlopeModel, Soil } from '../engine';
import { cloneModel } from './project';

export type LineRef = { kind: 'ground' } | { kind: 'boundary'; index: number } | { kind: 'water' };

export const sameLine = (a: LineRef, b: LineRef): boolean =>
  a.kind === b.kind && (a.kind !== 'boundary' || a.index === (b as { index: number }).index);

/** Smallest horizontal gap kept between neighbouring points, m. */
export const MIN_GAP = 0.05;

export function linePoints(model: SlopeModel, line: LineRef): Point[] {
  if (line.kind === 'ground') return model.ground;
  if (line.kind === 'boundary') return model.boundaries[line.index] ?? [];
  return model.water.kind === 'line' ? model.water.points : [];
}

function withLine(model: SlopeModel, line: LineRef, points: Point[]): SlopeModel {
  const next = cloneModel(model);
  if (line.kind === 'ground') next.ground = points;
  else if (line.kind === 'boundary') next.boundaries[line.index] = points;
  else next.water = { kind: 'line', points };
  return next;
}

export const snapTo = (value: number, snap: number): number =>
  snap > 0 ? Math.round(value / snap) * snap : value;

/** Moves one point, keeping chainages in order. */
export function movePoint(
  model: SlopeModel,
  line: LineRef,
  index: number,
  to: Point,
  snap = 0,
): SlopeModel {
  const points = linePoints(model, line).map((p) => ({ ...p }));
  if (!points[index]) return model;
  const lo = index > 0 ? points[index - 1].x + MIN_GAP : -Infinity;
  const hi = index < points.length - 1 ? points[index + 1].x - MIN_GAP : Infinity;
  points[index] = {
    x: Math.min(hi, Math.max(lo, snapTo(to.x, snap))),
    y: snapTo(to.y, snap),
  };
  return withLine(model, line, points);
}

/** Adds a point on a line at chainage x (on the line unless y is given). Returns the new index. */
export function insertPoint(
  model: SlopeModel,
  line: LineRef,
  x: number,
  y?: number,
): { model: SlopeModel; index: number } | null {
  const points = linePoints(model, line).map((p) => ({ ...p }));
  if (points.length === 0) return null;
  if (points.some((p) => Math.abs(p.x - x) < MIN_GAP)) return null;
  let index = points.findIndex((p) => p.x > x);
  if (index < 0) index = points.length;
  points.splice(index, 0, { x, y: y ?? yAt(points, x) });
  return { model: withLine(model, line, points), index };
}

/** Removes a point. The ground and each boundary keep at least two points; water keeps one. */
export function deletePoint(model: SlopeModel, line: LineRef, index: number): SlopeModel | null {
  const points = linePoints(model, line).map((p) => ({ ...p }));
  const least = line.kind === 'water' ? 1 : 2;
  if (!points[index] || points.length <= least) return null;
  points.splice(index, 1);
  return withLine(model, line, points);
}

const PATTERNS: Pattern[] = ['clay', 'sand', 'silt', 'gravel', 'fill', 'rock', 'peat'];

function freshId(model: SlopeModel): string {
  let n = model.soils.length + 1;
  while (model.soils.some((s) => s.id === `soil-${n}`)) n++;
  return `soil-${n}`;
}

/** Adds a stratum at the bottom, with a level boundary half-way down the last one. */
export function addSoil(model: SlopeModel): SlopeModel {
  const next = cloneModel(model);
  const xs = next.ground.map((p) => p.x);
  const x1 = Math.min(...xs);
  const x2 = Math.max(...xs);
  const low = Math.min(...next.ground.map((p) => p.y));
  const lastLine = next.boundaries[next.boundaries.length - 1];
  const top = lastLine ? Math.min(low, ...lastLine.map((p) => p.y)) : low;
  const level = Math.round(0.5 * (top + next.base) * 2) / 2;
  const used = new Set(next.soils.map((s) => s.pattern));
  const soil: Soil = {
    id: freshId(next),
    name: `Stratum ${next.soils.length + 1}`,
    pattern: PATTERNS.find((p) => !used.has(p)) ?? 'clay',
    gamma: 19,
    c: 10,
    phi: 25,
  };
  next.soils.push(soil);
  if (next.soils.length > 1) {
    next.boundaries.push([
      { x: x1, y: level },
      { x: x2, y: level },
    ]);
  }
  return next;
}

/** Removes a stratum and the boundary under it (or above it, for the last one). */
export function removeSoil(model: SlopeModel, index: number): SlopeModel | null {
  if (model.soils.length <= 1 || !model.soils[index]) return null;
  const next = cloneModel(model);
  next.soils.splice(index, 1);
  next.boundaries.splice(Math.min(index, next.boundaries.length - 1), 1);
  return next;
}

export function updateSoil(model: SlopeModel, index: number, patch: Partial<Soil>): SlopeModel {
  const next = cloneModel(model);
  if (next.soils[index]) next.soils[index] = { ...next.soils[index], ...patch };
  return next;
}

/** A first guess at a phreatic line: level with the toe in front, rising gently behind. */
export function defaultWaterLine(model: SlopeModel): Point[] {
  const g = model.ground;
  const low = Math.min(...g.map((p) => p.y));
  const high = Math.max(...g.map((p) => p.y));
  const first = g[0];
  const last = g[g.length - 1];
  const risesRight = last.y >= first.y;
  const lowLevel = low - 0.1 * (high - low);
  const highLevel = low + 0.55 * (high - low);
  return risesRight
    ? [
        { x: first.x, y: lowLevel },
        { x: last.x, y: highLevel },
      ]
    : [
        { x: first.x, y: highLevel },
        { x: last.x, y: lowLevel },
      ];
}
