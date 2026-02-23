import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies
vi.mock('../../../src/utils/git.js', () => ({
  gitDiff: vi.fn(),
  gitRoot: vi.fn(() => '/fake/repo'),
  isInsideGitRepo: vi.fn(() => true),
}));

vi.mock('../../../src/diff/extractor.js', () => ({
  extractDiff: vi.fn(),
}));

vi.mock('../../../src/runner/preflight.js', () => ({
  runPreflight: vi.fn(),
}));

vi.mock('../../../src/runner/executor.js', () => ({
  executeTests: vi.fn(),
}));

vi.mock('../../../src/mutation/openai-provider.js', () => ({
  OpenAIMutationProvider: vi.fn().mockImplementation(() => ({
    name: 'openai',
    generateMutations: vi.fn(),
  })),
}));

vi.mock('../../../src/mutation/anthropic-provider.js', () => ({
  AnthropicMutationProvider: vi.fn().mockImplementation(() => ({
    name: 'anthropic',
    generateMutations: vi.fn(),
  })),
}));

// Must mock fs for FileManager
vi.mock('node:fs', async () => {
  const fileStore = new Map<string, string>();
  return {
    default: {
      readFileSync: vi.fn((p: string) => fileStore.get(p) ?? 'original'),
      writeFileSync: vi.fn((p: string, c: string) => fileStore.set(p, c)),
      existsSync: vi.fn(() => true),
    },
  };
});

import { extractDiff } from '../../../src/diff/extractor.js';
import { runPreflight } from '../../../src/runner/preflight.js';
import { executeTests } from '../../../src/runner/executor.js';
import { OpenAIMutationProvider } from '../../../src/mutation/openai-provider.js';
import {
  runPipeline,
  validateOriginalCode,
  applyMutationToContent,
  classifyOutcome,
  aggregateResults,
} from '../../../src/pipeline/orchestrator.js';
import type { MutantConfig } from '../../../src/config/schema.js';

const baseConfig: MutantConfig = {
  diffBase: 'origin/main',
  testCommand: 'npm test',
  mutations: 3,
  model: 'gpt-4o',
  timeout: 60,
  output: 'text',
  excludeTests: true,
  failOnSurvived: false,
  dryRun: false,
};

describe('runPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty result when no files changed', async () => {
    vi.mocked(extractDiff).mockReturnValue({ baseRef: 'origin/main', files: [] });

    const result = await runPipeline(baseConfig);
    expect(result.totalMutations).toBe(0);
    expect(result.mutationScore).toBe(100);
  });

  it('should pass excludeTests to extractDiff', async () => {
    vi.mocked(extractDiff).mockReturnValue({ baseRef: 'origin/main', files: [] });

    await runPipeline(baseConfig);
    expect(extractDiff).toHaveBeenCalledWith('origin/main', undefined, undefined, true);
  });

  it('should run preflight before testing mutations', async () => {
    vi.mocked(extractDiff).mockReturnValue({
      baseRef: 'origin/main',
      files: [
        {
          filePath: 'src/test.ts',
          currentContent: 'line1\nline2\nline3',
          hunks: [{ startLine: 2, lineCount: 1, lines: [{ lineNumber: 2, content: 'line2', type: 'added' }] }],
          language: 'typescript',
        },
      ],
    });

    const mockProvider = {
      name: 'openai',
      generateMutations: vi.fn().mockResolvedValue({
        mutations: [],
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        retries: 0,
      }),
    };
    vi.mocked(OpenAIMutationProvider).mockImplementation(() => mockProvider as any);

    await runPipeline(baseConfig);
    expect(runPreflight).toHaveBeenCalledOnce();
  });

  it('should call generateMutations once with all files', async () => {
    const files = [
      {
        filePath: 'src/foo.ts',
        currentContent: 'line1\nline2',
        hunks: [{ startLine: 2, lineCount: 1, lines: [{ lineNumber: 2, content: 'line2', type: 'added' }] }],
        language: 'typescript',
      },
      {
        filePath: 'src/bar.ts',
        currentContent: 'line1\nline2',
        hunks: [{ startLine: 2, lineCount: 1, lines: [{ lineNumber: 2, content: 'line2', type: 'added' }] }],
        language: 'typescript',
      },
    ];

    vi.mocked(extractDiff).mockReturnValue({ baseRef: 'origin/main', files });

    const mockProvider = {
      name: 'openai',
      generateMutations: vi.fn().mockResolvedValue({
        mutations: [],
        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        retries: 0,
      }),
    };
    vi.mocked(OpenAIMutationProvider).mockImplementation(() => mockProvider as any);

    await runPipeline(baseConfig);

    // Single call with all files, not one per file
    expect(mockProvider.generateMutations).toHaveBeenCalledOnce();
    expect(mockProvider.generateMutations).toHaveBeenCalledWith(files, 3);
  });

  it('should skip preflight in dry-run mode', async () => {
    vi.mocked(extractDiff).mockReturnValue({
      baseRef: 'origin/main',
      files: [
        {
          filePath: 'src/test.ts',
          currentContent: 'line1\nline2',
          hunks: [{ startLine: 2, lineCount: 1, lines: [{ lineNumber: 2, content: 'line2', type: 'added' }] }],
          language: 'typescript',
        },
      ],
    });

    const mockProvider = {
      name: 'openai',
      generateMutations: vi.fn().mockResolvedValue({
        mutations: [
          {
            id: 'mut-1',
            filePath: 'src/test.ts',
            startLine: 2,
            endLine: 2,
            originalCode: 'line2',
            mutatedCode: 'changed',
            description: 'test',
            category: 'return-value',
          },
        ],
        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        retries: 0,
      }),
    };
    vi.mocked(OpenAIMutationProvider).mockImplementation(() => mockProvider as any);

    const result = await runPipeline({ ...baseConfig, dryRun: true });
    expect(runPreflight).not.toHaveBeenCalled();
    expect(result.totalMutations).toBe(1);
  });

  it('should truncate mutations to requested count', async () => {
    vi.mocked(extractDiff).mockReturnValue({
      baseRef: 'origin/main',
      files: [
        {
          filePath: 'src/test.ts',
          currentContent: 'line1\nline2\nline3',
          hunks: [
            {
              startLine: 2,
              lineCount: 2,
              lines: [
                { lineNumber: 2, content: 'line2', type: 'added' },
                { lineNumber: 3, content: 'line3', type: 'added' },
              ],
            },
          ],
          language: 'typescript',
        },
      ],
    });

    const mockProvider = {
      name: 'openai',
      generateMutations: vi.fn().mockResolvedValue({
        mutations: [
          { id: 'mut-1', filePath: 'src/test.ts', startLine: 2, endLine: 2, originalCode: 'line2', mutatedCode: 'a', description: 'a', category: 'return-value' },
          { id: 'mut-2', filePath: 'src/test.ts', startLine: 2, endLine: 2, originalCode: 'line2', mutatedCode: 'b', description: 'b', category: 'return-value' },
          { id: 'mut-3', filePath: 'src/test.ts', startLine: 2, endLine: 2, originalCode: 'line2', mutatedCode: 'c', description: 'c', category: 'return-value' },
          { id: 'mut-4', filePath: 'src/test.ts', startLine: 2, endLine: 2, originalCode: 'line2', mutatedCode: 'd', description: 'd', category: 'return-value' },
          { id: 'mut-5', filePath: 'src/test.ts', startLine: 2, endLine: 2, originalCode: 'line2', mutatedCode: 'e', description: 'e', category: 'return-value' },
        ],
        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        retries: 0,
      }),
    };
    vi.mocked(OpenAIMutationProvider).mockImplementation(() => mockProvider as any);

    // Request only 3 mutations
    const result = await runPipeline({ ...baseConfig, mutations: 3, dryRun: true });
    expect(result.totalMutations).toBe(3);
  });
});

import type { Mutation } from '../../../src/mutation/types.js';

const baseMutation: Mutation = {
  id: 'mut-1',
  filePath: 'src/test.ts',
  startLine: 2,
  endLine: 2,
  originalCode: 'line2',
  mutatedCode: 'mutated',
  description: 'test mutation',
  category: 'return-value',
};

describe('validateOriginalCode', () => {
  it('returns true when original code matches exactly', () => {
    const content = 'line1\nline2\nline3';
    expect(validateOriginalCode(content, baseMutation)).toBe(true);
  });

  it('returns false when original code differs', () => {
    const content = 'line1\nDIFFERENT\nline3';
    expect(validateOriginalCode(content, baseMutation)).toBe(false);
  });

  it('handles leading/trailing whitespace trimming', () => {
    const content = 'line1\n  line2  \nline3';
    const mutationWithSpaces: Mutation = { ...baseMutation, originalCode: 'line2' };
    // The file has "  line2  " but originalCode is "line2" — trim() on both sides should match
    expect(validateOriginalCode(content, mutationWithSpaces)).toBe(true);
  });
});

describe('applyMutationToContent', () => {
  it('replaces the specified lines with mutated code', () => {
    const content = 'line1\nline2\nline3';
    const mutation: Mutation = { ...baseMutation, startLine: 2, endLine: 2, mutatedCode: 'REPLACED' };
    const result = applyMutationToContent(content, mutation);
    expect(result).toBe('line1\nREPLACED\nline3');
  });

  it('handles multi-line mutations', () => {
    const content = 'line1\nline2\nline3\nline4';
    const mutation: Mutation = { ...baseMutation, startLine: 2, endLine: 3, mutatedCode: 'A\nB\nC' };
    const result = applyMutationToContent(content, mutation);
    expect(result).toBe('line1\nA\nB\nC\nline4');
  });
});

describe('classifyOutcome', () => {
  it("returns 'timeout' when timedOut is true", () => {
    expect(classifyOutcome({ timedOut: true, exitCode: null, passed: false })).toBe('timeout');
  });

  it("returns 'no_coverage' when exitCode is 5", () => {
    expect(classifyOutcome({ timedOut: false, exitCode: 5, passed: false })).toBe('no_coverage');
  });

  it("returns 'survived' when tests pass", () => {
    expect(classifyOutcome({ timedOut: false, exitCode: 0, passed: true })).toBe('survived');
  });

  it("returns 'killed' when tests fail", () => {
    expect(classifyOutcome({ timedOut: false, exitCode: 1, passed: false })).toBe('killed');
  });
});

describe('aggregateResults', () => {
  const tokenUsage = { promptTokens: 10, completionTokens: 5, totalTokens: 15 };

  function makeResult(outcome: string): import('../../../src/mutation/types.js').MutationTestResult {
    return {
      mutation: baseMutation,
      outcome: outcome as import('../../../src/mutation/types.js').MutationOutcome,
      durationMs: 0,
    };
  }

  it('counts outcomes correctly with mixed results', () => {
    const fileResults = [
      {
        filePath: 'src/a.ts',
        tokenUsage,
        results: [makeResult('killed'), makeResult('survived'), makeResult('no_coverage'), makeResult('timeout'), makeResult('error')],
      },
    ];
    const result = aggregateResults(fileResults, tokenUsage, Date.now());
    expect(result.killed).toBe(1);
    expect(result.survived).toBe(1);
    expect(result.noCoverage).toBe(1);
    expect(result.timedOut).toBe(1);
    expect(result.errors).toBe(1);
    expect(result.totalMutations).toBe(5);
  });

  it('calculates mutation score correctly', () => {
    // 2 killed, 1 survived, 1 no_coverage — denominator = 4, score = 50%
    const fileResults = [
      {
        filePath: 'src/a.ts',
        tokenUsage,
        results: [makeResult('killed'), makeResult('killed'), makeResult('survived'), makeResult('no_coverage')],
      },
    ];
    const result = aggregateResults(fileResults, tokenUsage, Date.now());
    expect(result.mutationScore).toBeCloseTo(50);
  });

  it('returns 100 score for empty results', () => {
    const result = aggregateResults([], tokenUsage, Date.now());
    expect(result.mutationScore).toBe(100);
    expect(result.totalMutations).toBe(0);
  });
});
