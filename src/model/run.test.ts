import { describe, expect, it } from 'vitest';
import { defaultProject } from './examples';
import { historyReducer, HISTORY_LIMIT, startHistory } from './history';
import { analysisKey, runAnalysis } from './run';

describe('runAnalysis', () => {
  const p = defaultProject();

  it('searches and reports the time taken', () => {
    const r = runAnalysis({
      id: 7,
      model: p.model,
      settings: p.settings,
      sensitivity: false,
      other: false,
    });
    expect(r.id).toBe(7);
    expect(r.problems).toEqual([]);
    expect(r.search?.critical?.bishop.fos).toBeGreaterThan(1);
    expect(r.sensitivity).toBeNull();
    expect(r.other).toBeNull();
    expect(r.elapsed).toBeGreaterThanOrEqual(0);
  });

  it('adds the extras when asked', () => {
    const settings = { ...p.settings, grid: 8 };
    const r = runAnalysis({ id: 1, model: p.model, settings, sensitivity: true, other: true });
    expect(r.sensitivity?.map((c) => c.parameter)).toEqual(['cohesion', 'friction', 'water']);
    expect(r.other?.method).toBe('fellenius');
    const f = runAnalysis({
      id: 2,
      model: p.model,
      settings: { ...settings, method: 'fellenius' },
      sensitivity: false,
      other: true,
    });
    expect(f.other?.method).toBe('bishop');
  });

  it('returns the problems instead of a result for a broken model', () => {
    const model = { ...p.model, base: 999 };
    const r = runAnalysis({ id: 3, model, settings: p.settings, sensitivity: true, other: true });
    expect(r.search).toBeNull();
    expect(r.problems.join(' ')).toContain('firm base');
  });

  it('keys a run on what the search depends on, not on the trial circle or snap', () => {
    const a = analysisKey(p.model, p.settings);
    expect(analysisKey(p.model, { ...p.settings, snap: 1, trial: { xc: 1, yc: 2, r: 3 } })).toBe(a);
    expect(analysisKey(p.model, { ...p.settings, slices: 12 })).not.toBe(a);
  });
});

describe('history', () => {
  const a = defaultProject();
  const b = { ...a, title: 'B' };
  const c = { ...a, title: 'C' };

  it('commits, undoes and redoes', () => {
    let h = startHistory(a);
    h = historyReducer(h, { type: 'commit', project: b });
    h = historyReducer(h, { type: 'commit', project: c });
    expect(h.past).toHaveLength(2);
    h = historyReducer(h, { type: 'undo' });
    expect(h.present.title).toBe('B');
    h = historyReducer(h, { type: 'redo' });
    expect(h.present.title).toBe('C');
    expect(historyReducer(h, { type: 'redo' })).toBe(h);
    h = historyReducer(h, { type: 'undo' });
    h = historyReducer(h, { type: 'undo' });
    expect(h.present).toBe(a);
    expect(historyReducer(h, { type: 'undo' }).present).toBe(a);
  });

  it('turns a whole drag into one undo step', () => {
    let h = startHistory(a);
    h = historyReducer(h, { type: 'preview', project: b });
    h = historyReducer(h, { type: 'preview', project: c });
    expect(h.past).toHaveLength(0);
    expect(historyReducer(h, { type: 'redo' })).toBe(h);
    h = historyReducer(h, { type: 'settle' });
    expect(h.past).toEqual([a]);
    expect(h.present).toBe(c);
    expect(historyReducer(h, { type: 'settle' })).toBe(h);
  });

  it('ignores a drag that changed nothing, and undoes mid-drag', () => {
    let h = startHistory(a);
    h = historyReducer(h, { type: 'preview', project: a });
    h = historyReducer(h, { type: 'settle' });
    expect(h.past).toHaveLength(0);
    expect(h.anchor).toBeNull();
    h = historyReducer(h, { type: 'preview', project: b });
    h = historyReducer(h, { type: 'undo' });
    expect(h.present).toBe(a);
    h = historyReducer(h, { type: 'preview', project: b });
    h = historyReducer(h, { type: 'commit', project: c });
    expect(h.past).toEqual([a]);
  });

  it('loading is undoable and the stack is bounded', () => {
    let h = startHistory(a);
    h = historyReducer(h, { type: 'load', project: b });
    expect(h.past).toEqual([a]);
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) {
      h = historyReducer(h, { type: 'commit', project: { ...a, title: String(i) } });
    }
    expect(h.past).toHaveLength(HISTORY_LIMIT);
  });
});
