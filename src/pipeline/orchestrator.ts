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


function emptyResult(startTime: number): PipelineResult {
  return {
    totalMutations: 0,
    killed: 0,
    survived: 0,
    noCoverage: 0,
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
  totalTokenUsage: TokenUsage,
  startTime: number,
): PipelineResult {
  let killed = 0;
  let survived = 0;
  let noCoverage = 0;
  let timedOut = 0;
  let errors = 0;

  for (const fr of fileResults) {
    for (const r of fr.results) {
      switch (r.outcome) {
        case 'killed':
          killed++;
          break;
        case 'survived':
          survived++;
          break;
        case 'no_coverage':
          noCoverage++;
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

  const totalMutations = killed + survived + noCoverage + timedOut + errors;
  const denominator = killed + survived + noCoverage;
  const mutationScore = denominator > 0 ? (killed / denominator) * 100 : 100;

  return {
    totalMutations,
    killed,
    survived,
    noCoverage,
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
    const diff = extractDiff(config.diffBase, config.include, config.exclude, config.excludeTests);

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

    // Step 4: Generate mutations for ALL files in a single LLM call
    logger.info(`Generating ${config.mutations} mutation(s) across all files...`);
    const genResult = await provider.generateMutations(diff.files, config.mutations);
    const mutations = genResult.mutations.slice(0, config.mutations);
    logger.info(
      `  Generated ${mutations.length} mutation(s)${genResult.retries > 0 ? ` (${genResult.retries} retries)` : ''}`,
    );

    // Step 5: Group mutations by file
    const mutationsByFile = new Map<string, Mutation[]>();
    for (const mutation of mutations) {
      const existing = mutationsByFile.get(mutation.filePath) ?? [];
      existing.push(mutation);
      mutationsByFile.set(mutation.filePath, existing);
    }

    // Build file lookup for content
    const fileByPath = new Map(diff.files.map((f) => [f.filePath, f]));

    // Step 6: Test mutations grouped by file
    const fileResults: FileResult[] = [];
    const tokenPerFile = emptyTokenUsage();

    for (const [filePath, fileMutations] of mutationsByFile) {
      const file = fileByPath.get(filePath);
      if (!file) continue;

      logger.info(`Processing ${filePath} (${fileMutations.length} mutations)...`);

      if (config.dryRun) {
        fileResults.push({
          filePath,
          results: fileMutations.map((m) => ({
            mutation: m,
            outcome: 'survived' as const,
            durationMs: 0,
          })),
          tokenUsage: tokenPerFile,
        });
        continue;
      }

      const results: MutationTestResult[] = [];
      const absPath = path.join(root, filePath);
      fileManager.backup(absPath);

      for (const mutation of fileMutations) {
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
          const mutatedContent = applyMutationToContent(file.currentContent, mutation);
          fileManager.applyMutation(absPath, mutatedContent);

          const testResult = await executeTests(config.testCommand, config.timeout);

          let outcome: MutationOutcome;
          if (testResult.timedOut) outcome = 'timeout';
          else if (testResult.exitCode === 5) outcome = 'no_coverage';
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
          fileManager.restore(absPath);
        }
      }

      fileResults.push({
        filePath,
        results,
        tokenUsage: tokenPerFile,
      });
    }

    return aggregateResults(fileResults, genResult.tokenUsage, startTime);
  } finally {
    fileManager.restoreAll();
  }
}
