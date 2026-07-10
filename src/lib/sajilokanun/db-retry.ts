const RETRYABLE =
  /fetch failed|timeout|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|502|503|504/i;

export function isRetryableDbError(message: string): boolean {
  return RETRYABLE.test(message);
}

/** Retry transient Supabase / network failures (fetch failed, timeouts). */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 5
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!isRetryableDbError(msg) || attempt === maxAttempts) throw err;
      const waitMs = Math.min(1500 * 2 ** (attempt - 1), 15000);
      console.warn(
        `[HandyLaw DB retry] ${label} in ${Math.round(waitMs / 1000)}s (attempt ${attempt}/${maxAttempts}): ${msg}`
      );
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`${label}: exhausted retries`);
}
