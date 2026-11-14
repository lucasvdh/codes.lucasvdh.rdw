import type { TimerHost } from "../../lib/timer-host";

interface Pending {
  id: NodeJS.Timeout;
  at: number;
  callback: () => void;
}

/** A TimerHost driven by hand: `advance` runs what is due, `delays` shows what is scheduled. */
export class FakeTimers implements TimerHost {
  now = 0;
  private pending: Pending[] = [];
  private nextId = 1;

  setTimeout(callback: () => void, ms: number): NodeJS.Timeout {
    const id = this.nextId++ as unknown as NodeJS.Timeout;
    this.pending.push({ id, at: this.now + ms, callback });
    return id;
  }

  clearTimeout(timer: NodeJS.Timeout | undefined): void {
    this.pending = this.pending.filter((p) => p.id !== timer);
  }

  /** Delays (from now) of the timers that are still scheduled. */
  delays(): number[] {
    return this.pending.map((p) => p.at - this.now);
  }

  async advance(ms: number): Promise<void> {
    const until = this.now + ms;
    for (;;) {
      const due = this.pending.filter((p) => p.at <= until).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      this.pending = this.pending.filter((p) => p !== due);
      this.now = due.at;
      due.callback();
      await flush();
    }
    this.now = until;
  }
}

/** Lets pending promise callbacks run. */
export async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await new Promise<void>((resolve) => setImmediate(resolve));
}
