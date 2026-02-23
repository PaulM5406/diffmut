import Anthropic from '@anthropic-ai/sdk';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ChangedFile } from '../diff/types.js';
import { logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import type { MutationProvider } from './provider.js';
import { filterAndMapMultiFileMutations, shouldRetryOnStatus } from './provider-utils.js';
import { buildMultiFilePrompt, type PromptOptions } from './prompt.js';
import { MutationResponseSchema, type MutationResponse } from './schemas.js';
import type { MutationGenerationResult, TokenUsage } from './types.js';

function extractTokenUsage(response: Anthropic.Message): TokenUsage {
  return {
    promptTokens: response.usage.input_tokens,
    completionTokens: response.usage.output_tokens,
    totalTokens: response.usage.input_tokens + response.usage.output_tokens,
  };
}

function parseJsonContent(response: Anthropic.Message): { data: MutationResponse | null; reason: 'empty' | 'malformed' | 'ok' } {
  const textBlocks = response.content.filter((b) => b.type === 'text');
  if (textBlocks.length === 0) return { data: null, reason: 'empty' };

  for (const block of textBlocks) {
    if (block.type === 'text') {
      try {
        const result = MutationResponseSchema.safeParse(JSON.parse(block.text));
        if (result.success) return { data: result.data, reason: 'ok' };
      } catch {
        // not valid JSON, try next block
      }
    }
  }
  return { data: null, reason: 'malformed' };
}

export class AnthropicMutationProvider implements MutationProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(model: string, client?: Anthropic) {
    this.model = model;
    this.client = client ?? new Anthropic();
  }

  async generateMutations(
    files: ChangedFile[],
    count: number,
    options?: PromptOptions,
  ): Promise<MutationGenerationResult> {
    const messages = buildMultiFilePrompt(files, count, options);
    const systemContent = messages.find((m) => m.role === 'system')?.content ?? '';
    const userMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const jsonSchema = zodToJsonSchema(MutationResponseSchema, {
      $refStrategy: 'none',
    });

    const { result: response, retries } = await withRetry(
      async () => {
        return this.client.messages.create({
          model: this.model,
          max_tokens: 8192,
          system: systemContent,
          messages: userMessages,
          output_config: {
            format: {
              type: 'json_schema' as const,
              schema: jsonSchema as Record<string, unknown>,
            },
          },
        });
      },
      { maxRetries: 2, shouldRetry: shouldRetryOnStatus },
    );

    const { data: parsed, reason } = parseJsonContent(response);
    if (!parsed) {
      const filePaths = files.map((f) => f.filePath).join(', ');
      const detail = reason === 'malformed' ? 'malformed JSON' : 'empty response';
      logger.warn(`${detail} from ${this.model} for ${filePaths}`);
      return {
        mutations: [],
        tokenUsage: extractTokenUsage(response),
        retries,
      };
    }

    const tokenUsage = extractTokenUsage(response);

    return {
      mutations: filterAndMapMultiFileMutations(parsed, files),
      tokenUsage,
      retries,
    };
  }
}
