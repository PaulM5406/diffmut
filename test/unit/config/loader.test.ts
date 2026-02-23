import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs, { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import path from 'node:path';
import { loadConfig } from '../../../src/config/loader.js';

describe('loadConfig', () => {
  const savedOpenAI = process.env.OPENAI_API_KEY;
  const savedAnthropic = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
  });

  afterEach(() => {
    if (savedOpenAI) process.env.OPENAI_API_KEY = savedOpenAI;
    else delete process.env.OPENAI_API_KEY;
    if (savedAnthropic) process.env.ANTHROPIC_API_KEY = savedAnthropic;
    else delete process.env.ANTHROPIC_API_KEY;
  });

  it('should parse CLI options with defaults', async () => {
    const config = await loadConfig({ testCommand: 'npm test' });
    expect(config.testCommand).toBe('npm test');
    expect(config.diffBase).toBe('origin/main');
    expect(config.mutations).toBe(5);
    expect(config.model).toBe('gpt-4o');
    expect(config.provider).toBeUndefined();
    expect(config.timeout).toBe(300);
    expect(config.output).toBe('text');
    expect(config.failOnSurvived).toBe(false);
    expect(config.dryRun).toBe(false);
  });

  it('should override defaults with CLI options', async () => {
    const config = await loadConfig({
      testCommand: 'pytest',
      diffBase: 'main',
      mutations: '10',
      model: 'gpt-4o-mini',
      provider: 'openai',
      timeout: '60',
      output: 'json',
      failOnSurvived: true,
      dryRun: true,
    });
    expect(config.testCommand).toBe('pytest');
    expect(config.diffBase).toBe('main');
    expect(config.mutations).toBe(10);
    expect(config.model).toBe('gpt-4o-mini');
    expect(config.provider).toBe('openai');
    expect(config.timeout).toBe(60);
    expect(config.output).toBe('json');
    expect(config.failOnSurvived).toBe(true);
    expect(config.dryRun).toBe(true);
  });

  it('should throw if OPENAI_API_KEY is missing for OpenAI provider', async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(loadConfig({ testCommand: 'npm test' })).rejects.toThrow(
      'OPENAI_API_KEY',
    );
  });

  it('should throw if ANTHROPIC_API_KEY is missing for Anthropic provider', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(
      loadConfig({ testCommand: 'npm test', model: 'claude-sonnet-4-5-20250514' }),
    ).rejects.toThrow('ANTHROPIC_API_KEY');
  });

  it('should not require OPENAI_API_KEY when using Anthropic provider', async () => {
    delete process.env.OPENAI_API_KEY;
    const config = await loadConfig({
      testCommand: 'npm test',
      provider: 'anthropic',
      model: 'claude-sonnet-4-5-20250514',
    });
    expect(config.provider).toBe('anthropic');
  });

  it('should auto-detect anthropic from claude model name', async () => {
    delete process.env.OPENAI_API_KEY;
    const config = await loadConfig({
      testCommand: 'npm test',
      model: 'claude-sonnet-4-5-20250514',
    });
    expect(config.model).toBe('claude-sonnet-4-5-20250514');
  });
});

describe('config file loading', () => {
  let tempDir: string;

  const savedOpenAI = process.env.OPENAI_API_KEY;
  const savedAnthropic = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'diffmut-test-'));
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    if (savedOpenAI) process.env.OPENAI_API_KEY = savedOpenAI;
    else delete process.env.OPENAI_API_KEY;
    if (savedAnthropic) process.env.ANTHROPIC_API_KEY = savedAnthropic;
    else delete process.env.ANTHROPIC_API_KEY;
  });

  it('should load JSON config file', async () => {
    const tempFilePath = join(tempDir, '.diffmutrc.json');
    writeFileSync(tempFilePath, JSON.stringify({ mutations: 10, model: 'claude-sonnet-4-5-20250514' }), 'utf-8');

    const config = await loadConfig({ config: tempFilePath, testCommand: 'npm test' });

    expect(config.mutations).toBe(10);
    expect(config.model).toBe('claude-sonnet-4-5-20250514');
  });

  it('should load YAML config file', async () => {
    const tempFilePath = join(tempDir, '.diffmutrc.yml');
    writeFileSync(tempFilePath, 'mutations: 7\ndiffBase: main\n', 'utf-8');

    const config = await loadConfig({ config: tempFilePath, testCommand: 'npm test' });

    expect(config.mutations).toBe(7);
    expect(config.diffBase).toBe('main');
  });

  it('should throw on malformed JSON', async () => {
    const tempFilePath = join(tempDir, '.diffmutrc.json');
    writeFileSync(tempFilePath, '{ broken json', 'utf-8');

    await expect(loadConfig({ config: tempFilePath, testCommand: 'npm test' })).rejects.toThrow(
      'Failed to parse config file',
    );
  });
});
