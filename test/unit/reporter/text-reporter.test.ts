import { describe, it, expect } from 'vitest';
import { TextReporter } from '../../../src/reporter/text-reporter.js';
import type { PipelineResult } from '../../../src/mutation/types.js';

function makePipelineResult(overrides: Partial<PipelineResult> = {}): PipelineResult {
  return {
    totalMutations: 3,
    killed: 2,
    survived: 1,
    timedOut: 0,
    errors: 0,
    mutationScore: 66.7,
    fileResults: [
      {
        filePath: 'src/test.ts',
        results: [
          {
            mutation: {
              id: 'mut-1',
              filePath: 'src/test.ts',
              startLine: 5,
              endLine: 5,
              originalCode: 'return true;',
              mutatedCode: 'return false;',
              description: 'Changed return value',
              category: 'return-value',
            },
            outcome: 'killed',
            durationMs: 42,
          },
          {
            mutation: {
              id: 'mut-2',
              filePath: 'src/test.ts',
              startLine: 10,
              endLine: 10,
              originalCode: 'x > 0',
              mutatedCode: 'x >= 0',
              description: 'Changed boundary',
              category: 'boundary-condition',
            },
            outcome: 'survived',
            durationMs: 55,
          },
          {
            mutation: {
              id: 'mut-3',
              filePath: 'src/test.ts',
              startLine: 15,
              endLine: 15,
              originalCode: 'if (a && b)',
              mutatedCode: 'if (a || b)',
              description: 'Swapped logical operator',
              category: 'logical-operator',
            },
            outcome: 'killed',
            durationMs: 38,
          },
        ],
        tokenUsage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
      },
    ],
    totalTokenUsage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
    durationMs: 5000,
    ...overrides,
  };
}

describe('TextReporter', () => {
  it('should produce a formatted text report', () => {
    const reporter = new TextReporter();
    const output = reporter.report(makePipelineResult());

    expect(output).toContain('Mutagen Report');
    expect(output).toContain('66.7%');
    expect(output).toContain('2/3 killed');
    expect(output).toContain('src/test.ts');
    expect(output).toContain('KILLED');
    expect(output).toContain('SURVIVED');
  });

  it('should show token usage', () => {
    const reporter = new TextReporter();
    const output = reporter.report(makePipelineResult());
    expect(output).toContain('500');
    expect(output).toContain('200');
    expect(output).toContain('700');
  });
});
