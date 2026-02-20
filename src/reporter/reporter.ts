import type { PipelineResult } from '../mutation/types.js';
import { TextReporter } from './text-reporter.js';
import { JsonReporter } from './json-reporter.js';
import { GithubReporter } from './github-reporter.js';

export interface Reporter {
  report(result: PipelineResult): string;
}

export function createReporter(format: 'text' | 'json' | 'github'): Reporter {
  switch (format) {
    case 'text':
      return new TextReporter();
    case 'json':
      return new JsonReporter();
    case 'github':
      return new GithubReporter();
  }
}
