import { spawn } from 'node:child_process';

export interface TestExecutionResult {
  passed: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  exitCode: number | null;
}

const MAX_OUTPUT_LENGTH = 5000;

function truncateOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_LENGTH) return output;
  return '...(truncated)\n' + output.slice(-MAX_OUTPUT_LENGTH);
}

export function executeTests(
  command: string,
  timeoutSeconds: number,
): Promise<TestExecutionResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const child = spawn(command, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      // Force kill after 5s grace period
      setTimeout(() => {
        if (!settled) {
          child.kill('SIGKILL');
        }
      }, 5000);
    }, timeoutSeconds * 1000);

    child.on('close', (code) => {
      settled = true;
      clearTimeout(timer);
      resolve({
        passed: code === 0,
        durationMs: Date.now() - startTime,
        stdout: truncateOutput(stdout),
        stderr: truncateOutput(stderr),
        timedOut,
        exitCode: code,
      });
    });

    child.on('error', (err) => {
      settled = true;
      clearTimeout(timer);
      resolve({
        passed: false,
        durationMs: Date.now() - startTime,
        stdout: truncateOutput(stdout),
        stderr: err.message,
        timedOut: false,
        exitCode: null,
      });
    });
  });
}
