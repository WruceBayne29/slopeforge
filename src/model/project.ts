/**
 * A project is what the user edits and saves: the slope model plus the analysis settings.
 */
import type { Circle, SearchBox, SlopeModel } from '../engine';

export interface Settings {
  /** Which factor of safety the search minimises. */
  method: 'bishop' | 'fellenius';
  /** Target number of slices. */
  slices: number;
  /** Trial centres along each side of the search grid. */
  grid: number;
  /** Rectangle of trial centres; null lets SlopeForge choose it. */
  box: SearchBox | null;
  /** Circles shallower than this are ignored, m. */
  minDepth: number;
  /** Drawing snap, m. 0 switches it off. */
  snap: number;
  /** A circle placed by hand, analysed alongside the critical one. */
  trial: Circle | null;
}

export interface Project {
  version: 1;
  title: string;
  model: SlopeModel;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  method: 'bishop',
  slices: 30,
  grid: 16,
  box: null,
  minDepth: 0,
  snap: 0.5,
  trial: null,
};

export const LIMITS = {
  slices: { min: 4, max: 200 },
  grid: { min: 4, max: 40 },
};

/** Settings with out-of-range values pulled back into range. */
export function cleanSettings(s: Settings): Settings {
  const clamp = (v: number, lo: number, hi: number, fallback: number): number =>
    Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : fallback;
  return {
    ...s,
    slices: clamp(s.slices, LIMITS.slices.min, LIMITS.slices.max, DEFAULT_SETTINGS.slices),
    grid: clamp(s.grid, LIMITS.grid.min, LIMITS.grid.max, DEFAULT_SETTINGS.grid),
    minDepth: Number.isFinite(s.minDepth) && s.minDepth > 0 ? s.minDepth : 0,
    snap: Number.isFinite(s.snap) && s.snap > 0 ? s.snap : 0,
  };
}

export function cloneModel(model: SlopeModel): SlopeModel {
  return JSON.parse(JSON.stringify(model)) as SlopeModel;
}

export function cloneProject(project: Project): Project {
  return JSON.parse(JSON.stringify(project)) as Project;
}
