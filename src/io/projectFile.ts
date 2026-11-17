/**
 * Reading and writing projects as JSON. `parseProject` treats its input as untrusted (a file the
 * user opens, or data from a share link): it rebuilds the project field by field, accepting only
 * values of the right type and, for choices, from the allowed set.
 */
import type {
  Circle,
  Pattern,
  Point,
  SearchBox,
  SlopeModel,
  Soil,
  Surcharge,
  Water,
} from '../engine';
import { cleanSettings, DEFAULT_SETTINGS } from '../model/project';
import type { Project, Settings } from '../model/project';

export const FILE_FORMAT = 'slopeforge-project';
const MAX_POINTS = 400;
const MAX_SOILS = 24;
const PATTERNS: readonly Pattern[] = ['sand', 'clay', 'silt', 'gravel', 'fill', 'rock', 'peat'];

export class ProjectFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectFormatError';
  }
}

export function serializeProject(project: Project): string {
  return JSON.stringify({ format: FILE_FORMAT, ...project }, null, 2);
}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function num(v: unknown, name: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > 1e7) {
    throw new ProjectFormatError(`"${name}" must be a number.`);
  }
  return v;
}

function text(v: unknown, name: string, fallback: string): string {
  if (v === undefined) return fallback;
  if (typeof v !== 'string' || v.length > 120) {
    throw new ProjectFormatError(`"${name}" must be a short piece of text.`);
  }
  return v;
}

function points(v: unknown, name: string, least: number): Point[] {
  if (!Array.isArray(v) || v.length < least || v.length > MAX_POINTS) {
    throw new ProjectFormatError(`"${name}" must be a list of ${least} to ${MAX_POINTS} points.`);
  }
  return v.map((p, i) => {
    if (!isObject(p)) throw new ProjectFormatError(`"${name}[${i}]" must be a point.`);
    return { x: num(p.x, `${name}[${i}].x`), y: num(p.y, `${name}[${i}].y`) };
  });
}

function soil(v: unknown, i: number): Soil {
  if (!isObject(v)) throw new ProjectFormatError(`"soils[${i}]" must be an object.`);
  const pattern = v.pattern;
  if (typeof pattern !== 'string' || !PATTERNS.includes(pattern as Pattern)) {
    throw new ProjectFormatError(`"soils[${i}].pattern" must be one of: ${PATTERNS.join(', ')}.`);
  }
  const out: Soil = {
    id: text(v.id, `soils[${i}].id`, `soil-${i + 1}`),
    name: text(v.name, `soils[${i}].name`, `Stratum ${i + 1}`),
    pattern: pattern as Pattern,
    gamma: num(v.gamma, `soils[${i}].gamma`),
    c: num(v.c, `soils[${i}].c`),
    phi: num(v.phi, `soils[${i}].phi`),
  };
  if (v.gammaSat !== undefined && v.gammaSat !== null) {
    out.gammaSat = num(v.gammaSat, `soils[${i}].gammaSat`);
  }
  return out;
}

function water(v: unknown): Water {
  if (!isObject(v) || v.kind === 'none') return { kind: 'none' };
  if (v.kind === 'ru') return { kind: 'ru', ru: num(v.ru, 'water.ru') };
  if (v.kind === 'line') return { kind: 'line', points: points(v.points, 'water.points', 1) };
  throw new ProjectFormatError('"water.kind" must be "none", "line" or "ru".');
}

function model(v: unknown): SlopeModel {
  if (!isObject(v)) throw new ProjectFormatError('The file has no slope model.');
  if (!Array.isArray(v.soils) || v.soils.length < 1 || v.soils.length > MAX_SOILS) {
    throw new ProjectFormatError(`"soils" must list 1 to ${MAX_SOILS} soils.`);
  }
  const soils = v.soils.map(soil);
  if (new Set(soils.map((s) => s.id)).size !== soils.length) {
    soils.forEach((s, i) => (s.id = `soil-${i + 1}`));
  }
  const rawBoundaries = v.boundaries ?? [];
  if (!Array.isArray(rawBoundaries) || rawBoundaries.length !== soils.length - 1) {
    throw new ProjectFormatError('There must be one layer boundary between each pair of soils.');
  }
  const surcharges: Surcharge[] = [];
  if (v.surcharges !== undefined) {
    if (!Array.isArray(v.surcharges) || v.surcharges.length > 20) {
      throw new ProjectFormatError('"surcharges" must be a short list.');
    }
    v.surcharges.forEach((s, i) => {
      if (!isObject(s)) throw new ProjectFormatError(`"surcharges[${i}]" must be an object.`);
      surcharges.push({
        x1: num(s.x1, `surcharges[${i}].x1`),
        x2: num(s.x2, `surcharges[${i}].x2`),
        q: num(s.q, `surcharges[${i}].q`),
      });
    });
  }
  let crack: SlopeModel['crack'] = null;
  if (isObject(v.crack)) {
    crack = {
      depth: num(v.crack.depth, 'crack.depth'),
      water: num(v.crack.water ?? 0, 'crack.water'),
    };
  }
  return {
    ground: points(v.ground, 'ground', 2),
    soils,
    boundaries: rawBoundaries.map((b, i) => points(b, `boundaries[${i}]`, 1)),
    base: num(v.base, 'base'),
    water: water(v.water),
    gammaW: v.gammaW === undefined ? 9.81 : num(v.gammaW, 'gammaW'),
    surcharges,
    kh: v.kh === undefined ? 0 : num(v.kh, 'kh'),
    crack,
  };
}

function settings(v: unknown): Settings {
  if (!isObject(v)) return { ...DEFAULT_SETTINGS };
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (v.method !== undefined) {
    if (v.method !== 'bishop' && v.method !== 'fellenius') {
      throw new ProjectFormatError('"settings.method" must be "bishop" or "fellenius".');
    }
    out.method = v.method;
  }
  for (const key of ['slices', 'grid', 'minDepth', 'snap'] as const) {
    if (v[key] !== undefined) out[key] = num(v[key], `settings.${key}`);
  }
  if (isObject(v.box)) {
    const b = v.box;
    const box: SearchBox = {
      x1: num(b.x1, 'settings.box.x1'),
      x2: num(b.x2, 'settings.box.x2'),
      y1: num(b.y1, 'settings.box.y1'),
      y2: num(b.y2, 'settings.box.y2'),
    };
    out.box = box;
  }
  if (isObject(v.trial)) {
    const t = v.trial;
    const trial: Circle = {
      xc: num(t.xc, 'settings.trial.xc'),
      yc: num(t.yc, 'settings.trial.yc'),
      r: num(t.r, 'settings.trial.r'),
    };
    out.trial = trial;
  }
  return cleanSettings(out);
}

/** Validates arbitrary parsed JSON and returns a clean `Project`. */
export function parseProject(data: unknown): Project {
  if (!isObject(data)) throw new ProjectFormatError('This is not a SlopeForge project file.');
  if (data.format !== undefined && data.format !== FILE_FORMAT) {
    throw new ProjectFormatError('This is not a SlopeForge project file.');
  }
  if (data.version !== undefined && data.version !== 1) {
    throw new ProjectFormatError('This file was made by a newer version of SlopeForge.');
  }
  return {
    version: 1,
    title: text(data.title, 'title', 'Untitled slope'),
    model: model(data.model),
    settings: settings(data.settings),
  };
}

/** Parses the text of a project file. */
export function parseProjectText(source: string): Project {
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch {
    throw new ProjectFormatError('This file is not valid JSON.');
  }
  return parseProject(data);
}
