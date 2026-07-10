function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Serializes calls and enforces a minimum gap between them (for API RPM limits). */
export class MinIntervalQueue {
  private lastAt = 0;
  private chain: Promise<void> = Promise.resolve();

  constructor(private readonly minIntervalMs: number) {}

  async wait(): Promise<void> {
    this.chain = this.chain.then(async () => {
      const now = Date.now();
      const waitMs = Math.max(0, this.lastAt + this.minIntervalMs - now);
      if (waitMs > 0) {
        await sleep(waitMs);
      }
      this.lastAt = Date.now();
    });
    return this.chain;
  }
}

export function rpmToIntervalMs(rpm: number): number {
  const safe = Math.max(1, rpm);
  // Small buffer so we stay under the limit.
  return Math.ceil(60_000 / safe) + 250;
}
