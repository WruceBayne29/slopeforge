import { useEffect, useRef, useState } from 'react';
import type { SlopeModel } from '../engine';
import type { Settings } from '../model/project';
import { analysisKey, runAnalysis } from '../model/run';
import type { AnalysisRequest, AnalysisResponse } from '../model/run';

export interface AnalysisState {
  response: AnalysisResponse | null;
  /** A run is in progress (the response shown may be for an earlier state of the model). */
  busy: boolean;
}

/**
 * Runs the critical-circle search off the main thread and returns the latest result. While the
 * worker is busy only the newest request is kept, so dragging a point never queues up work.
 */
export function useAnalysis(
  model: SlopeModel,
  settings: Settings,
  extras: { sensitivity: boolean; other: boolean },
): AnalysisState {
  const [state, setState] = useState<AnalysisState>({ response: null, busy: true });
  const worker = useRef<Worker | null>(null);
  const running = useRef(false);
  const queued = useRef<AnalysisRequest | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    let w: Worker | null = null;
    try {
      w = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      w = null;
    }
    worker.current = w;
    if (w) {
      w.onmessage = (event: MessageEvent<AnalysisResponse>) => {
        running.current = false;
        const next = queued.current;
        queued.current = null;
        if (event.data.id === latest.current) setState({ response: event.data, busy: false });
        else setState((s) => ({ response: event.data, busy: s.busy }));
        if (next) {
          running.current = true;
          w.postMessage(next);
        }
      };
      w.onerror = () => {
        // Fall back to running on the main thread.
        worker.current = null;
        running.current = false;
        const next = queued.current;
        queued.current = null;
        if (next) setState({ response: runAnalysis(next), busy: false });
      };
    }
    return () => {
      w?.terminate();
      worker.current = null;
      running.current = false;
      queued.current = null;
    };
  }, []);

  const key = `${analysisKey(model, settings)}|${extras.sensitivity ? 1 : 0}${extras.other ? 1 : 0}`;
  useEffect(() => {
    const request: AnalysisRequest = {
      id: ++latest.current,
      model,
      settings,
      sensitivity: extras.sensitivity,
      other: extras.other,
    };
    const w = worker.current;
    if (!w) {
      const timer = window.setTimeout(
        () => setState({ response: runAnalysis(request), busy: false }),
        0,
      );
      return () => window.clearTimeout(timer);
    }
    setState((s) => ({ ...s, busy: true }));
    if (running.current) queued.current = request;
    else {
      running.current = true;
      w.postMessage(request);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
