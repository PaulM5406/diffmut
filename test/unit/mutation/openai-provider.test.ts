import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIMutationProvider } from '../../../src/mutation/openai-provider.js';
import type { ChangedFile } from '../../../src/diff/types.js';

function makeFile(): ChangedFile {
  return {
    filePath: 'src/test.ts',
    currentContent: 'line1\nline2\nline3\nline4\nline5',
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
  };
}

function mockOpenAIClient(parsed: unknown, usage = { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }) {
  return {
    beta: {
      chat: {
        completions: {
          parse: vi.fn().mockResolvedValue({
            choices: [{ message: { parsed } }],
            usage,
          }),
        },
      },
    },
  } as any;
}

describe('OpenAIMutationProvider', () => {
  it('should generate mutations from valid LLM response', async () => {
    const client = mockOpenAIClient({
      mutations: [
        {
          startLine: 2,
          endLine: 2,
          originalCode: 'line2',
          mutatedCode: 'modified_line2',
          description: 'Changed line2 content',
          category: 'return-value',
        },
      ],
    });

    const provider = new OpenAIMutationProvider('gpt-4o', client);
    const result = await provider.generateMutations(makeFile(), 3);

    expect(result.mutations).toHaveLength(1);
    expect(result.mutations[0].filePath).toBe('src/test.ts');
    expect(result.mutations[0].startLine).toBe(2);
    expect(result.mutations[0].mutatedCode).toBe('modified_line2');
    expect(result.tokenUsage.totalTokens).toBe(150);
  });

  it('should filter out mutations outside diff bounds', async () => {
    const client = mockOpenAIClient({
      mutations: [
        {
          startLine: 2,
          endLine: 2,
          originalCode: 'line2',
          mutatedCode: 'modified',
          description: 'Valid mutation',
          category: 'return-value',
        },
        {
          startLine: 5,
          endLine: 5,
          originalCode: 'line5',
          mutatedCode: 'modified',
          description: 'Outside diff',
          category: 'return-value',
        },
      ],
    });

    const provider = new OpenAIMutationProvider('gpt-4o', client);
    const result = await provider.generateMutations(makeFile(), 3);

    expect(result.mutations).toHaveLength(1);
    expect(result.mutations[0].description).toBe('Valid mutation');
  });

  it('should filter out equivalent mutations', async () => {
    const client = mockOpenAIClient({
      mutations: [
        {
          startLine: 2,
          endLine: 2,
          originalCode: 'line2',
          mutatedCode: 'line2', // same as original
          description: 'No-op mutation',
          category: 'return-value',
        },
      ],
    });

    const provider = new OpenAIMutationProvider('gpt-4o', client);
    const result = await provider.generateMutations(makeFile(), 3);

    expect(result.mutations).toHaveLength(0);
  });

  it('should handle empty parsed response', async () => {
    const client = mockOpenAIClient(null);

    const provider = new OpenAIMutationProvider('gpt-4o', client);
    const result = await provider.generateMutations(makeFile(), 3);

    expect(result.mutations).toHaveLength(0);
  });
});
