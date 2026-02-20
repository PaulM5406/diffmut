import path from 'node:path';
import { resolveProvider, type MutantConfig } from '../config/schema.js';
import { extractDiff } from '../diff/extractor.js';
import { AnthropicMutationProvider } from '../mutation/anthropic-provider.js';
import { OpenAIMutationProvider } from '../mutation/openai-provider.js';
import type { MutationProvider } from '../mutation/provider.js';
import type {
  FileResult,
  Mutation,
  MutationOutcome,
  MutationTestResult,
  PipelineResult,
  TokenUsage,
} from '../mutation/types.js';
import { executeTests } from '../runner/executor.js';
import { FileManager } from '../runner/file-manager.js';
import { runPreflight } from '../runner/preflight.js';
import { gitRoot } from '../utils/git.js';
import { logger } from '../utils/logger.js';

function emptyTokenUsage(): TokenUsage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

function addTokenUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

function emptyResult(startTime: number): PipelineResult {
  return {
    totalMutations: 0,
    killed: 0,
    survived: 0,
    timedOut: 0,
    errors: 0,
    mutationScore: 100,
    fileResults: [],
    totalTokenUsage: emptyTokenUsage(),
    durationMs: Date.now() - startTime,
  };
}

function validateOriginalCode(
  fileContent: string,
  mutation: Mutation,
): boolean {
  const lines = fileContent.split('\n');
  const originalLines = lines.slice(mutation.startLine - 1, mutation.endLine);
  const actual = originalLines.join('\n');
  return actual.trim() === mutation.originalCode.trim();
}

function applyMutationToContent(content: string, mutation: Mutation): string {
  const lines = content.split('\n');
  const before = lines.slice(0, mutation.startLine - 1);
  const after = lines.slice(mutation.endLine);
  const mutatedLines = mutation.mutatedCode.split('\n');
  return [...before, ...mutatedLines, ...after].join('\n');
}

function aggregateResults(
  fileResults: FileResult[],
  startTime: number,
): PipelineResult {
  let killed = 0;
  let survived = 0;
  let timedOut = 0;
  let errors = 0;
  let totalTokenUsage = emptyTokenUsage();

  for (const fr of fileResults) {
    totalTokenUsage = addTokenUsage(totalTokenUsage, fr.tokenUsage);
    for (const r of fr.results) {
      switch (r.outcome) {
        case 'killed':
          killed++;
          break;
        case 'survived':
          survived++;
          break;
        case 'timeout':
          timedOut++;
          break;
        case 'error':
          errors++;
          break;
      }
    }
  }

  const totalMutations = killed + survived + timedOut + errors;
  const denominator = killed + survived;
  const mutationScore = denominator > 0 ? (killed / denominator) * 100 : 100;

  return {
    totalMutations,
    killed,
    survived,
    timedOut,
    errors,
    mutationScore,
    fileResults,
    totalTokenUsage,
    durationMs: Date.now() - startTime,
  };
}

export async function runPipeline(config: MutantConfig): Promise<PipelineResult> {
  const startTime = Date.now();
  const root = gitRoot();
  const fileManager = new FileManager();

  try {
    // Step 1: Extract diff
    logger.info(`Extracting diff against ${config.diffBase}...`);
    const diff = extractDiff(config.diffBase, config.include, config.exclude);

    if (diff.files.length === 0) {
      logger.info('No changed files found. Nothing to mutate.');
      return emptyResult(startTime);
    }
    logger.info(`Found ${diff.files.length} changed file(s)`);

    // Step 2: Pre-flight test run (skip in dry-run mode)
    if (!config.dryRun) {
      logger.info('Running pre-flight test check...');
      await runPreflight(config.testCommand, config.timeout);
      logger.info('Pre-flight passed.');
    }

    // Step 3: Create mutation provider
    const providerName = resolveProvider(config);
    const provider: MutationProvider =
      providerName === 'anthropic'
        ? new AnthropicMutationProvider(config.model)
        : new OpenAIMutationProvider(config.model);

    // Step 4: For each file, generate mutations and test them
    const fileResults: FileResult[] = [];

    for (const file of diff.files) {
      logger.info(`Processing ${file.filePath}...`);

      // Generate mutations
      const genResult = await provider.generateMutations(file, config.mutations);
      logger.info(
        `  Generated ${genResult.mutations.length} mutation(s)${genResult.retries > 0 ? ` (${genResult.retries} retries)` : ''}`,
      );

      if (config.dryRun) {
        fileResults.push({
          filePath: file.filePath,
          results: genResult.mutations.map((m) => ({
            mutation: m,
            outcome: 'survived' as const,
            durationMs: 0,
          })),
          tokenUsage: genResult.tokenUsage,
        });
        continue;
      }

      // Test each mutation sequentially
      const results: MutationTestResult[] = [];
      const absPath = path.join(root, file.filePath);
      fileManager.backup(absPath);

      for (const mutation of genResult.mutations) {
        // Validate originalCode matches
        if (!validateOriginalCode(file.currentContent, mutation)) {
          logger.warn(`  Skipping ${mutation.id}: originalCode mismatch`);
          results.push({
            mutation,
            outcome: 'error',
            durationMs: 0,
            testOutput: 'Original code mismatch - LLM hallucinated the original code',
          });
          continue;
        }

        try {
          // Apply mutation
          const mutatedContent = applyMutationToContent(file.currentContent, mutation);
          fileManager.applyMutation(absPath, mutatedContent);

          // Run tests
          const testResult = await executeTests(config.testCommand, config.timeout);

          let outcome: MutationOutcome;
          if (testResult.timedOut) outcome = 'timeout';
          else if (testResult.passed) outcome = 'survived';
          else outcome = 'killed';

          results.push({
            mutation,
            outcome,
            durationMs: testResult.durationMs,
            testOutput: outcome === 'survived' ? testResult.stdout : undefined,
          });

          logger.info(`  ${mutation.id}: ${outcome} (${testResult.durationMs}ms)`);
        } catch (err) {
          results.push({
            mutation,
            outcome: 'error',
            durationMs: 0,
            testOutput: String(err),
          });
        } finally {
          // Always restore after each mutation
          fileManager.restore(absPath);
        }
      }

      fileResults.push({
        filePath: file.filePath,
        results,
        tokenUsage: genResult.tokenUsage,
      });
    }

    return aggregateResults(fileResults, startTime);
  } finally {
    // Guarantee clean working tree
    fileManager.restoreAll();
  }
}
