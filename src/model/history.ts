/**
 * Undo / redo. A drag sends many `preview` actions and one `settle`, which becomes a single
 * undo step; everything else is a `commit`.
 */
import type { Project } from './project';

export interface History {
  past: Project[];
  present: Project;
  future: Project[];
  /** The project as it was when the current drag began. */
  anchor: Project | null;
}

export type HistoryAction =
  | { type: 'commit'; project: Project }
  | { type: 'preview'; project: Project }
  | { type: 'settle' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'load'; project: Project };

export const HISTORY_LIMIT = 100;

export const startHistory = (project: Project): History => ({
  past: [],
  present: project,
  future: [],
  anchor: null,
});

const push = (past: Project[], project: Project): Project[] =>
  [...past, project].slice(-HISTORY_LIMIT);

export function historyReducer(state: History, action: HistoryAction): History {
  switch (action.type) {
    case 'commit':
      return {
        past: push(state.past, state.anchor ?? state.present),
        present: action.project,
        future: [],
        anchor: null,
      };
    case 'preview':
      return { ...state, present: action.project, anchor: state.anchor ?? state.present };
    case 'settle':
      if (!state.anchor) return state;
      if (state.anchor === state.present) return { ...state, anchor: null };
      return {
        past: push(state.past, state.anchor),
        present: state.present,
        future: [],
        anchor: null,
      };
    case 'undo': {
      const settled = historyReducer(state, { type: 'settle' });
      const previous = settled.past[settled.past.length - 1];
      if (!previous) return settled;
      return {
        past: settled.past.slice(0, -1),
        present: previous,
        future: [settled.present, ...settled.future],
        anchor: null,
      };
    }
    case 'redo': {
      const next = state.future[0];
      if (!next || state.anchor) return state;
      return {
        past: push(state.past, state.present),
        present: next,
        future: state.future.slice(1),
        anchor: null,
      };
    }
    case 'load':
      return {
        past: push(state.past, state.anchor ?? state.present),
        present: action.project,
        future: [],
        anchor: null,
      };
  }
}
