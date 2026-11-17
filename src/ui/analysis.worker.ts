/// <reference lib="webworker" />
import { runAnalysis } from '../model/run';
import type { AnalysisRequest } from '../model/run';

self.onmessage = (event: MessageEvent<AnalysisRequest>) => {
  self.postMessage(runAnalysis(event.data));
};
