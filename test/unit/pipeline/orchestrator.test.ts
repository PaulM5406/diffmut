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
import { runPipeline } from '../../../src/pipeline/orchestrator.js';
import type { MutantConfig } from '../../../src/config/schema.js';

const baseConfig: MutantConfig = {
  diffBase: 'origin/main',
  testCommand: 'npm test',
  mutations: 3,
  model: 'gpt-4o',
  timeout: 60,
  output: 'text',
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
});
