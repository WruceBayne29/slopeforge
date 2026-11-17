import { describe, expect, it } from 'vitest';
import { checkModel, searchCritical } from '../engine';
import {
  addSoil,
  defaultWaterLine,
  deletePoint,
  insertPoint,
  linePoints,
  movePoint,
  removeSoil,
  sameLine,
  snapTo,
  updateSoil,
} from './edit';
import { defaultProject, EXAMPLES, findExample } from './examples';
import { cleanSettings, cloneProject, DEFAULT_SETTINGS } from './project';

describe('examples', () => {
  it('offers at least six, with unique ids', () => {
    expect(EXAMPLES.length).toBeGreaterThanOrEqual(6);
    expect(new Set(EXAMPLES.map((e) => e.id)).size).toBe(EXAMPLES.length);
    expect(findExample('acads-1c')?.name).toMatch(/ACADS/);
    expect(findExample('nope')).toBeUndefined();
  });

  for (const example of EXAMPLES) {
    it(`"${example.name}" is sound and has a critical circle`, () => {
      expect(checkModel(example.project.model)).toEqual([]);
      const found = searchCritical(example.project.model, { slices: 30 });
      const f = found.critical?.bishop.fos;
      expect(f).toBeGreaterThan(0.6);
      expect(f).toBeLessThan(3);
    });
  }

  it('gives a fresh default project each time', () => {
    const a = defaultProject();
    a.model.ground[0].y = 999;
    expect(defaultProject().model.ground[0].y).not.toBe(999);
  });
});

describe('settings', () => {
  it('clamps out-of-range values', () => {
    const s = cleanSettings({
      ...DEFAULT_SETTINGS,
      slices: 9999,
      grid: 1,
      minDepth: -2,
      snap: NaN,
    });
    expect(s.slices).toBe(200);
    expect(s.grid).toBe(4);
    expect(s.minDepth).toBe(0);
    expect(s.snap).toBe(0);
    expect(cleanSettings({ ...DEFAULT_SETTINGS, slices: NaN }).slices).toBe(30);
  });

  it('clones a project deeply', () => {
    const p = defaultProject();
    const q = cloneProject(p);
    q.model.soils[0].c = 123;
    expect(p.model.soils[0].c).not.toBe(123);
  });
});

describe('editing', () => {
  const model = () => defaultProject().model;

  it('moves a point with snapping and keeps chainages in order', () => {
    const m = movePoint(model(), { kind: 'ground' }, 1, { x: 13.26, y: 21.13 }, 0.5);
    expect(m.ground[1]).toEqual({ x: 13.5, y: 21 });
    const clamped = movePoint(model(), { kind: 'ground' }, 1, { x: 500, y: 20 });
    expect(clamped.ground[1].x).toBeCloseTo(36 - 0.05, 9);
    const first = movePoint(model(), { kind: 'ground' }, 0, { x: -5, y: 19 });
    expect(first.ground[0]).toEqual({ x: -5, y: 19 });
    expect(movePoint(model(), { kind: 'ground' }, 99, { x: 0, y: 0 })).toEqual(model());
    expect(snapTo(1.26, 0)).toBe(1.26);
  });

  it('moves boundary and water points', () => {
    const b = movePoint(model(), { kind: 'boundary', index: 1 }, 1, { x: 31, y: 15 });
    expect(b.boundaries[1][1]).toEqual({ x: 31, y: 15 });
    const w = movePoint(model(), { kind: 'water' }, 0, { x: 0, y: 18 });
    expect(w.water).toMatchObject({ kind: 'line' });
    expect(linePoints(w, { kind: 'water' })[0].y).toBe(18);
    expect(linePoints({ ...model(), water: { kind: 'none' } }, { kind: 'water' })).toEqual([]);
    expect(linePoints(model(), { kind: 'boundary', index: 9 })).toEqual([]);
  });

  it('inserts a point on a line', () => {
    const r = insertPoint(model(), { kind: 'ground' }, 24);
    expect(r?.index).toBe(2);
    expect(r?.model.ground[2]).toEqual({ x: 24, y: 26 });
    expect(insertPoint(model(), { kind: 'ground' }, 12.01)).toBeNull();
    const end = insertPoint(model(), { kind: 'ground' }, 70, 33);
    expect(end?.index).toBe(4);
    expect(insertPoint({ ...model(), water: { kind: 'none' } }, { kind: 'water' }, 5)).toBeNull();
  });

  it('deletes a point but keeps lines drawable', () => {
    const m = deletePoint(model(), { kind: 'ground' }, 1);
    expect(m?.ground).toHaveLength(3);
    const two = { ...model(), ground: model().ground.slice(0, 2) };
    expect(deletePoint(two, { kind: 'ground' }, 0)).toBeNull();
    expect(deletePoint(model(), { kind: 'ground' }, 42)).toBeNull();
  });

  it('adds and removes strata together with their boundaries', () => {
    const more = addSoil(model());
    expect(more.soils).toHaveLength(4);
    expect(more.boundaries).toHaveLength(3);
    expect(checkModel(more)).toEqual([]);
    expect(new Set(more.soils.map((s) => s.id)).size).toBe(4);
    const fewer = removeSoil(more, 0);
    expect(fewer?.soils).toHaveLength(3);
    expect(fewer?.boundaries).toHaveLength(2);
    const last = removeSoil(model(), 2);
    expect(last?.boundaries).toHaveLength(1);
    expect(last?.soils.map((s) => s.id)).toEqual(['residual', 'clay']);
    const single = removeSoil(removeSoil(model(), 0)!, 0)!;
    expect(removeSoil(single, 0)).toBeNull();
    const again = addSoil(single);
    expect(again.boundaries).toHaveLength(1);
    expect(checkModel(again)).toEqual([]);
  });

  it('updates soil properties', () => {
    const m = updateSoil(model(), 1, { c: 99 });
    expect(m.soils[1].c).toBe(99);
    expect(updateSoil(model(), 9, { c: 1 })).toEqual(model());
  });

  it('proposes a water line that rises towards the crest', () => {
    const w = defaultWaterLine(model());
    expect(w[1].y).toBeGreaterThan(w[0].y);
    const flipped = {
      ...model(),
      ground: model()
        .ground.map((p) => ({ x: -p.x, y: p.y }))
        .reverse(),
    };
    const v = defaultWaterLine(flipped);
    expect(v[0].y).toBeGreaterThan(v[1].y);
  });

  it('compares line references', () => {
    expect(sameLine({ kind: 'ground' }, { kind: 'ground' })).toBe(true);
    expect(sameLine({ kind: 'boundary', index: 0 }, { kind: 'boundary', index: 1 })).toBe(false);
    expect(sameLine({ kind: 'water' }, { kind: 'ground' })).toBe(false);
  });
});
