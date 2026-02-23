import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { MutantConfigSchema, resolveProvider, type MutantConfig } from './schema.js';
import { CONFIG_FILE_NAMES } from './defaults.js';

export interface CLIOptions {
  testCommand: string;
  config?: string;
  // String versions of numeric fields (from commander)
  mutations?: string;
  timeout?: string;
  // Direct overrides matching schema fields
  diffBase?: string;
  model?: string;
  provider?: string;
  output?: string;
  include?: string[];
  exclude?: string[];
  excludeTests?: boolean;
  failOnSurvived?: boolean;
  dryRun?: boolean;
}

function findConfigFile(startDir: string): string | null {
  let dir = startDir;
  while (true) {
    for (const name of CONFIG_FILE_NAMES) {
      const filePath = path.join(dir, name);
      if (fs.existsSync(filePath)) {
        return filePath;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function loadConfigFile(filePath: string): Record<string, unknown> {
  const content = fs.readFileSync(filePath, 'utf-8');
  try {
    if (filePath.endsWith('.json')) {
      return JSON.parse(content);
    }
    return YAML.parse(content) ?? {};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse config file ${filePath}: ${message}`, { cause: err });
  }
}

export async function loadConfig(cliOpts: CLIOptions): Promise<MutantConfig> {
  // Load config file
  let fileConfig: Record<string, unknown> = {};
  const configPath = cliOpts.config ?? findConfigFile(process.cwd());
  if (configPath && fs.existsSync(configPath)) {
    fileConfig = loadConfigFile(configPath);
  }

  // CLI options override file config
  const merged = {
    ...fileConfig,
    ...(cliOpts.diffBase !== undefined && { diffBase: cliOpts.diffBase }),
    testCommand: cliOpts.testCommand,
    ...(cliOpts.mutations !== undefined && { mutations: parseInt(cliOpts.mutations, 10) }),
    ...(cliOpts.model !== undefined && { model: cliOpts.model }),
    ...(cliOpts.provider !== undefined && { provider: cliOpts.provider }),
    ...(cliOpts.timeout !== undefined && { timeout: parseInt(cliOpts.timeout, 10) }),
    ...(cliOpts.output !== undefined && { output: cliOpts.output }),
    ...(cliOpts.include !== undefined && { include: cliOpts.include }),
    ...(cliOpts.exclude !== undefined && { exclude: cliOpts.exclude }),
    ...(cliOpts.excludeTests !== undefined && { excludeTests: cliOpts.excludeTests }),
    ...(cliOpts.failOnSurvived !== undefined && { failOnSurvived: cliOpts.failOnSurvived }),
    ...(cliOpts.dryRun !== undefined && { dryRun: cliOpts.dryRun }),
  };

  // Validate
  const config = MutantConfigSchema.parse(merged);

  // Check for the appropriate API key
  const provider = resolveProvider(config);
  if (provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required when using Anthropic provider');
  }
  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required when using OpenAI provider');
  }

  return config;
}
