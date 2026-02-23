import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runPreflight, PreflightError } from '../../../src/runner/preflight.js';
import { executeTests } from '../../../src/runner/executor.js';

vi.mock('../../../src/runner/executor.js', () => ({
  executeTests: vi.fn(),
}));

const mockExecuteTests = vi.mocked(executeTests);

describe('PreflightError', () => {
  it('has correct testOutput property', () => {
    const error = new PreflightError('something went wrong', 'test output here');

    expect(error.message).toBe('something went wrong');
    expect(error.testOutput).toBe('test output here');
    expect(error.name).toBe('PreflightError');
    expect(error).toBeInstanceOf(PreflightError);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('runPreflight', () => {
  beforeEach(() => {
    mockExecuteTests.mockReset();
  });

  it('resolves successfully when tests pass', async () => {
    mockExecuteTests.mockResolvedValue({
      passed: true,
      timedOut: false,
      exitCode: 0,
      stdout: 'All tests passed',
      stderr: '',
      durationMs: 1000,
    });

    await expect(runPreflight('npm test', 60)).resolves.toBeUndefined();
    expect(mockExecuteTests).toHaveBeenCalledWith('npm test', 60);
  });

  it('throws PreflightError when tests fail', async () => {
    mockExecuteTests.mockResolvedValue({
      passed: false,
      timedOut: false,
      exitCode: 1,
      stdout: 'Test suite failed',
      stderr: 'Error: assertion failed',
      durationMs: 2000,
    });

    await expect(runPreflight('npm test', 60)).rejects.toThrow(PreflightError);
    await expect(runPreflight('npm test', 60)).rejects.toThrow(
      'Pre-flight test run failed. Tests must pass on unmodified code before mutation testing.',
    );
  });

  it('throws PreflightError on timeout', async () => {
    mockExecuteTests.mockResolvedValue({
      passed: false,
      timedOut: true,
      exitCode: null,
      stdout: 'Running tests...',
      stderr: '',
      durationMs: 30000,
    });

    await expect(runPreflight('npm test', 30)).rejects.toThrow(PreflightError);
    await expect(runPreflight('npm test', 30)).rejects.toThrow(
      'Pre-flight test run timed out. Ensure your test suite completes within the timeout.',
    );
  });

  it('does not throw when exitCode is 5 (no_coverage)', async () => {
    mockExecuteTests.mockResolvedValue({
      passed: false,
      timedOut: false,
      exitCode: 5,
      stdout: 'No coverage data',
      stderr: '',
      durationMs: 500,
    });

    await expect(runPreflight('npm test', 60)).resolves.toBeUndefined();
  });

  it('includes combined stdout and stderr in PreflightError.testOutput on failure', async () => {
    mockExecuteTests.mockResolvedValue({
      passed: false,
      timedOut: false,
      exitCode: 1,
      stdout: 'stdout content',
      stderr: 'stderr content',
      durationMs: 1500,
    });

    try {
      await runPreflight('npm test', 60);
      expect.fail('Expected PreflightError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PreflightError);
      const preflightErr = err as PreflightError;
      expect(preflightErr.testOutput).toContain('stdout content');
      expect(preflightErr.testOutput).toContain('stderr content');
    }
  });

  it('includes combined stdout and stderr in PreflightError.testOutput on timeout', async () => {
    mockExecuteTests.mockResolvedValue({
      passed: false,
      timedOut: true,
      exitCode: null,
      stdout: 'partial output',
      stderr: 'timeout stderr',
      durationMs: 30000,
    });

    try {
      await runPreflight('npm test', 30);
      expect.fail('Expected PreflightError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PreflightError);
      const preflightErr = err as PreflightError;
      expect(preflightErr.testOutput).toContain('partial output');
      expect(preflightErr.testOutput).toContain('timeout stderr');
    }
  });
});
