import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { ChangedFile } from '../diff/types.js';
import { logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import type { MutationProvider } from './provider.js';
import { filterAndMapMutations, shouldRetryOnStatus } from './provider-utils.js';
import { buildPrompt } from './prompt.js';
import { MutationResponseSchema } from './schemas.js';
import type { MutationGenerationResult, TokenUsage } from './types.js';

function extractTokenUsage(
  completion: OpenAI.Chat.Completions.ChatCompletion,
): TokenUsage {
  return {
    promptTokens: completion.usage?.prompt_tokens ?? 0,
    completionTokens: completion.usage?.completion_tokens ?? 0,
    totalTokens: completion.usage?.total_tokens ?? 0,
  };
}

export class OpenAIMutationProvider implements MutationProvider {
  readonly name = 'openai';
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(model: string, client?: OpenAI) {
    this.model = model;
    this.client = client ?? new OpenAI();
  }

  async generateMutations(
    file: ChangedFile,
    count: number,
  ): Promise<MutationGenerationResult> {
    const messages = buildPrompt(file, count);

    const { result: completion, retries } = await withRetry(
      async () => {
        return this.client.beta.chat.completions.parse({
          model: this.model,
          messages,
          response_format: zodResponseFormat(MutationResponseSchema, 'mutations'),
          temperature: 0.7,
        });
      },
      { maxRetries: 2, shouldRetry: shouldRetryOnStatus },
    );

    const parsed = completion.choices[0]?.message?.parsed;
    if (!parsed) {
      logger.warn(`Empty response from ${this.model} for ${file.filePath}`);
      return {
        mutations: [],
        tokenUsage: extractTokenUsage(completion),
        retries,
      };
    }

    const tokenUsage = extractTokenUsage(completion);
    logger.addTokenUsage(tokenUsage);

    return {
      mutations: filterAndMapMutations(parsed, file),
      tokenUsage,
      retries,
    };
  }
}
