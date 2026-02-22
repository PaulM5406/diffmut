import { describe, it, expect } from 'vitest';
import { JsonReporter } from '../../../src/reporter/json-reporter.js';
import type { PipelineResult } from '../../../src/mutation/types.js';

describe('JsonReporter', () => {
  it('should produce valid JSON', () => {
    const result: PipelineResult = {
      totalMutations: 1,
      killed: 1,
      survived: 0,
      noCoverage: 0,
      timedOut: 0,
      errors: 0,
      mutationScore: 100,
      fileResults: [],
      totalTokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      durationMs: 100,
    };

    const reporter = new JsonReporter();
    const output = reporter.report(result);
    const parsed = JSON.parse(output);

    expect(parsed.totalMutations).toBe(1);
    expect(parsed.mutationScore).toBe(100);
  });
});
