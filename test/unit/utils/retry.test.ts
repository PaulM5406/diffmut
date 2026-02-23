import { describe, it, expect, vi, afterEach } from 'vitest';
import { withRetry } from '../../../src/utils/retry.js';

const OPTIONS = {
  baseDelayMs: 10,
  maxDelayMs: 100,
  shouldRetry: () => true,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('withRetry', () => {
  it('returns result on first success with retries=0', async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockResolvedValue('ok');

    const { result, retries } = await withRetry(fn, { ...OPTIONS, maxRetries: 3 });

    expect(result).toBe('ok');
    expect(retries).toBe(0);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('retries on retryable error and succeeds', async () => {
    vi.useFakeTimers();
    const error = new Error('transient');
    const fn = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue('recovered');

    const promise = withRetry(fn, { ...OPTIONS, maxRetries: 3 });
    await vi.advanceTimersByTimeAsync(200);
    const { result, retries } = await promise;

    expect(result).toBe('recovered');
    expect(retries).toBe(1);
    expect(fn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('throws immediately on non-retryable error without retrying', async () => {
    vi.useFakeTimers();
    const error = new Error('fatal');
    const fn = vi.fn().mockRejectedValue(error);
    const shouldRetry = vi.fn().mockReturnValue(false);

    await expect(
      withRetry(fn, { ...OPTIONS, maxRetries: 3, shouldRetry }),
    ).rejects.toThrow('fatal');

    expect(fn).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledWith(error);
    vi.useRealTimers();
  });

  it('throws after max retries exhausted', async () => {
    vi.useFakeTimers();
    const error = new Error('always fails');
    const fn = vi.fn().mockRejectedValue(error);

    await expect(
      Promise.all([
        withRetry(fn, { ...OPTIONS, maxRetries: 2 }),
        vi.advanceTimersByTimeAsync(1000),
      ]),
    ).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3); // initial attempt + 2 retries
    vi.useRealTimers();
  });

  it('reports correct retry count after multiple retries', async () => {
    vi.useFakeTimers();
    const error = new Error('transient');
    const fn = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValue('done');

    const promise = withRetry(fn, { ...OPTIONS, maxRetries: 5 });
    await vi.advanceTimersByTimeAsync(500);
    const { result, retries } = await promise;

    expect(result).toBe('done');
    expect(retries).toBe(2);
    expect(fn).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});
