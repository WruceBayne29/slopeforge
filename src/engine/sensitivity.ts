/**
 * How the minimum factor of safety responds to the strength parameters and to the water level.
 * Each point re-optimises the critical circle locally, so the curve follows the critical
 * surface as it moves rather than holding one circle fixed.
 */
import { fosOf, refineCircle } from './search';
import type { SearchOptions } from './search';
import type { Circle, SlopeModel } from './types';

export interface SensitivityPoint {
  /** Value of the varied quantity (a multiplier, a shift in metres, or ru). */
  value: number;
  fos: number | null;
}

export interface SensitivityCurve {
  parameter: 'cohesion' | 'friction' | 'water' | 'ru';
  label: string;
  /** What `value` means, for the axis. */
  axis: string;
  /** Value of the varied quantity in the model as it stands. */
  base: number;
  points: SensitivityPoint[];
}

const FACTORS = [0.5, 0.625, 0.75, 0.875, 1, 1.125, 1.25, 1.375, 1.5];

const DEG = Math.PI / 180;

function point(
  model: SlopeModel,
  start: Circle,
  options: SearchOptions,
  value: number,
): SensitivityPoint {
  const found = refineCircle(model, start, options);
  return { value, fos: found ? fosOf(found, options.method ?? 'bishop') : null };
}

/** Sensitivity curves for the model, tracking the critical circle from `start`. */
export function sensitivity(
  model: SlopeModel,
  start: Circle,
  options: SearchOptions = {},
): SensitivityCurve[] {
  const curves: SensitivityCurve[] = [];
  if (model.soils.some((s) => s.c > 0)) {
    curves.push({
      parameter: 'cohesion',
      label: 'Cohesion c′',
      axis: 'c′ multiplied by',
      base: 1,
      points: FACTORS.map((k) =>
        point(
          { ...model, soils: model.soils.map((s) => ({ ...s, c: s.c * k })) },
          start,
          options,
          k,
        ),
      ),
    });
  }
  if (model.soils.some((s) => s.phi > 0)) {
    curves.push({
      parameter: 'friction',
      label: 'Friction tan φ′',
      axis: 'tan φ′ multiplied by',
      base: 1,
      points: FACTORS.map((k) =>
        point(
          {
            ...model,
            soils: model.soils.map((s) => ({
              ...s,
              phi: Math.atan(k * Math.tan(s.phi * DEG)) / DEG,
            })),
          },
          start,
          options,
          k,
        ),
      ),
    });
  }
  const water = model.water;
  if (water.kind === 'line') {
    const ys = model.ground.map((p) => p.y);
    const height = Math.max(...ys) - Math.min(...ys);
    const range = Math.max(0.5, Math.round(0.3 * height * 2) / 2);
    const shifts = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1].map((k) => k * range);
    curves.push({
      parameter: 'water',
      label: 'Water table level',
      axis: 'phreatic line raised by (m)',
      base: 0,
      points: shifts.map((dz) =>
        point(
          {
            ...model,
            water: { kind: 'line', points: water.points.map((p) => ({ x: p.x, y: p.y + dz })) },
          },
          start,
          options,
          dz,
        ),
      ),
    });
  } else if (water.kind === 'ru') {
    curves.push({
      parameter: 'ru',
      label: 'Pore pressure ratio ru',
      axis: 'ru',
      base: water.ru,
      points: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6].map((ru) =>
        point({ ...model, water: { kind: 'ru', ru } }, start, options, ru),
      ),
    });
  }
  return curves;
}
