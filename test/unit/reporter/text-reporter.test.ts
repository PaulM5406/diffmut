import { describe, it, expect } from 'vitest';
import { TextReporter } from '../../../src/reporter/text-reporter.js';
import type { PipelineResult } from '../../../src/mutation/types.js';

function makePipelineResult(overrides: Partial<PipelineResult> = {}): PipelineResult {
  return {
    totalMutations: 3,
    killed: 2,
    survived: 1,
    noCoverage: 0,
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

    expect(output).toContain('diffmut Report');
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

  it('should render all outcome types', () => {
    const result: PipelineResult = makePipelineResult({
      totalMutations: 5,
      killed: 1,
      survived: 1,
      noCoverage: 1,
      timedOut: 1,
      errors: 1,
      mutationScore: 20,
      fileResults: [
        {
          filePath: 'src/test.ts',
          results: [
            {
              mutation: {
                id: 'mut-1',
                filePath: 'src/test.ts',
                startLine: 1,
                endLine: 1,
                originalCode: 'a',
                mutatedCode: 'b',
                description: 'killed mutation',
                category: 'return-value',
              },
              outcome: 'killed',
              durationMs: 10,
            },
            {
              mutation: {
                id: 'mut-2',
                filePath: 'src/test.ts',
                startLine: 2,
                endLine: 2,
                originalCode: 'c',
                mutatedCode: 'd',
                description: 'survived mutation',
                category: 'return-value',
              },
              outcome: 'survived',
              durationMs: 10,
            },
            {
              mutation: {
                id: 'mut-3',
                filePath: 'src/test.ts',
                startLine: 3,
                endLine: 3,
                originalCode: 'e',
                mutatedCode: 'f',
                description: 'timeout mutation',
                category: 'return-value',
              },
              outcome: 'timeout',
              durationMs: 300000,
            },
            {
              mutation: {
                id: 'mut-4',
                filePath: 'src/test.ts',
                startLine: 4,
                endLine: 4,
                originalCode: 'g',
                mutatedCode: 'h',
                description: 'no_coverage mutation',
                category: 'return-value',
              },
              outcome: 'no_coverage',
              durationMs: 5,
            },
            {
              mutation: {
                id: 'mut-5',
                filePath: 'src/test.ts',
                startLine: 5,
                endLine: 5,
                originalCode: 'i',
                mutatedCode: 'j',
                description: 'error mutation',
                category: 'return-value',
              },
              outcome: 'error',
              durationMs: 5,
            },
          ],
          tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        },
      ],
    });

    const reporter = new TextReporter();
    const output = reporter.report(result);

    expect(output).toContain('TIMEOUT');
    expect(output).toContain('NO COVER');
    expect(output).toContain('ERROR');
  });
});
