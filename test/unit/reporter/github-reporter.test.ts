import { describe, it, expect } from 'vitest';
import { GithubReporter } from '../../../src/reporter/github-reporter.js';
import type { PipelineResult } from '../../../src/mutation/types.js';

describe('GithubReporter', () => {
  it('should produce markdown with table', () => {
    const result: PipelineResult = {
      totalMutations: 2,
      killed: 1,
      survived: 1,
      noCoverage: 0,
      timedOut: 0,
      errors: 0,
      mutationScore: 50,
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
          ],
          tokenUsage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
        },
      ],
      totalTokenUsage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
      durationMs: 5000,
    };

    const reporter = new GithubReporter();
    const output = reporter.report(result);

    expect(output).toContain('## diffmut Report');
    expect(output).toContain('50.0%');
    expect(output).toContain(':white_check_mark:');
    expect(output).toContain(':warning:');
    expect(output).toContain('Uncaught mutations (1)');
    expect(output).toContain('Caught mutations (1)');
    expect(output).toContain('```diff');
    expect(output).toContain('- x > 0');
    expect(output).toContain('+ x >= 0');
    expect(output).toContain('- return true;');
    expect(output).toContain('+ return false;');
  });

  it('should render all outcome types correctly', () => {
    const result: PipelineResult = {
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
      totalTokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      durationMs: 1000,
    };

    const reporter = new GithubReporter();
    const output = reporter.report(result);

    expect(output).toContain(':white_check_mark:');
    expect(output).toContain(':warning:');
    expect(output).toContain(':hourglass:');
    expect(output).toContain(':see_no_evil:');
    expect(output).toContain(':x:');
  });

  it('should not show survived details when none survived', () => {
    const result: PipelineResult = {
      totalMutations: 1,
      killed: 1,
      survived: 0,
      noCoverage: 0,
      timedOut: 0,
      errors: 0,
      mutationScore: 100,
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
                originalCode: 'x',
                mutatedCode: 'y',
                description: 'test',
                category: 'return-value',
              },
              outcome: 'killed',
              durationMs: 42,
            },
          ],
          tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        },
      ],
      totalTokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      durationMs: 1000,
    };

    const reporter = new GithubReporter();
    const output = reporter.report(result);

    expect(output).not.toContain('Uncaught mutations');
    expect(output).toContain('Caught mutations (1)');
    expect(output).toContain('- x');
    expect(output).toContain('+ y');
  });
});
