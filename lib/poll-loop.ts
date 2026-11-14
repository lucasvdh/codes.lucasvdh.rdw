import type { Log, TimerHost } from "./timer-host";

export interface PollLoopOptions {
  intervalMs: number;
  timers: TimerHost;
  log: Log;
}

/** Runs a task right away and then every interval. */
export class PollLoop {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly task: () => Promise<void>,
    private readonly options: PollLoopOptions,
  ) {}

  start(): void {
    this.run();
  }

  stop(): void {
    this.options.timers.clearTimeout(this.timer);
  }

  private run(): void {
    this.timer = this.options.timers.setTimeout(() => this.run(), this.options.intervalMs);
    this.task().catch((err) => this.options.log("[poll] run failed", err));
  }
}
