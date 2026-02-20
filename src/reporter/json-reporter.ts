import type { PipelineResult } from '../mutation/types.js';
import type { Reporter } from './reporter.js';

export class JsonReporter implements Reporter {
  report(result: PipelineResult): string {
    return JSON.stringify(result, null, 2);
  }
}
