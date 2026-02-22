#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig } from './config/loader.js';
import { runPipeline } from './pipeline/orchestrator.js';
import { createReporter } from './reporter/reporter.js';
import { logger } from './utils/logger.js';
import { isInsideGitRepo } from './utils/git.js';
import { PreflightError } from './runner/preflight.js';

const program = new Command();

program
  .name('diffmut')
  .description('LLM-powered mutation testing')
  .version('0.0.5');

program
  .command('run')
  .description('Run mutation testing against changed files')
  .requiredOption('--test-command <cmd>', 'Shell command to run tests')
  .option('--diff-base <ref>', 'Git ref to diff against', 'origin/main')
  .option('--mutations <n>', 'Mutations per changed file', '5')
  .option('--model <model>', 'LLM model to use', 'gpt-4o')
  .option('--provider <name>', 'Provider: openai | anthropic (auto-detected from model)')
  .option('--timeout <seconds>', 'Max time per test run in seconds', '300')
  .option('--output <format>', 'Output format: text | json | github', 'text')
  .option('--include <glob...>', 'Include files matching glob')
  .option('--exclude <glob...>', 'Exclude files matching glob')
  .option('--fail-on-survived', 'Exit code 2 if any mutation survives')
  .option('--dry-run', 'Generate mutations but do not execute tests')
  .option('--config <path>', 'Path to config file')
  .action(async (opts) => {
    try {
      if (!isInsideGitRepo()) {
        logger.error('Not inside a git repository.');
        process.exit(1);
      }

      const config = await loadConfig(opts);
      const result = await runPipeline(config);
      const reporter = createReporter(config.output);
      const output = reporter.report(result);

      if (config.output === 'json') {
        process.stdout.write(output + '\n');
      } else {
        logger.info(output);
      }

      if (config.failOnSurvived && result.survived > 0) {
        process.exit(2);
      }
    } catch (err) {
      if (err instanceof PreflightError) {
        logger.error(err.message);
        if (err.testOutput.trim()) {
          logger.error(err.testOutput);
        }
      } else if (err instanceof Error) {
        logger.error(err.message);
      } else {
        logger.error(String(err));
      }
      process.exit(1);
    }
  });

program.parse();
