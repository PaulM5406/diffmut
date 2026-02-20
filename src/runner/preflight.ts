import { executeTests } from './executor.js';

export class PreflightError extends Error {
  constructor(
    message: string,
    public readonly testOutput: string,
  ) {
    super(message);
    this.name = 'PreflightError';
  }
}

export async function runPreflight(
  testCommand: string,
  timeout: number,
): Promise<void> {
  const result = await executeTests(testCommand, timeout);

  if (result.timedOut) {
    throw new PreflightError(
      'Pre-flight test run timed out. Ensure your test suite completes within the timeout.',
      result.stdout + '\n' + result.stderr,
    );
  }

  if (!result.passed) {
    throw new PreflightError(
      'Pre-flight test run failed. Tests must pass on unmodified code before mutation testing.',
      result.stdout + '\n' + result.stderr,
    );
  }
}
