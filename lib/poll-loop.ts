import type { Log, TimerHost } from "./timer-host";

const MINUTE_MS = 60 * 1000;

export interface PollLoopOptions {
  intervalMs: number;
  timers: TimerHost;
  log: Log;
  /** The first run waits a random part of this, so devices don't all sync at app start. */
  startSpreadMs?: number;
  /** First retry delay after a failure; doubles per consecutive failure. */
  retryBaseMs?: number;
  retryMaxMs?: number;
  /** Random variation of the interval, as a fraction (0.05 = ±5%). */
  jitter?: number;
  random?: () => number;
}

/** A failure that says how long to wait, e.g. a 429 with Retry-After. */
export interface RetryAfter {
  retryAfterMs: number;
}

/** Passed to the task, which checks it after every await before touching the device. */
export interface PollRun {
  isCurrent(): boolean;
}

/** A failure that will repeat on every retry, e.g. a 400. */
function isPermanent(err: unknown): boolean {
  return (err as { retryable?: unknown } | undefined)?.retryable === false;
}

function retryAfterOf(err: unknown): number {
  const ms = (err as Partial<RetryAfter> | undefined)?.retryAfterMs;
  return typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? ms : 0;
}

/**
 * Runs a task on a self-rescheduling timer: every interval after a success, with exponential
 * backoff after failures. Runs never overlap, and nothing runs or reschedules after stop().
 */
export class PollLoop {
  private timer?: NodeJS.Timeout;
  private generation = 0;
  private stopped = true;
  private failures = 0;
  private readonly random: () => number;

  constructor(
    private readonly task: (run: PollRun) => Promise<void>,
    private readonly options: PollLoopOptions,
  ) {
    this.random = options.random ?? Math.random;
  }

  start(): void {
    this.stop();
    this.stopped = false;
    this.failures = 0;
    this.schedule(this.random() * (this.options.startSpreadMs ?? 0));
  }

  stop(): void {
    this.stopped = true;
    this.generation++;
    this.options.timers.clearTimeout(this.timer);
    this.timer = undefined;
  }

  private schedule(delayMs: number): void {
    const generation = this.generation;
    this.timer = this.options.timers.setTimeout(() => {
      this.timer = undefined;
      if (this.isCurrent(generation)) void this.run(generation);
    }, Math.max(0, Math.round(delayMs)));
  }

  private async run(generation: number): Promise<void> {
    let delayMs: number;
    try {
      await this.task({ isCurrent: () => this.isCurrent(generation) });
      this.failures = 0;
      delayMs = this.withJitter(this.options.intervalMs);
    } catch (err) {
      this.failures++;
      delayMs = isPermanent(err)
        ? this.withJitter(this.options.intervalMs)
        : Math.max(this.backoffMs(), Math.min(retryAfterOf(err), this.options.intervalMs));
      this.options.log(`[poll] run failed (${this.failures}x), retrying in ${Math.round(delayMs / 1000)} s`, err);
    }
    if (this.isCurrent(generation)) this.schedule(delayMs);
  }

  private backoffMs(): number {
    const base = this.options.retryBaseMs ?? MINUTE_MS;
    const max = this.options.retryMaxMs ?? 60 * MINUTE_MS;
    const capped = Math.min(max, base * 2 ** (this.failures - 1));
    return capped / 2 + (this.random() * capped) / 2;
  }

  private withJitter(ms: number): number {
    const jitter = this.options.jitter ?? 0;
    return ms * (1 + (this.random() * 2 - 1) * jitter);
  }

  private isCurrent(generation: number): boolean {
    return !this.stopped && generation === this.generation;
  }
}
