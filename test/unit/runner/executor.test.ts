import { describe, it, expect } from 'vitest';
import { executeTests } from '../../../src/runner/executor.js';

describe('executeTests', () => {
  it('should return passed=true for exit code 0', async () => {
    const result = await executeTests('true', 10);
    expect(result.passed).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(result.exitCode).toBe(0);
  });

  it('should return passed=false for exit code 1', async () => {
    const result = await executeTests('false', 10);
    expect(result.passed).toBe(false);
    expect(result.timedOut).toBe(false);
    expect(result.exitCode).toBe(1);
  });

  it('should capture stdout', async () => {
    const result = await executeTests('echo "hello world"', 10);
    expect(result.stdout).toContain('hello world');
    expect(result.passed).toBe(true);
  });

  it('should capture stderr', async () => {
    const result = await executeTests('echo "error" >&2', 10);
    expect(result.stderr).toContain('error');
  });

  it('should handle timeout', async () => {
    const result = await executeTests('sleep 10', 1);
    expect(result.timedOut).toBe(true);
    expect(result.passed).toBe(false);
  });

  it('should track duration', async () => {
    const result = await executeTests('true', 10);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.durationMs).toBeLessThan(5000);
  });
});
