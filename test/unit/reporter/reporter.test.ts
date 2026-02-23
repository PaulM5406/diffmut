import { describe, it, expect } from 'vitest';
import { createReporter } from '../../../src/reporter/reporter.js';
import { TextReporter } from '../../../src/reporter/text-reporter.js';
import { JsonReporter } from '../../../src/reporter/json-reporter.js';
import { GithubReporter } from '../../../src/reporter/github-reporter.js';

describe('createReporter', () => {
  it('returns TextReporter for "text"', () => {
    const reporter = createReporter('text');

    expect(reporter).toBeInstanceOf(TextReporter);
  });

  it('returns JsonReporter for "json"', () => {
    const reporter = createReporter('json');

    expect(reporter).toBeInstanceOf(JsonReporter);
  });

  it('returns GithubReporter for "github"', () => {
    const reporter = createReporter('github');

    expect(reporter).toBeInstanceOf(GithubReporter);
  });
});
