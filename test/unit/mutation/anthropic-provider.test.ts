import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicMutationProvider } from '../../../src/mutation/anthropic-provider.js';
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

function mockAnthropicClient(
  jsonResponse: unknown,
  usage = { input_tokens: 100, output_tokens: 50 },
) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify(jsonResponse),
          },
        ],
        usage,
        stop_reason: 'end_turn',
      }),
    },
  } as any;
}

describe('AnthropicMutationProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate mutations from valid response', async () => {
    const client = mockAnthropicClient({
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

    const provider = new AnthropicMutationProvider('claude-sonnet-4-5-20250514', client);
    const result = await provider.generateMutations(makeFile(), 3);

    expect(result.mutations).toHaveLength(1);
    expect(result.mutations[0].filePath).toBe('src/test.ts');
    expect(result.mutations[0].startLine).toBe(2);
    expect(result.mutations[0].mutatedCode).toBe('modified_line2');
    expect(result.tokenUsage.promptTokens).toBe(100);
    expect(result.tokenUsage.completionTokens).toBe(50);
    expect(result.tokenUsage.totalTokens).toBe(150);
  });

  it('should pass system prompt separately from messages', async () => {
    const client = mockAnthropicClient({ mutations: [] });

    const provider = new AnthropicMutationProvider('claude-sonnet-4-5-20250514', client);
    await provider.generateMutations(makeFile(), 1);

    const call = client.messages.create.mock.calls[0][0];
    expect(call.system).toBeDefined();
    expect(typeof call.system).toBe('string');
    expect(call.system.length).toBeGreaterThan(0);
    // Messages should only contain user messages, no system
    for (const msg of call.messages) {
      expect(msg.role).not.toBe('system');
    }
  });

  it('should filter out mutations outside diff bounds', async () => {
    const client = mockAnthropicClient({
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

    const provider = new AnthropicMutationProvider('claude-sonnet-4-5-20250514', client);
    const result = await provider.generateMutations(makeFile(), 3);

    expect(result.mutations).toHaveLength(1);
    expect(result.mutations[0].description).toBe('Valid mutation');
  });

  it('should filter out equivalent mutations', async () => {
    const client = mockAnthropicClient({
      mutations: [
        {
          startLine: 2,
          endLine: 2,
          originalCode: 'line2',
          mutatedCode: 'line2',
          description: 'No-op mutation',
          category: 'return-value',
        },
      ],
    });

    const provider = new AnthropicMutationProvider('claude-sonnet-4-5-20250514', client);
    const result = await provider.generateMutations(makeFile(), 3);

    expect(result.mutations).toHaveLength(0);
  });

  it('should handle empty content response', async () => {
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [],
          usage: { input_tokens: 100, output_tokens: 0 },
          stop_reason: 'end_turn',
        }),
      },
    } as any;

    const provider = new AnthropicMutationProvider('claude-sonnet-4-5-20250514', client);
    const result = await provider.generateMutations(makeFile(), 3);

    expect(result.mutations).toHaveLength(0);
    expect(result.tokenUsage.promptTokens).toBe(100);
  });

  it('should include max_tokens and json_schema format in API call', async () => {
    const client = mockAnthropicClient({ mutations: [] });

    const provider = new AnthropicMutationProvider('claude-sonnet-4-5-20250514', client);
    await provider.generateMutations(makeFile(), 1);

    const call = client.messages.create.mock.calls[0][0];
    expect(call.max_tokens).toBe(4096);
    expect(call.output_config.format.type).toBe('json_schema');
    expect(call.output_config.format.schema).toBeDefined();
  });
});
