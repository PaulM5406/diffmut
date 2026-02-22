import pc from 'picocolors';
import type { PipelineResult } from '../mutation/types.js';
import type { Reporter } from './reporter.js';

function outcomeLabel(outcome: string): string {
  switch (outcome) {
    case 'killed':
      return pc.green('[KILLED]   ');
    case 'survived':
      return pc.red('[SURVIVED] ');
    case 'timeout':
      return pc.yellow('[TIMEOUT]  ');
    case 'no_coverage':
      return pc.yellow('[NO COVER] ');
    case 'error':
      return pc.dim('[ERROR]    ');
    default:
      return `[${outcome.toUpperCase()}]`;
  }
}

export class TextReporter implements Reporter {
  report(result: PipelineResult): string {
    const lines: string[] = [];

    lines.push('');
    lines.push(pc.bold('Mutagen Report'));
    lines.push('═'.repeat(50));

    const scoreColor = result.mutationScore >= 80 ? pc.green : result.mutationScore >= 50 ? pc.yellow : pc.red;
    lines.push(
      `Mutation Score: ${scoreColor(`${result.mutationScore.toFixed(1)}%`)} (${result.killed}/${result.killed + result.survived} killed)`,
    );
    lines.push('');

    for (const fileResult of result.fileResults) {
      lines.push(pc.bold(pc.underline(fileResult.filePath)));

      for (const r of fileResult.results) {
        const label = outcomeLabel(r.outcome);
        lines.push(
          `  ${label} #${r.mutation.id} ${pc.dim(r.mutation.category)}: ${r.mutation.description} ${pc.dim(`(${r.durationMs}ms)`)}`,
        );
      }

      lines.push('');
    }

    lines.push(pc.dim('─'.repeat(50)));
    lines.push(
      pc.dim(
        `Token Usage: ${result.totalTokenUsage.promptTokens.toLocaleString()} prompt + ${result.totalTokenUsage.completionTokens.toLocaleString()} completion = ${result.totalTokenUsage.totalTokens.toLocaleString()} total`,
      ),
    );
    lines.push(pc.dim(`Duration: ${(result.durationMs / 1000).toFixed(1)}s`));
    lines.push('');

    return lines.join('\n');
  }
}
