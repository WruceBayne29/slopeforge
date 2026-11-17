/**
 * One analysis run: check the model, search for the critical circle and, when asked, work out
 * the extras. Pure, so it can run in a web worker or directly.
 */
import { checkModel, prepare, searchCritical, sensitivity } from '../engine';
import type { SearchResult, SensitivityCurve, SlopeModel } from '../engine';
import type { Settings } from './project';

export interface AnalysisRequest {
  id: number;
  model: SlopeModel;
  settings: Settings;
  /** Also compute the sensitivity curves. */
  sensitivity: boolean;
  /** Also search with the method that is not being minimised. */
  other: boolean;
}

export interface AnalysisResponse {
  id: number;
  /** Reasons the model cannot be analysed. */
  problems: string[];
  search: SearchResult | null;
  sensitivity: SensitivityCurve[] | null;
  other: SearchResult | null;
  /** Time taken, ms. */
  elapsed: number;
}

/** The part of a project the search depends on, as a string, so repeat runs can be skipped. */
export function analysisKey(model: SlopeModel, settings: Settings): string {
  const { method, slices, grid, box, minDepth } = settings;
  return JSON.stringify({ model, method, slices, grid, box, minDepth });
}

export function runAnalysis(request: AnalysisRequest): AnalysisResponse {
  const started = Date.now();
  const { model, settings } = request;
  const problems = checkModel(model);
  const response: AnalysisResponse = {
    id: request.id,
    problems,
    search: null,
    sensitivity: null,
    other: null,
    elapsed: 0,
  };
  if (problems.length === 0) {
    const pm = prepare(model);
    const options = {
      method: settings.method,
      slices: settings.slices,
      minDepth: settings.minDepth,
      box: settings.box,
      nx: settings.grid,
      ny: settings.grid,
    };
    response.search = searchCritical(pm, options);
    const critical = response.search.critical;
    if (critical && request.sensitivity) {
      response.sensitivity = sensitivity(model, critical.circle, options);
    }
    if (request.other) {
      response.other = searchCritical(pm, {
        ...options,
        method: settings.method === 'bishop' ? 'fellenius' : 'bishop',
      });
    }
  }
  response.elapsed = Date.now() - started;
  return response;
}
