import { z } from 'zod';

export const MutantConfigSchema = z.object({
  diffBase: z.string().default('origin/main'),
  testCommand: z.string(),
  mutations: z.number().int().positive().default(5),
  model: z.string().default('gpt-4o'),
  provider: z.enum(['openai', 'anthropic']).optional(),
  timeout: z.number().int().positive().default(300),
  output: z.enum(['text', 'json', 'github']).default('text'),
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  excludeTests: z.boolean().default(true),
  failOnSurvived: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  typeChecked: z.boolean().default(false),
});

export function resolveProvider(config: MutantConfig): 'openai' | 'anthropic' {
  if (config.provider) return config.provider;
  return config.model.startsWith('claude') ? 'anthropic' : 'openai';
}

export type MutantConfig = z.infer<typeof MutantConfigSchema>;
